import { useDownloadStore } from "../store/download.store";
import { DownloadManager } from "./download.manager";
import { StorageService } from "./storage.service";

export class DownloadQueueManager {
  private static isInitialized = false;

  static async initialize() {
    if (this.isInitialized) return;

    await StorageService.initialize();

    const store = useDownloadStore.getState();
    const now = Date.now();

    // 1. Reconcile downloadedTracks with physical files on disk
    const downloadedTracks = { ...store.downloadedTracks };
    let hasChanges = false;
    for (const trackId of Object.keys(downloadedTracks)) {
      const track = downloadedTracks[trackId];
      const audioExists = await StorageService.fileExists(track.localAudioPath);
      if (!audioExists) {
        delete downloadedTracks[trackId];
        hasChanges = true;
      }
    }
    if (hasChanges) {
      useDownloadStore.setState({ downloadedTracks });
    }

    // 2. Recovery on startup: preparing, downloading, verifying -> queued
    const recoveredQueue = (store.queue || []).map((item) => {
      if (item.status === "downloading" || item.status === "preparing" || item.status === "verifying" || item.status === "queued") {
        return {
          ...item,
          status: "queued" as const,
          progress: 0,
          speedBytesPerSecond: undefined,
          estimatedTimeRemaining: undefined,
        };
      }
      return item;
    });

    // 2.5 Reschedule failed retries to survive app restarts
    recoveredQueue.forEach((item) => {
      if (item.status === "failed" && item.retryCount > 0 && item.retryCount <= 3 && item.lastAttemptAt) {
        const delays = [0, 5000, 15000, 30000];
        const delay = delays[item.retryCount] || 5000;
        const targetTime = item.lastAttemptAt + delay;
        
        if (now >= targetTime) {
          item.status = "queued" as const;
          item.error = undefined;
        } else {
          const remaining = targetTime - now;
          console.log(`[QueueManager] Rescheduling retry #${item.retryCount} for ${item.trackId} in ${remaining}ms`);
          
          setTimeout(() => {
            const currentStore = useDownloadStore.getState();
            const currentItem = currentStore.queue.find((q) => q.trackId === item.trackId);
            if (currentItem && currentItem.status === "failed" && currentItem.retryCount === item.retryCount) {
              currentStore.updateStatus(item.trackId, "queued");
            }
          }, remaining);
        }
      }
    });

    // Sync activeTasks and downloadQueue for backward compatibility
    const activeTasks = { ...store.activeTasks };
    const downloadQueue: string[] = [];

    Object.keys(activeTasks).forEach((id) => {
      const item = recoveredQueue.find((q) => q.trackId === id);
      if (!item) {
        delete activeTasks[id];
      } else if (item.status === "queued") {
        activeTasks[id] = {
          ...activeTasks[id],
          status: "queued" as const,
          progress: 0,
        };
        downloadQueue.push(id);
      }
    });

    useDownloadStore.setState({
      queue: recoveredQueue,
      activeTasks,
      downloadQueue,
      activeDownloads: 0,
    });

    // Reset active count in DownloadManager to 0 on launch
    (DownloadManager as any).activeDownloadCount = 0;

    // 3. Listen to store changes to trigger queue processing
    useDownloadStore.subscribe((state, prevState) => {
      const queueStatusString = (q: any[]) => JSON.stringify((q || []).map((item) => item.status));
      if (
        state.queue.length !== prevState.queue.length ||
        state.isQueuePaused !== prevState.isQueuePaused ||
        state.maxConcurrentDownloads !== prevState.maxConcurrentDownloads ||
        queueStatusString(state.queue) !== queueStatusString(prevState.queue)
      ) {
        this.processQueue();
      }
    });

    this.isInitialized = true;

    // Run scheduler immediately after startup
    this.processQueue();
  }

  static async processQueue() {
    const store = useDownloadStore.getState();
    if (store.isQueuePaused) return;

    const queuedItems = store.queue.filter((item) => item.status === "queued");
    if (queuedItems.length === 0) return;

    // Concurrency System
    const maxConcurrent = store.maxConcurrentDownloads || 3;
    const currentActive = store.queue.filter((item) => ["preparing", "downloading", "verifying"].includes(item.status)).length;

    // Update activeDownloadCount in DownloadManager to stay in sync
    (DownloadManager as any).activeDownloadCount = currentActive;
    useDownloadStore.setState({ activeDownloads: currentActive });

    if (currentActive >= maxConcurrent) return;

    const slotsAvailable = maxConcurrent - currentActive;

    // Queue Prioritization: HIGH -> NORMAL -> LOW, then FIFO (queuedAt ascending)
    const priorityWeights = { HIGH: 3, NORMAL: 2, LOW: 1 };
    const sortedQueuedItems = [...queuedItems].sort((a, b) => {
      const weightA = priorityWeights[a.priority || "NORMAL"] || 2;
      const weightB = priorityWeights[b.priority || "NORMAL"] || 2;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return a.queuedAt - b.queuedAt;
    });

    const itemsToStart = sortedQueuedItems.slice(0, slotsAvailable);

    for (const item of itemsToStart) {
      store.updateStatus(item.trackId, "preparing");
      
      const task = store.activeTasks[item.trackId];
      if (task) {
        // Run async
        DownloadManager.startDownload({
          ...task,
          status: "preparing" as const,
        }).catch((err) => {
          console.error(`[QueueManager] Error starting download for ${item.trackId}:`, err);
        });
      }
    }
  }

  static handleDownloadFailure(trackId: string, errorMsg: string) {
    const store = useDownloadStore.getState();
    const item = store.queue.find((q) => q.trackId === trackId);
    if (!item) return;

    // Paused path: downloading -> paused -> queued. If paused, abort failure/retry logic!
    if (item.status === "paused") {
      return;
    }

    const newRetryCount = item.retryCount + 1;
    
    // Store failure details
    store.updateStatus(trackId, "failed", errorMsg);
    
    useDownloadStore.setState((state) => ({
      queue: state.queue.map((q) =>
        q.trackId === trackId
          ? {
              ...q,
              retryCount: newRetryCount,
              lastError: errorMsg,
              lastAttemptAt: Date.now(),
            }
          : q
      ),
      activeTasks: {
        ...state.activeTasks,
        [trackId]: {
          ...state.activeTasks[trackId],
          retryCount: newRetryCount,
          error: errorMsg,
        },
      },
    }));

    if (newRetryCount <= 3) {
      const delays = [0, 5000, 15000, 30000];
      const delay = delays[newRetryCount] || 5000;
      console.log(`[QueueManager] Auto-retry #${newRetryCount} scheduled for ${trackId} in ${delay}ms`);

      setTimeout(() => {
        const currentStore = useDownloadStore.getState();
        const currentItem = currentStore.queue.find((q) => q.trackId === trackId);
        
        // Re-queue if it's still in failed status and has same retryCount
        if (currentItem && currentItem.status === "failed" && currentItem.retryCount === newRetryCount) {
          currentStore.updateStatus(trackId, "queued");
        }
      }, delay);
    } else {
      console.log(`[QueueManager] Track ${trackId} failed permanently after 3 attempts.`);
    }
  }
}

