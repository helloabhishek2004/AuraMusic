import { useDownloadStore } from "../store/download.store";
import { DownloadManager } from "./download.manager";
import { StorageService } from "./storage.service";
import { DownloadedTrack } from "../types/download";

export class DownloadQueueManager {
  private static isInitialized = false;

  static async initialize() {
    if (this.isInitialized) return;

    await StorageService.initialize();

    const store = useDownloadStore.getState();
    const now = Date.now();

    // 0. Sync with Native AuraDownloadModule if available
    const { AuraDownload, onDownloadProgress, onDownloadStateChanged } = await import("@/src/services/native-core");
    if (AuraDownload) {
      try {
        await AuraDownload.reconcileDownloads();
        await this.syncFromNative();
        // Trigger non-blocking background hydration to heal missing artwork/metadata
        this.triggerHydration();

        // Listen for network reconnection to auto-heal missing items
        try {
          const NetInfo = require("@react-native-community/netinfo");
          NetInfo.addEventListener((netState: any) => {
            if (netState.isConnected && netState.isInternetReachable !== false) {
              this.triggerHydration();
            }
          });
        } catch (_) {}
      } catch (e) {
        console.warn("[DownloadQueueManager] Failed to sync native downloaded tracks:", e);
      }

      onDownloadProgress((progress) => {
        useDownloadStore.getState().updateProgress(
          progress.trackId,
          progress.percentage / 100,
          progress.bytesDownloaded,
          progress.totalBytes
        );
      });

      onDownloadStateChanged((state) => {
        const s = useDownloadStore.getState();
        if (state.stateName === "COMPLETED" || state.isDownloaded) {
          const task = s.activeTasks[state.trackId];
          const track = task?.track || { id: state.trackId, title: "Unknown", artist: "Unknown" };
          const trackAny = track as any;
          // == FIX #3b: Preserve full metadata in COMPLETED handler ==
          s.setDownloaded({
            id: state.trackId,
            url: trackAny.url || `auramusic://track/${state.trackId}`,
            title: track.title,
            artist: track.artist,
            art: trackAny.art || trackAny.artwork || trackAny.artworkUrl || "",
            localAudioPath: `auramusic://track/${state.trackId}`,
            localArtPath: trackAny.art || trackAny.artwork || trackAny.artworkUrl || "",
            fileSize: state.contentLength || state.bytesDownloaded || 0,
            downloadedAt: Date.now(),
            // Preserved from original track object
            album: trackAny.album || undefined,
            albumId: trackAny.albumId || undefined,
            artistId: trackAny.artistId || undefined,
            duration: typeof trackAny.duration === 'number' && trackAny.duration > 0 ? trackAny.duration : undefined,
          });
          // == END FIX #3b ==
          s.updateStatus(state.trackId, "completed");
        } else if (state.stateName === "DOWNLOADING") {
          s.updateStatus(state.trackId, "downloading");
        } else if (state.stateName === "QUEUED") {
          s.updateStatus(state.trackId, "queued");
        } else if (state.stateName === "PAUSED") {
          s.updateStatus(state.trackId, "paused");
        } else if (state.stateName === "FAILED") {
          s.updateStatus(state.trackId, "failed", state.error);
        } else if (state.stateName === "REMOVING") {
          s.removeDownload(state.trackId);
        }
      });
    }

    // 1. Reconcile downloadedTracks with physical files on disk
    const downloadedTracks = { ...store.downloadedTracks };
    let hasChanges = false;
    for (const trackId of Object.keys(downloadedTracks)) {
      const track = downloadedTracks[trackId];
      if (track.localAudioPath?.startsWith("auramusic://")) {
        continue;
      }
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
      const queuedCount = (state.queue || []).filter(item => item.status === 'queued').length;
      const prevQueuedCount = (prevState.queue || []).filter(item => item.status === 'queued').length;
      if (
        queuedCount > prevQueuedCount ||
        (!state.isQueuePaused && prevState.isQueuePaused)
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

  static async syncFromNative() {
    const { AuraDownload } = await import("@/src/services/native-core");
    if (!AuraDownload) return;
    try {
      const nativeTracks = await AuraDownload.getDownloadedTracks();
      const downloadedMap: Record<string, DownloadedTrack> = {};
      nativeTracks.forEach((t) => {
        const nativeAny = t as any;
        downloadedMap[t.id] = {
          id: t.id,
          url: `auramusic://track/${t.id}`,
          title: t.title,
          artist: t.artist,
          art: t.artworkUrl || "",
          localAudioPath: `auramusic://track/${t.id}`,
          localArtPath: t.artworkUrl || "",
          fileSize: t.contentLength || 0,
          downloadedAt: t.downloadedAt || Date.now(),
          album: t.album || undefined,
          albumId: nativeAny.albumId || undefined,
          artistId: nativeAny.artistId || undefined,
          duration: typeof t.duration === 'number' && t.duration > 0 ? t.duration : undefined,
          isLocal: true,
        };
      });
      useDownloadStore.setState({ downloadedTracks: downloadedMap });
    } catch (e) {
      console.warn("[DownloadQueueManager] Failed to sync from native:", e);
    }
  }

  static async triggerHydration() {
    const { AuraDownload } = await import("@/src/services/native-core");
    if (!AuraDownload) return;
    try {
      const report = await AuraDownload.hydrateDownloads();
      console.log("[DownloadQueueManager] Hydration report:", report);
      if (report && (report.artworkHydrated > 0 || report.metadataHydrated > 0 || report.repairedTracks > 0)) {
        await this.syncFromNative();
      }
    } catch (e) {
      console.warn("[DownloadQueueManager] Hydration trigger error:", e);
    }
  }
}

