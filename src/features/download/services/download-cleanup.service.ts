import * as FileSystem from 'expo-file-system/legacy';
import { useDownloadStore } from '../store/download.store';
import { CacheManager } from '../../cache/services/cache-manager.service';
import { Alert } from 'react-native';

class DownloadCleanupService {
  /**
   * Clears ALL downloaded local audio files but preserves metadata and store structure.
   * This ensures songs remain in 'Downloaded' lists but marked as not local if desired,
   * or completely removed from 'Downloaded' while staying in 'Likes'.
   */
  async clearAllDownloads() {
    try {
      const store = useDownloadStore.getState();
      const downloadedIds = Object.keys(store.downloadedTracks);
      
      if (downloadedIds.length === 0) return { success: true, count: 0 };

      // 1. Physical Cleanup
      await CacheManager.clearAllDownloads();

      // 2. Store Cleanup
      // We keep the entries in downloadedTracks but we must mark them as no longer local
      // Or we remove them from the DownloadStore but they stay in the LikesStore.
      // The user goal says "songs remain playable online".
      
      const newDownloadedTracks = { ...store.downloadedTracks };
      for (const id of downloadedIds) {
        delete newDownloadedTracks[id];
      }
      
      useDownloadStore.setState({ 
        downloadedTracks: {},
        activeTasks: {},
        downloadQueue: []
      });

      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.info(`[Cleanup] Cleared ${downloadedIds.length} downloads`);
      }

      return { success: true, count: downloadedIds.length };
    } catch (error) {
      console.error("[Cleanup] Failed to clear downloads:", error);
      return { success: false, error };
    }
  }

  /**
   * Removes specific track download
   */
  async removeTrackDownload(trackId: string) {
    const store = useDownloadStore.getState();
    const track = store.downloadedTracks[trackId];
    if (!track) return;

    try {
      if (track.localAudioPath) {
        const info = await FileSystem.getInfoAsync(track.localAudioPath);
        if (info.exists) {
          await FileSystem.deleteAsync(track.localAudioPath);
        }
      }
      
      // We don't necessarily delete artwork if it might be shared
      
      await store.removeDownload(trackId);
    } catch (e) {
      console.error("[Cleanup] Failed to remove track download:", trackId, e);
    }
  }
}

export const downloadCleanupService = new DownloadCleanupService();
