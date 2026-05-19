import * as logger from "@/src/utils/logger";
import * as FileSystem from "expo-file-system/legacy";
import { StorageService } from "./storage.service";

const CACHE_DIR = FileSystem.cacheDirectory + "aura_tracks/";
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

export class CacheManager {
  static async initialize() {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
    this.runCleanup();
  }

  static getCachePath(trackId: string) {
    return CACHE_DIR + `${trackId}.mp3`;
  }

  static async isCached(trackId: string) {
    const path = this.getCachePath(trackId);
    return await StorageService.fileExists(path);
  }

  static async addToCache(trackId: string, url: string) {
    const path = this.getCachePath(trackId);
    if (await this.isCached(trackId)) return path;

    try {
      const result = await FileSystem.downloadAsync(url, path);
      return result.uri;
    } catch (e) {
      logger.warn("[CacheManager] Failed to cache track:", trackId, e);
      return null;
    }
  }

  static async runCleanup() {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      let totalSize = 0;
      const fileInfos = [];

      for (const file of files) {
        const path = CACHE_DIR + file;
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          totalSize += info.size;
          fileInfos.push({
            path,
            size: info.size,
            modificationTime: info.modificationTime,
          });
        }
      }

      if (totalSize > MAX_CACHE_SIZE) {
        // Sort by modification time (oldest first)
        fileInfos.sort(
          (a, b) => (a.modificationTime || 0) - (b.modificationTime || 0),
        );

        for (const file of fileInfos) {
          await FileSystem.deleteAsync(file.path);
          totalSize -= file.size;
          if (totalSize <= MAX_CACHE_SIZE * 0.8) break; // Cleanup until 80% of max
        }
      }
    } catch (error) {
      logger.error("[CacheManager] Cleanup failed:", error);
    }
  }
}
