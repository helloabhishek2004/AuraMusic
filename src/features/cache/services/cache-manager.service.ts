import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { MetadataCache } from './metadata-cache.service';
import { useSettingsStore } from '../../settings/store/settings.store';
import { AuraDownload, AuraPlayer } from '../../../services/native-core';

const CACHE_DIR = FileSystem.cacheDirectory + 'aura_tracks/';
const AUDIO_DIR = FileSystem.documentDirectory + 'aura/audio/';
const ARTWORK_DIR = FileSystem.documentDirectory + 'aura/artwork/';

export interface StorageStats {
  downloads: number;
  songCache: number;
  artworkCache: number;
  lyricsCache: number;
  metadataCache: number;
  totalSize: number;
}

class CacheManagerService {
  /**
   * Calculates real storage usage across all categories.
   */
  async getCacheStats(): Promise<StorageStats> {
    try {
      if (AuraDownload && typeof AuraDownload.getNativeStorageStats === 'function') {
        const stats = await AuraDownload.getNativeStorageStats();
        if (stats && typeof stats.downloadsBytes === 'number') {
          return {
            downloads: stats.downloadsBytes || 0,
            songCache: stats.songCacheBytes || 0,
            artworkCache: stats.artworkCacheBytes || 0,
            lyricsCache: stats.asyncStorageBytes || 0,
            metadataCache: stats.databaseBytes || 0,
            totalSize: stats.totalBytes || 0,
          };
        }
      }
    } catch (e) {
      console.warn('[CacheManager] Failed to get native storage stats, falling back to JS:', e);
    }

    const [downloadsSize, songCacheSize, artworkCacheSize] = await Promise.all([
      this._getDirectorySize(AUDIO_DIR),
      this._getDirectorySize(CACHE_DIR),
      this._getDirectorySize(ARTWORK_DIR),
    ]);

    const metrics = await MetadataCache.getMetrics();
    const metadataSize = metrics.metadataCount * 50 * 1024;
    const lyricsSize = metrics.lyricsCount * 20 * 1024;

    return {
      downloads: downloadsSize,
      songCache: songCacheSize,
      artworkCache: artworkCacheSize,
      lyricsCache: lyricsSize,
      metadataCache: metadataSize,
      totalSize: downloadsSize + songCacheSize + artworkCacheSize + metadataSize + lyricsSize
    };
  }

  private async _getDirectorySize(dirPath: string): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(dirPath);
      if (!info.exists) return 0;

      const files = await FileSystem.readDirectoryAsync(dirPath);
      let total = 0;
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(dirPath + file);
        if (fileInfo.exists) {
          total += fileInfo.size;
        }
      }
      return total;
    } catch (e) {
      return 0;
    }
  }

  async clearMetadataCache() {
    await MetadataCache.clearAll();
  }

  async clearArtworkCache() {
    // Clear permanent artwork downloads
    await this._emptyDirectory(ARTWORK_DIR);
  }

  async clearLyricsCache() {
    // Lyrics are currently part of MetadataCache in AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    const lyricsKeys = keys.filter(k => k.startsWith('cache:lyrics:'));
    if (lyricsKeys.length > 0) {
      await AsyncStorage.multiRemove(lyricsKeys);
    }
  }

  async clearSongCache() {
    try {
      if (AuraPlayer && typeof AuraPlayer.clearNativeCache === 'function') {
        await AuraPlayer.clearNativeCache();
      }
    } catch (e) {
      console.warn('[CacheManager] Error clearing native streaming cache:', e);
    }
    // Clear temporary audio files in JS directory
    await this._emptyDirectory(CACHE_DIR);
  }

  async clearAllDownloads() {
    // Dangerous: Clear all permanent audio and artwork
    await Promise.all([
      this._emptyDirectory(AUDIO_DIR),
      this._emptyDirectory(ARTWORK_DIR)
    ]);
    // Also clear download store (caller should do this)
  }

  private async _emptyDirectory(dirPath: string) {
    try {
      const files = await FileSystem.readDirectoryAsync(dirPath);
      for (const file of files) {
        await FileSystem.deleteAsync(dirPath + file);
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Enforces FIFO (First-In, First-Out) eviction based on user settings.
   * Oldest accessed files are removed first.
   */
  async enforceFIFO() {
    const settings = useSettingsStore.getState();
    if (settings.maxSongCacheGB === 'unlimited') return;

    const maxSizeBytes = (settings.maxSongCacheGB as number) * 1024 * 1024 * 1024;
    
    try {
      const info = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!info.exists) return;

      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      let totalSize = 0;
      const fileInfos = [];

      for (const file of files) {
        const path = CACHE_DIR + file;
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (fileInfo.exists) {
          totalSize += fileInfo.size;
          fileInfos.push({
            path,
            size: fileInfo.size,
            modificationTime: fileInfo.modificationTime || 0,
          });
        }
      }

      if (totalSize > maxSizeBytes) {
        // Sort by modification time (oldest first)
        fileInfos.sort((a, b) => a.modificationTime - b.modificationTime);

        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.info(`[Cache] Evicting files. Current: ${(totalSize / (1024*1024)).toFixed(1)}MB, Limit: ${(maxSizeBytes / (1024*1024)).toFixed(1)}MB`);
        }

        for (const file of fileInfos) {
          await FileSystem.deleteAsync(file.path);
          totalSize -= file.size;
          // We clean up until we are at 80% of the limit to avoid constant eviction cycles
          if (totalSize <= maxSizeBytes * 0.8) break;
        }
        
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.info(`[Cache] Eviction complete. New size: ${(totalSize / (1024*1024)).toFixed(1)}MB`);
        }
      }
    } catch (error) {
      console.error("[CacheManager] FIFO enforcement failed:", error);
    }
  }

  /**
   * Call this after every successful stream cache insertion
   */
  static async onCacheInsert() {
    // We use a debounced or idle approach to avoid blocking the UI
    const { CacheManager: instance } = await import('./cache-manager.service');
    instance.enforceFIFO();
  }
}

export const CacheManager = new CacheManagerService();
