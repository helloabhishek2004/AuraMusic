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
  private static downloadMeta: Record<
    string,
    { lastReported: number; lastTimeReported: number; startedAt: number }
  > = {};

  static async initialize() {
    const { DownloadQueueManager } = await import("./download-queue-manager");
    await DownloadQueueManager.initialize();
  }

  private static async processQueue() {
    const { DownloadQueueManager } = await import("./download-queue-manager");
    DownloadQueueManager.processQueue();
  }

  public static async startDownload(task: DownloadTask) {
    const trackId = task.track.id;
    const store = useDownloadStore.getState();
    const downloadStartTime = Date.now();

    const { AuraDownload } = await import("@/src/services/native-core");
    if (AuraDownload) {
      try {
        store.updateStatus(trackId, "downloading");
        store.updateTelemetry("started");
        await AuraDownload.startDownload({
          id: task.track.id,
          title: task.track.title,
          artist: task.track.artist,
          album: task.track.album,
          duration: task.track.duration,
          artworkUrl: task.track.art || (task.track as any).artworkUrl,
        });
        return;
      } catch (e: any) {
        logger.error(`[DownloadManager] Native startDownload failed for ${trackId}:`, e);
        store.updateStatus(trackId, "failed", e.message || "Native download failed");
        return;
      }
    }

    // Ensure notifications permission dynamically when starting download
    try {
      const Notifications = require('expo-notifications');
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    } catch (e) {
      console.warn("[DownloadManager] Failed to request notification permission:", e);
    }

    store.updateStatus(trackId, "downloading");
    store.updateTelemetry("started");
    DownloadNotificationService.showStarted(task.track.title);

    const audioPath = StorageService.getAudioPath(trackId);
    const tempAudioPath = audioPath + ".tmp";

    // meta tracking per-download to throttle progress updates
    this.downloadMeta[trackId] = {
      lastReported: 0,
      lastTimeReported: Date.now(),
      startedAt: Date.now(),
    };

    try {
      // 1. Resolve stream URL if not present (with in-memory cache)
      let streamUrl = task.track.url;

      // [Aura_Ownership] If the track URL is already a local file, import it
      // to the downloads directory instead of entering the HTTP download pipeline.
      if (streamUrl) {
        const { getUriScheme } = await import("../../player/utils/track-resolver");
        const scheme = getUriScheme(streamUrl);
        if (scheme === 'file' || scheme === 'content') {
          logger.info(`[Download] Importing local file for ${task.track.title} (${trackId})`);

          const localSourceUri = streamUrl.startsWith('file://') ? streamUrl : `file://${streamUrl}`;
          const audioPath = StorageService.getAudioPath(trackId);

          try {
            await FileSystem.copyAsync({ from: localSourceUri, to: audioPath });
          } catch (copyErr) {
            logger.warn(`[Download] Copy failed for local source, trying move...`, copyErr);
            await FileSystem.moveAsync({ from: localSourceUri, to: audioPath });
          }

          const localUri = audioPath.startsWith('file://') ? audioPath : `file://${audioPath}`;

          let localArtPath = '';
          if (task.track.art) {
            const artPath = StorageService.getArtworkPath(trackId);
            try {
              const result = await FileSystem.downloadAsync(task.track.art, artPath);
              localArtPath = result.uri;
            } catch (e) {
              logger.warn("[Download] Artwork download failed for", trackId);
            }
          }

          // Verifying
          store.updateStatus(trackId, "verifying");
          const fileExists = await StorageService.fileExists(audioPath);
          const fileSize = await StorageService.getFileSize(audioPath);
          if (!fileExists || fileSize <= 0) {
            throw new Error("Verification failed: Audio file is missing or empty.");
          }

          const downloadedTrack: DownloadedTrack = {
            ...task.track,
            url: localUri,
            localAudioPath: localUri,
            localArtPath: localArtPath,
            downloadedAt: Date.now(),
            fileSize,
            isLocal: true,
          };

          useDownloadStore.getState().setDownloaded(downloadedTrack);
          
          // Telemetry
          const elapsed = (Date.now() - downloadStartTime) / 1000;
          const speed = elapsed > 0 ? fileSize / elapsed : 0;
          useDownloadStore.getState().updateTelemetry("completed", speed, elapsed);

          DownloadNotificationService.showCompleted(1);
          logger.info(`[Download] Imported local file: ${task.track.title} (${trackId})`);
          return;
        }
      }

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
          const p = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
          const meta = this.downloadMeta[trackId];

          if (!meta) return;

          const now = Date.now();
          const elapsedSeconds = (now - meta.startedAt) / 1000;
          const speed = elapsedSeconds > 0 ? progress.totalBytesWritten / elapsedSeconds : 0;
          const remainingBytes = progress.totalBytesExpectedToWrite - progress.totalBytesWritten;
          const eta = speed > 0 ? remainingBytes / speed : 0;

          // Throttling to 250ms minimum
          if (now - meta.lastTimeReported >= 250 || p === 1) {
            meta.lastTimeReported = now;
            meta.lastReported = p;

            // Batch updates
            useDownloadStore.getState().updateProgress(
              trackId,
              p,
              progress.totalBytesWritten,
              progress.totalBytesExpectedToWrite,
              speed,
              eta
            );

            DownloadNotificationService.updateProgress(
              task.track.title,
              p,
              useDownloadStore.getState().queue.filter(q => q.status === 'queued').length
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

      // Transition to verifying
      store.updateStatus(trackId, "verifying");

      // Download Verification: size > 0, file exists, readable
      const fileExists = await StorageService.fileExists(audioPath);
      const fileSize = await StorageService.getFileSize(audioPath);
      if (!fileExists || fileSize <= 0) {
        throw new Error("Verification failed: Audio file is missing or empty.");
      }

      try {
        await FileSystem.readAsStringAsync(audioPath, {
          encoding: FileSystem.EncodingType.Base64,
          length: 100,
          position: 0
        });
      } catch (e) {
        throw new Error("Verification failed: Audio file metadata or content is unreadable.");
      }

      // 4. Mark as completed
      const downloadedTrack: DownloadedTrack = {
        ...task.track,
        url: localUri,
        localAudioPath: localUri,
        localArtPath: localArtPath,
        downloadedAt: Date.now(),
        fileSize,
        isLocal: true,
      };

      useDownloadStore.getState().setDownloaded(downloadedTrack);

      // Telemetry Completed
      const elapsed = (Date.now() - downloadStartTime) / 1000;
      const finalSpeed = elapsed > 0 ? fileSize / elapsed : 0;
      useDownloadStore.getState().updateTelemetry("completed", finalSpeed, elapsed);

      DownloadNotificationService.showCompleted(1);

      logger.info(`[Download] Completed ${task.track.title} (${trackId})`);
    } catch (error) {
      logger.error(`[Download] Failed for ${trackId}:`, error);

      // Cleanup partial temp file
      try {
        await FileSystem.deleteAsync(tempAudioPath);
      } catch (e) {}

      // Telemetry and Notification Failures
      useDownloadStore.getState().updateTelemetry("failed");
      DownloadNotificationService.showFailed(task.track.title, (error as Error).message);

      const { DownloadQueueManager } = await import("./download-queue-manager");
      DownloadQueueManager.handleDownloadFailure(trackId, (error as Error).message);
    } finally {
      delete this.downloadResumables[trackId];
      delete this.downloadMeta[trackId];
      const { DownloadQueueManager } = await import("./download-queue-manager");
      DownloadQueueManager.processQueue();
    }
  }

  static async pauseDownload(trackId: string) {
    const { AuraDownload } = await import("@/src/services/native-core");
    if (AuraDownload) {
      await AuraDownload.pauseDownload(trackId);
      useDownloadStore.getState().updateStatus(trackId, "paused");
      return;
    }
    const resumable = this.downloadResumables[trackId];
    if (resumable) {
      try {
        await resumable.pauseAsync();
        useDownloadStore.getState().updateStatus(trackId, "paused");
        DownloadNotificationService.clear();
      } catch (e) {}
    }
  }

  static async resumeDownload(trackId: string) {
    const { AuraDownload } = await import("@/src/services/native-core");
    if (AuraDownload) {
      await AuraDownload.resumeDownload(trackId);
      useDownloadStore.getState().updateStatus(trackId, "downloading");
      return;
    }
    useDownloadStore.getState().resumeDownload(trackId);
  }

  static async cancelDownload(trackId: string) {
    const { AuraDownload } = await import("@/src/services/native-core");
    if (AuraDownload) {
      await AuraDownload.removeDownload(trackId);
      useDownloadStore.getState().cancelDownload(trackId);
      return;
    }
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

    // Dismiss notification
    DownloadNotificationService.clear();
  }

  static async removeDownload(trackId: string) {
    const { AuraDownload } = await import("@/src/services/native-core");
    if (AuraDownload) {
      await AuraDownload.removeDownload(trackId);
      await useDownloadStore.getState().removeDownload(trackId);
      return;
    }
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
