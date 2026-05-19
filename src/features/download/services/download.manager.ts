import * as logger from "@/src/utils/logger";
import * as FileSystem from "expo-file-system/legacy";
import { musicService } from "../../../services/api/music";
import { useDownloadStore } from "../store/download.store";
import { DownloadTask, DownloadedTrack } from "../types/download";
import { DownloadNotificationService } from "./notification.service";
import { StorageService } from "./storage.service";

const MAX_CONCURRENT_DOWNLOADS = 3;
const MAX_RETRIES = 2;

// In-memory cache for resolved stream URLs to avoid duplicate network calls
const resolvedStreamCache: Record<string, string> = {};

export class DownloadManager {
  private static isInitialized = false;
  private static activeDownloadCount = 0;
  private static downloadResumables: Record<
    string,
    FileSystem.DownloadResumable
  > = {};
  private static downloadMeta: Record<string, { lastReported: number }> = {};

  static async initialize() {
    if (this.isInitialized) return;

    await StorageService.initialize();

    // Reset any 'downloading' states to 'queued' on startup
    const activeTasks = useDownloadStore.getState().activeTasks;

    Object.keys(activeTasks).forEach((trackId) => {
      if (activeTasks[trackId].status === "downloading") {
        useDownloadStore.getState().updateStatus(trackId, "queued");
      }
    });

    this.processQueue();
    this.isInitialized = true;

    // Listen for store changes to process queue
    useDownloadStore.subscribe((state, prevState) => {
      if (
        state.downloadQueue.length > prevState.downloadQueue.length ||
        state.activeTasks !== prevState.activeTasks
      ) {
        this.processQueue();
      }
    });
  }

  private static async processQueue() {
    if (this.activeDownloadCount >= MAX_CONCURRENT_DOWNLOADS) return;

    const { downloadQueue, activeTasks } = useDownloadStore.getState();

    if (downloadQueue.length === 0 && this.activeDownloadCount === 0) {
      DownloadNotificationService.clear();
    }

    for (const trackId of downloadQueue) {
      if (this.activeDownloadCount >= MAX_CONCURRENT_DOWNLOADS) break;

      const task = activeTasks[trackId];
      if (task && task.status === "queued") {
        this.startDownload(task);
      }
    }
  }

  private static async startDownload(task: DownloadTask) {
    const trackId = task.track.id;
    const store = useDownloadStore.getState();

    this.activeDownloadCount++;
    store.updateStatus(trackId, "downloading");

    const audioPath = StorageService.getAudioPath(trackId);
    const tempAudioPath = audioPath + ".tmp";

    // meta tracking per-download to throttle progress updates
    this.downloadMeta[trackId] = { lastReported: 0 };

    try {
      // 1. Resolve stream URL if not present (with in-memory cache)
      let streamUrl = task.track.url;
      if (!streamUrl || streamUrl.includes("googlevideo.com")) {
        if (resolvedStreamCache[trackId]) {
          streamUrl = resolvedStreamCache[trackId];
        } else {
          const resolved = await musicService.resolveStream(trackId);
          streamUrl = resolved.streamUrl;
          if (streamUrl) resolvedStreamCache[trackId] = streamUrl;
        }
      }

      if (!streamUrl) throw new Error("Could not resolve stream URL");

      logger.info(`[Download] Starting ${task.track.title} (${trackId})`);

      // 2. Download Audio to Temp Path
      const audioResumable = FileSystem.createDownloadResumable(
        streamUrl,
        tempAudioPath,
        {},
        (progress) => {
          const p =
            progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
          const meta = this.downloadMeta[trackId];

          // Throttle updates to every 5% to reduce bridge overhead and UI lag
          if (!meta) return;
          if (p - meta.lastReported >= 0.05 || p === 1) {
            meta.lastReported = p;

            // Batch small updates: update store and notification
            useDownloadStore.getState().updateProgress(trackId, p);
            DownloadNotificationService.updateProgress(
              task.track.title,
              p,
              useDownloadStore.getState().downloadQueue.length,
            );
          }
        },
      );

      this.downloadResumables[trackId] = audioResumable;
      const audioResult = await audioResumable.downloadAsync();

      if (!audioResult) throw new Error("Audio download failed");

      // Atomic Move
      await FileSystem.moveAsync({ from: tempAudioPath, to: audioPath });

      // Normalize URI to file:// scheme for player compatibility
      const localUri = audioPath.startsWith("file://")
        ? audioPath
        : `file://${audioPath}`;

      // 3. Download Artwork (if available)
      let localArtPath = "";
      if (task.track.art) {
        const artPath = StorageService.getArtworkPath(trackId);
        try {
          // Artwork is small, non-resumable download is fine
          const result = await FileSystem.downloadAsync(
            task.track.art,
            artPath,
          );
          localArtPath = result.uri;
        } catch (e) {
          logger.warn("[Download] Artwork download failed for", trackId);
        }
      }

      // 4. Mark as completed
      const downloadedTrack: DownloadedTrack = {
        ...task.track,
        url: localUri,
        localAudioPath: localUri,
        localArtPath: localArtPath,
        downloadedAt: Date.now(),
        fileSize: await StorageService.getFileSize(audioPath),
        isLocal: true,
      };

      useDownloadStore.getState().setDownloaded(downloadedTrack);

      DownloadNotificationService.showCompleted(1);

      logger.info(`[Download] Completed ${task.track.title} (${trackId})`);
    } catch (error) {
      logger.error(`[Download] Failed for ${trackId}:`, error);

      // Cleanup partial temp file
      try {
        await FileSystem.deleteAsync(tempAudioPath);
      } catch (e) {}

      if (task.retryCount < MAX_RETRIES) {
        useDownloadStore.setState((state) => ({
          activeTasks: {
            ...state.activeTasks,
            [trackId]: {
              ...task,
              status: "queued",
              retryCount: task.retryCount + 1,
              error: (error as Error).message,
            },
          },
        }));
      } else {
        useDownloadStore
          .getState()
          .updateStatus(trackId, "failed", (error as Error).message);
      }
    } finally {
      this.activeDownloadCount--;
      delete this.downloadResumables[trackId];
      delete this.downloadMeta[trackId];
      this.processQueue();
    }
  }

  static async pauseDownload(trackId: string) {
    const resumable = this.downloadResumables[trackId];
    if (resumable) {
      try {
        await resumable.pauseAsync();
        useDownloadStore.getState().updateStatus(trackId, "paused");
      } catch (e) {}
    }
  }

  static async resumeDownload(trackId: string) {
    useDownloadStore.getState().resumeDownload(trackId);
  }

  static async cancelDownload(trackId: string) {
    const resumable = this.downloadResumables[trackId];
    if (resumable) {
      try {
        await resumable.pauseAsync();
      } catch (e) {}
    }
    useDownloadStore.getState().cancelDownload(trackId);

    // Cleanup partial file
    const audioPath = StorageService.getAudioPath(trackId);
    await StorageService.deleteFile(audioPath);
  }

  static async removeDownload(trackId: string) {
    const track = useDownloadStore.getState().downloadedTracks[trackId];

    if (track) {
      await StorageService.deleteFile(track.localAudioPath);
      if (track.localArtPath) {
        await StorageService.deleteFile(track.localArtPath);
      }
      await useDownloadStore.getState().removeDownload(trackId);
    }
  }
}
