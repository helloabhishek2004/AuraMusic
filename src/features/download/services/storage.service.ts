import * as logger from "@/src/utils/logger";
import * as FileSystem from "expo-file-system/legacy";

const BASE_DIR = FileSystem.documentDirectory + "aura/";
const AUDIO_DIR = BASE_DIR + "audio/";
const ARTWORK_DIR = BASE_DIR + "artwork/";
const CACHE_DIR = FileSystem.cacheDirectory + "aura_tracks/";

export class StorageService {
  static async initialize() {
    try {
      const audioInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
      if (!audioInfo.exists) {
        await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
      }

      const artworkInfo = await FileSystem.getInfoAsync(ARTWORK_DIR);
      if (!artworkInfo.exists) {
        await FileSystem.makeDirectoryAsync(ARTWORK_DIR, {
          intermediates: true,
        });
      }

      const cacheInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!cacheInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      logger.error("[StorageService] Initialization failed:", error);
    }
  }

  static getAudioPath(trackId: string) {
    return AUDIO_DIR + `${trackId}.mp3`;
  }

  static getArtworkPath(trackId: string) {
    return ARTWORK_DIR + `${trackId}.webp`;
  }

  static async fileExists(path: string) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    } catch {
      return false;
    }
  }

  static async deleteFile(path: string) {
    try {
      if (await this.fileExists(path)) {
        await FileSystem.deleteAsync(path);
      }
    } catch (error) {
      console.error("[StorageService] Delete failed:", path, error);
    }
  }

  static async getFileSize(path: string) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        return info.size;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  static async cleanupOrphanedFiles(validIds: string[]) {
    try {
      const audioFiles = await FileSystem.readDirectoryAsync(AUDIO_DIR);
      for (const file of audioFiles) {
        const id = file.replace(".mp3", "");
        if (!validIds.includes(id)) {
          await this.deleteFile(AUDIO_DIR + file);
        }
      }

      const artworkFiles = await FileSystem.readDirectoryAsync(ARTWORK_DIR);
      for (const file of artworkFiles) {
        const id = file.replace(".webp", "");
        if (!validIds.includes(id)) {
          await this.deleteFile(ARTWORK_DIR + file);
        }
      }
    } catch (error) {
      logger.error("[StorageService] Cleanup failed:", error);
    }
  }
}
