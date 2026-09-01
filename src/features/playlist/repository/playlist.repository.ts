/**
 * AuraMusic Playlist Repository
 * 
 * Single authoritative repository abstraction for all playlist persistence.
 * Architecture: Room Database (authoritative native persistence) + Zustand (reactive cache).
 * Handles zero-data-loss idempotent migration from legacy AsyncStorage ('aura-playlists').
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuraPlaylist, isNativeCoreAvailable, NativeRoomPlaylist } from '@/src/services/native-core';
import type { Playlist, PlaylistTrackSnapshot } from '../types/playlist';
import type { PlayerTrack } from '@/src/features/player/types/player';

const LEGACY_STORAGE_KEY = 'aura-playlists';
const MIGRATION_FLAG_KEY = 'aura-playlists-migrated-v4';

export class PlaylistRepository {
  private static isInitialized = false;

  /**
   * Initializes playlist persistence.
   * Pulls authoritative playlists from Room DB.
   * If Room DB has 0 playlists and legacy AsyncStorage has playlists, runs a 1-time migration.
   */
  static async initialize(): Promise<Record<string, Playlist>> {
    const result: Record<string, Playlist> = {};

    if (!isNativeCoreAvailable() || !AuraPlaylist) {
      console.warn('[PlaylistRepository] Native AuraPlaylist module not available, falling back to local memory/AsyncStorage');
      try {
        const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const state = parsed.state || parsed;
          return state.playlists || {};
        }
      } catch (e) {
        console.error('[PlaylistRepository] Error reading fallback AsyncStorage:', e);
      }
      return {};
    }

    try {
      // 1. Fetch from Room
      const roomPlaylists = await AuraPlaylist.getPlaylists();

      // 2. Check if legacy migration needed
      if (roomPlaylists.length === 0) {
        const isMigrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
        if (!isMigrated) {
          const rawLegacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
          if (rawLegacy) {
            try {
              const parsed = JSON.parse(rawLegacy);
              const legacyPlaylists = parsed.state?.playlists || parsed.playlists || parsed;
              if (Object.keys(legacyPlaylists).length > 0) {
                console.log('[PlaylistRepository] Migrating legacy AsyncStorage playlists to Room DB...');
                await AuraPlaylist.syncPlaylistsFromJs(JSON.stringify(legacyPlaylists));
                await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
                // Re-fetch after migration
                const migratedPlaylists = await AuraPlaylist.getPlaylists();
                for (const rp of migratedPlaylists) {
                  result[rp.id] = this.mapNativeToPlaylist(rp);
                }
                this.isInitialized = true;
                return result;
              }
            } catch (err) {
              console.error('[PlaylistRepository] Error during legacy migration:', err);
            }
          }
        }
      }

      for (const rp of roomPlaylists) {
        result[rp.id] = this.mapNativeToPlaylist(rp);
      }

      this.isInitialized = true;
      return result;
    } catch (e) {
      console.error('[PlaylistRepository] Failed to initialize from Room DB:', e);
      return {};
    }
  }

  /**
   * Retrieves all playlists from Room.
   */
  static async getPlaylists(): Promise<Record<string, Playlist>> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) {
      return {};
    }
    try {
      const roomPlaylists = await AuraPlaylist.getPlaylists();
      const result: Record<string, Playlist> = {};
      for (const rp of roomPlaylists) {
        result[rp.id] = this.mapNativeToPlaylist(rp);
      }
      return result;
    } catch (e) {
      console.error('[PlaylistRepository] Error getting playlists:', e);
      return {};
    }
  }

  /**
   * Retrieves a single playlist by ID from Room.
   */
  static async getPlaylist(id: string): Promise<Playlist | null> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return null;
    try {
      const rp = await AuraPlaylist.getPlaylist(id);
      return rp ? this.mapNativeToPlaylist(rp) : null;
    } catch (e) {
      console.error(`[PlaylistRepository] Error getting playlist ${id}:`, e);
      return null;
    }
  }

  /**
   * Creates a new playlist in Room DB.
   */
  static async createPlaylist(
    id: string,
    name: string,
    description?: string,
    mood?: string,
    coverArt?: string,
    gradientColors: [string, string] = ['#bf5af2', '#6f2bbe']
  ): Promise<boolean> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return true;
    try {
      return await AuraPlaylist.createPlaylist(
        id,
        name,
        description || null,
        mood || null,
        coverArt || null,
        gradientColors[0] || null,
        gradientColors[1] || null
      );
    } catch (e) {
      console.error('[PlaylistRepository] Error creating playlist:', e);
      return false;
    }
  }

  /**
   * Renames a playlist in Room DB.
   */
  static async renamePlaylist(id: string, newName: string): Promise<boolean> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return true;
    try {
      return await AuraPlaylist.renamePlaylist(id, newName);
    } catch (e) {
      console.error(`[PlaylistRepository] Error renaming playlist ${id}:`, e);
      return false;
    }
  }

  /**
   * Deletes a playlist and its cross-references from Room DB.
   */
  static async deletePlaylist(id: string): Promise<boolean> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return true;
    try {
      return await AuraPlaylist.deletePlaylist(id);
    } catch (e) {
      console.error(`[PlaylistRepository] Error deleting playlist ${id}:`, e);
      return false;
    }
  }

  /**
   * Adds a track to a playlist in Room DB.
   * Returns true if added, false if already in playlist.
   */
  static async addTrack(playlistId: string, track: PlayerTrack | any): Promise<boolean> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return true;
    try {
      const normalized = {
        id: track.id,
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || null,
        duration: typeof track.duration === 'number' ? track.duration : 0,
        art: track.art || track.artworkUrl || track.thumbnail || '',
        artworkUrl: track.artworkUrl || track.art || track.thumbnail || '',
      };
      return await AuraPlaylist.addTrack(playlistId, normalized);
    } catch (e) {
      console.error(`[PlaylistRepository] Error adding track to playlist ${playlistId}:`, e);
      return false;
    }
  }

  /**
   * Adds multiple tracks to a playlist in a single atomic Room transaction.
   * Returns number of newly added tracks.
   */
  static async addTracks(playlistId: string, tracks: (PlayerTrack | any)[]): Promise<number> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return tracks.length;
    try {
      const normalizedList = tracks.map(track => ({
        id: track.id,
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || null,
        duration: typeof track.duration === 'number' ? track.duration : 0,
        art: track.art || track.artworkUrl || track.thumbnail || '',
        artworkUrl: track.artworkUrl || track.art || track.thumbnail || '',
      }));
      return await AuraPlaylist.addTracks(playlistId, normalizedList);
    } catch (e) {
      console.error(`[PlaylistRepository] Error adding multiple tracks to playlist ${playlistId}:`, e);
      return 0;
    }
  }

  /**
   * Removes a track from a playlist in Room DB.
   */
  static async removeTrack(playlistId: string, trackId: string): Promise<boolean> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return true;
    try {
      return await AuraPlaylist.removeTrack(playlistId, trackId);
    } catch (e) {
      console.error(`[PlaylistRepository] Error removing track ${trackId} from playlist ${playlistId}:`, e);
      return false;
    }
  }

  /**
   * Reorders tracks in a playlist in an atomic Room transaction.
   */
  static async reorderTracks(playlistId: string, orderedTrackIds: string[]): Promise<boolean> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return true;
    try {
      return await AuraPlaylist.reorderTracks(playlistId, orderedTrackIds);
    } catch (e) {
      console.error(`[PlaylistRepository] Error reordering tracks in playlist ${playlistId}:`, e);
      return false;
    }
  }

  /**
   * Clears all tracks from a playlist in Room DB.
   */
  static async clearPlaylist(playlistId: string): Promise<boolean> {
    if (!isNativeCoreAvailable() || !AuraPlaylist) return true;
    try {
      return await AuraPlaylist.clearPlaylist(playlistId);
    } catch (e) {
      console.error(`[PlaylistRepository] Error clearing playlist ${playlistId}:`, e);
      return false;
    }
  }

  /**
   * Helper: Maps a NativeRoomPlaylist from Kotlin into a clean TypeScript Playlist model.
   */
  private static mapNativeToPlaylist(rp: NativeRoomPlaylist): Playlist {
    const snapshots: Record<string, PlaylistTrackSnapshot> = {};
    if (rp.trackSnapshots) {
      for (const [tid, s] of Object.entries(rp.trackSnapshots)) {
        snapshots[tid] = {
          id: s.id,
          title: s.title,
          artist: s.artist,
          art: s.art || s.artworkUrl || '',
          duration: s.duration,
          isLocal: s.isLocal || s.isDownloaded,
          album: s.album,
        };
      }
    }

    return {
      id: rp.id,
      name: rp.name || rp.title || 'My Playlist',
      description: rp.description || undefined,
      mood: rp.mood || undefined,
      coverArt: rp.coverArt || undefined,
      trackIds: rp.trackIds || [],
      trackSnapshots: snapshots,
      createdAt: rp.createdAt || Date.now(),
      updatedAt: rp.updatedAt || Date.now(),
      pinned: rp.pinned || false,
      liked: rp.liked || false,
      gradientColors: (rp.gradientColors && rp.gradientColors.length >= 2)
        ? [rp.gradientColors[0], rp.gradientColors[1]]
        : ['#bf5af2', '#6f2bbe'],
    };
  }
}
