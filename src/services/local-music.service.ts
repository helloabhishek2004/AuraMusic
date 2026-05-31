import * as logger from "@/src/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform, PermissionsAndroid } from "react-native";
import { MusicTrack } from "../types/music";
import * as MediaLibrary from 'expo-media-library';

const STORAGE_KEY = "@aura_music_folders";
const FIRST_ACCESS_KEY = "@aura_music_first_access";
const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "flac", "aac", "opus", "ogg"];

export class LocalMusicService {
  private static get saf() {
    const FS = FileSystem as any;
    if (!FS.StorageAccessFramework) {
      logger.warn(
        "[LocalSAF] StorageAccessFramework is not available in this environment.",
      );
      return null;
    }
    return FS.StorageAccessFramework;
  }

/**
   * Check if user has accessed local library before
   */
  static async hasAccessedBefore(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(FIRST_ACCESS_KEY);
      return value === "true";
    } catch {
      return false;
    }
  }

  /**
   * Mark that user has accessed local library
   */
  static async markFirstAccess(): Promise<void> {
    try {
      await AsyncStorage.setItem(FIRST_ACCESS_KEY, "true");
    } catch {}
  }

  /**
   * Check and request standard Android permissions with proper version handling
   * Android 13+: READ_MEDIA_AUDIO
   * Android <=12: READ_EXTERNAL_STORAGE
   */
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      // Check current permission status
      const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();
      
      if (status === 'granted') return true;
      
      if (!canAskAgain) {
        return false;
      }

      // Request with proper Android version handling
      if (Platform.Version >= 33) {
        // Android 13+ - request READ_MEDIA_AUDIO via expo-media-library
        const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
        return newStatus === 'granted';
      } else {
        // Android 12 and below
        const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
        return newStatus === 'granted';
      }
    } catch (e) {
      logger.error("[LocalSAF] Permission check failed:", e);
      return false;
    }
  }

  /**
   * Check if we have permission granted
   */
  static async hasPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Request folder access via SAF
   */
  static async grantFolderPermission(): Promise<string | null> {
    if (Platform.OS !== "android") {
      logger.info("[LocalSAF] SAF is only available on Android.");
      return null;
    }

    const SAF = this.saf;
    if (!SAF) return null;

    try {
      // 1. First ensure basic media permissions
      const hasMediaPerm = await this.requestPermissions();
      if (!hasMediaPerm) {
        logger.warn("[LocalSAF] Media permission denied");
      }

      // 2. Launch SAF picker
      const permissions = await SAF.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const uri = permissions.directoryUri;
        await this.persistFolderUri(uri);
        logger.info("[LocalSAF] Folder granted:", uri);
        return uri;
      }
    } catch (e) {
      logger.error("[LocalSAF] SAF request error:", e);
    }
    return null;
  }

  /**
   * Persist granted folder URIs
   */
  private static async persistFolderUri(uri: string) {
    try {
      const existing = await this.getPersistedFolderUris();
      if (!existing.includes(uri)) {
        const updated = [...existing, uri];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      logger.error("[LocalSAF] Persistence failed:", e);
    }
  }

  /**
   * Get all persisted folder URIs
   */
  static async getPersistedFolderUris(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Remove a folder from persisted list
   */
  static async removeFolderUri(uri: string) {
    try {
      const existing = await this.getPersistedFolderUris();
      const updated = existing.filter((u) => u !== uri);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      logger.error("[LocalSAF] Removal failed:", e);
    }
  }

  /**
   * Scan all device audio folders dynamically using MediaLibrary
   * This covers older and newer Android versions (and iOS) at production level.
   */
  static async getLocalTracks(): Promise<MusicTrack[]> {
    try {
      // 1. Ensure permissions
      const hasPerm = await this.requestPermissions();
      if (!hasPerm) return [];

      // 2. Fetch all audio assets on the device
      let allAssets: MediaLibrary.Asset[] = [];
      let hasNextPage = true;
      let after: string | undefined = undefined;

      // Fetch albums to map albumId -> folder/album name
      const albums = await MediaLibrary.getAlbumsAsync();
      const albumMap = new Map(albums.map(a => [a.id, a.title]));

      while (hasNextPage) {
        const response = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
          first: 150,
          after,
        });
        allAssets = [...allAssets, ...response.assets];
        hasNextPage = response.hasNextPage;
        after = response.endCursor;
      }

      // Convert assets to MusicTracks
      const tracks: MusicTrack[] = allAssets.map(asset => {
        const filename = asset.filename || "Unknown Track";
        const title = filename.replace(/\.[^/.]+$/, "").trim();
        const extension = filename.split(".").pop()?.toLowerCase() || "mp3";
        const folderName = (asset.albumId ? albumMap.get(asset.albumId) : null) || "Local Library";

        // Convert duration to standard mm:ss format
        const durSec = Math.floor(asset.duration);
        const m = Math.floor(durSec / 60);
        const s = durSec % 60;
        const timeStr = `${m}:${s.toString().padStart(2, "0")}`;

        const playbackUri = Platform.OS === "android"
          ? `content://media/external/audio/media/${asset.id}`
          : asset.uri;

        return {
          id: asset.uri,
          title: title || filename,
          artist: "Local Artist",
          art: "",
          isLocal: true,
          localUri: playbackUri,
          url: playbackUri,
          mimeType: `audio/${extension === "m4a" ? "mp4" : (extension === "mp3" ? "mpeg" : extension)}`,
          time: timeStr,
          folderName: folderName,
        };
      });

      return tracks;
    } catch (e) {
      logger.error("[LocalMusicService] Failed to get local tracks:", e);
      return [];
    }
  }

  /**
   * Recursive scanner for SAF directories
   */
  private static async scanDirectoryRecursive(
    directoryUri: string,
  ): Promise<MusicTrack[]> {
    const SAF = this.saf;
    if (!SAF) return [];

    const tracks: MusicTrack[] = [];
    const queue: string[] = [directoryUri];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentUri = queue.shift()!;
      if (visited.has(currentUri)) continue;
      visited.add(currentUri);

      try {
        const files = await SAF.readDirectoryAsync(currentUri);
        
        for (const fileUri of files) {
          if (this.isHiddenFile(fileUri)) continue;

          if (this.isAudioFile(fileUri)) {
            tracks.push(this.normalizeSafFile(fileUri, currentUri));
          } else if (this.isDirectoryHeuristic(fileUri)) {
            queue.push(fileUri);
          }
        }
      } catch (e) {
        // Access denied or not a directory
      }
    }

    return tracks;
  }

  private static isHiddenFile(uri: string): boolean {
    const decoded = decodeURIComponent(uri);
    const lastPart = decoded.split("/").pop() || "";
    return lastPart.startsWith(".");
  }

  private static isAudioFile(uri: string): boolean {
    const decoded = decodeURIComponent(uri).toLowerCase();
    const lastPart = decoded.split("/").pop() || "";
    const ext = lastPart.split(".").pop();
    return !!ext && AUDIO_EXTENSIONS.includes(ext);
  }

  private static isDirectoryHeuristic(uri: string): boolean {
    const decoded = decodeURIComponent(uri);
    const lastPart = decoded.split("/").pop() || "";
    
    if (!lastPart.includes(".")) return true;
    
    const commonFileExts = ["jpg", "jpeg", "png", "gif", "txt", "pdf", "mp4", "mkv", "avi", "zip", "rar"];
    const ext = lastPart.split(".").pop()?.toLowerCase();
    if (ext && commonFileExts.includes(ext)) return false;

    return false;
  }

  /**
   * Normalize SAF file into MusicTrack
   */
  private static normalizeSafFile(
    fileUri: string,
    parentUri: string,
  ): MusicTrack {
    let decoded = "";
    try {
      decoded = decodeURIComponent(fileUri);
    } catch (e) {
      decoded = fileUri;
    }

    const filename = decoded.split("/").pop() || "Unknown Track";
    const title = filename.replace(/\.[^/.]+$/, "").trim();
    const extension = filename.split(".").pop()?.toLowerCase() || "mp3";

    let folderName = "Local";
    try {
      const decodedParent = decodeURIComponent(parentUri);
      const parentParts = decodedParent.split("/");
      const rawFolderName = parentParts[parentParts.length - 1] || "";
      folderName = rawFolderName.split(":").pop() || "Local";
    } catch (e) {
    }

    return {
      id: fileUri,
      title: title || filename,
      artist: "Local",
      art: "",
      isLocal: true,
      localUri: fileUri,
      url: fileUri,
      mimeType: `audio/${extension === "m4a" ? "mp4" : (extension === "mp3" ? "mpeg" : extension)}`,
      time: "--:--",
      folderName: folderName,
    };
  }

  static groupByFolder(tracks: MusicTrack[]): Record<string, MusicTrack[]> {
    const groups: Record<string, MusicTrack[]> = {};
    tracks.forEach((track) => {
      const folder = track.folderName || "Local";
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(track);
    });
    return groups;
  }
}
