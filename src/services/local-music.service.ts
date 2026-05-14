import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { MusicTrack } from '../types/music';

const STORAGE_KEY = '@aura_music_folders';
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'flac', 'opus', 'ogg', 'aac'];

export class LocalMusicService {
  private static get saf() {
    const FS = FileSystem as any;
    if (!FS.StorageAccessFramework) {
      console.warn('[LocalSAF] StorageAccessFramework is not available in this environment.');
      return null;
    }
    return FS.StorageAccessFramework;
  }

  /**
   * Request folder access via SAF
   */
  static async grantFolderPermission(): Promise<string | null> {
    if (Platform.OS !== 'android') {
      console.log('[LocalSAF] SAF is only available on Android.');
      return null;
    }

    const SAF = this.saf;
    if (!SAF) return null;

    try {
      const permissions = await SAF.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const uri = permissions.directoryUri;
        await this.persistFolderUri(uri);
        console.log('[LocalSAF] Folder granted:', uri);
        return uri;
      }
    } catch (e) {
      console.error('[LocalSAF] Permission error:', e);
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
      console.error('[LocalSAF] Persistence failed:', e);
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
      const updated = existing.filter(u => u !== uri);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('[LocalSAF] Removal failed:', e);
    }
  }

  /**
   * Scan all granted folders recursively
   */
  static async getLocalTracks(): Promise<MusicTrack[]> {
    if (Platform.OS !== 'android') return [];

    const SAF = this.saf;
    if (!SAF) return [];

    const folderUris = await this.getPersistedFolderUris();
    if (folderUris.length === 0) return [];

    console.log('[LocalSAF] Scanning folders:', folderUris.length);
    let allTracks: MusicTrack[] = [];

    for (const folderUri of folderUris) {
      try {
        const tracks = await this.scanDirectoryRecursive(folderUri);
        allTracks = [...allTracks, ...tracks];
      } catch (e) {
        console.error(`[LocalSAF] Failed to scan folder ${folderUri}:`, e);
      }
    }

    // Deduplicate by URI (id)
    const uniqueTracks = Array.from(new Map(allTracks.map(t => [t.id, t])).values());
    console.log(`[LocalSAF] Total tracks discovered: ${uniqueTracks.length}`);

    return uniqueTracks;
  }

  /**
   * Recursive scanner for SAF directories
   */
  private static async scanDirectoryRecursive(directoryUri: string): Promise<MusicTrack[]> {
    const SAF = this.saf;
    if (!SAF) return [];

    const tracks: MusicTrack[] = [];
    const queue: string[] = [directoryUri];
    const visited = new Set<string>();

    console.log('[LocalSAF] Starting recursive scan for:', directoryUri);

    while (queue.length > 0) {
      const currentUri = queue.shift()!;
      if (visited.has(currentUri)) continue;
      visited.add(currentUri);

      try {
        const files = await SAF.readDirectoryAsync(currentUri);
        
        for (const fileUri of files) {
          const isAudio = this.isAudioFile(fileUri);
          if (isAudio) {
            tracks.push(this.normalizeSafFile(fileUri, currentUri));
          } else {
            // Heuristic for directory detection in SAF:
            // 1. Doesn't have a known audio extension
            // 2. We can try to read it; if it succeeds, it's a folder.
            const decoded = decodeURIComponent(fileUri);
            const lastPart = decoded.split('/').pop() || '';
            const hasAudioExt = AUDIO_EXTENSIONS.some(ext => lastPart.toLowerCase().endsWith('.' + ext));
            
            // If it doesn't have an audio extension, it might be a directory or another file type.
            // To be safe, we only recurse if it doesn't look like a file with an extension,
            // OR if it's a known folder pattern.
            if (!hasAudioExt && (!lastPart.includes('.') || lastPart.length > 20)) {
              queue.push(fileUri);
            }
          }
        }
      } catch (e) {
        // Not a directory or access denied - skip silently
      }
    }

    return tracks;
  }

  private static isAudioFile(uri: string): boolean {
    const decoded = decodeURIComponent(uri);
    const lastPart = decoded.split('/').pop() || '';
    const ext = lastPart.split('.').pop()?.toLowerCase();
    return !!ext && AUDIO_EXTENSIONS.includes(ext);
  }

  /**
   * Normalize SAF file into MusicTrack
   */
  private static normalizeSafFile(fileUri: string, parentUri: string): MusicTrack {
    let decoded = '';
    try {
      decoded = decodeURIComponent(fileUri);
    } catch (e) {
      decoded = fileUri;
    }
    
    const filename = decoded.split('/').pop() || 'Unknown Track';
    
    // Improved title extraction: remove extension and clean up
    const title = filename.replace(/\.[^/.]+$/, '').trim();
    
    // Extension for mimeType
    const extension = filename.split('.').pop()?.toLowerCase() || 'mp3';
    
    // Extract folder name from parent URI
    let folderName = 'Local';
    try {
      const decodedParent = decodeURIComponent(parentUri);
      const parentParts = decodedParent.split('/');
      const rawFolderName = parentParts[parentParts.length - 1] || '';
      // Clean up SAF folder names (e.g., "primary:Music" -> "Music")
      folderName = rawFolderName.split(':').pop() || 'Local';
    } catch (e) {
      // Fallback
    }

    return {
      id: fileUri,
      title: title || filename,
      artist: 'Local',
      art: '',
      isLocal: true,
      localUri: fileUri,
      url: fileUri, // Ensure url is set for player compatibility
      mimeType: `audio/${extension === 'm4a' ? 'mp4' : extension}`,
      time: '--:--', 
      folderName: folderName
    };
  }

  static groupByFolder(tracks: MusicTrack[]): Record<string, MusicTrack[]> {
    const groups: Record<string, MusicTrack[]> = {};
    tracks.forEach(track => {
      const folder = track.folderName || 'Local';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(track);
    });
    return groups;
  }
}
