/**
 * AuraMusic Playlist Store
 * schemaVersion: 1
 *
 * Persistence: AsyncStorage key 'aura-playlists'
 * trackIds = SOURCE OF TRUTH
 * trackSnapshots = OFFLINE FALLBACK ONLY
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import type { PlayerTrack } from '@/src/features/player/types/player';
import type {
  Playlist,
  PlaylistSortBy,
  PlaylistStore,
  PlaylistStoreState,
  PlaylistTrackSnapshot,
} from '../types/playlist';
import { generateGradientColors } from '../utils/playlist-metrics';

// ─── ID Generation ────────────────────────────────────────────────────────────

function generateId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Snapshot Builder ─────────────────────────────────────────────────────────

function toSnapshot(track: PlayerTrack): PlaylistTrackSnapshot {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    art: track.art,
    duration: track.duration,
    isLocal: track.isLocal,
    albumId: track.albumId,
    artistId: track.artistId,
    source: track.source,
    album: track.album,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlaylistStore = create<PlaylistStore>()(
  persist(
    (set, get) => ({
      // ── Initial State ────────────────────────────────────────────────────
      schemaVersion: 1,
      playlists: {},
      playlistOrder: [],
      sortBy: 'recent' as PlaylistSortBy,
      lastUsedPlaylistId: null,

      // ── CRUD ─────────────────────────────────────────────────────────────

      createPlaylist(id, name, description, mood, coverArt): Playlist {
        const now = Date.now();
        const gradientColors = generateGradientColors(name);
        const playlist: Playlist = {
          id,
          name: name.trim(),
          description,
          mood,
          coverArt,
          trackIds: [],
          trackSnapshots: {},
          createdAt: now,
          updatedAt: now,
          pinned: false,
          liked: false,
          gradientColors,
        };
        set((state) => ({
          playlists: { ...state.playlists, [id]: playlist },
          playlistOrder: [id, ...state.playlistOrder],
        }));
        return playlist;
      },

      deletePlaylist(id) {
        set((state) => {
          const { [id]: _removed, ...rest } = state.playlists;
          return {
            playlists: rest,
            playlistOrder: state.playlistOrder.filter((pid) => pid !== id),
            lastUsedPlaylistId:
              state.lastUsedPlaylistId === id ? null : state.lastUsedPlaylistId,
          };
        });
      },

      renamePlaylist(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => {
          const existing = state.playlists[id];
          if (!existing) return state;
          return {
            playlists: {
              ...state.playlists,
              [id]: {
                ...existing,
                name: trimmed,
                gradientColors: generateGradientColors(trimmed),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateDescription(id, description) {
        set((state) => {
          const existing = state.playlists[id];
          if (!existing) return state;
          return {
            playlists: {
              ...state.playlists,
              [id]: { ...existing, description, updatedAt: Date.now() },
            },
          };
        });
      },

      duplicatePlaylist(id): string {
        const source = get().playlists[id];
        if (!source) return '';
        const newId = generateId();
        const now = Date.now();
        const duplicate: Playlist = {
          ...source,
          id: newId,
          name: `Copy of ${source.name}`,
          gradientColors: generateGradientColors(`Copy of ${source.name}`),
          createdAt: now,
          updatedAt: now,
          lastPlayedAt: undefined,
          pinned: false,
          liked: false,
        };
        set((state) => ({
          playlists: { ...state.playlists, [newId]: duplicate },
          playlistOrder: [newId, ...state.playlistOrder],
        }));
        return newId;
      },

      clearPlaylist(id) {
        set((state) => {
          const existing = state.playlists[id];
          if (!existing) return state;
          return {
            playlists: {
              ...state.playlists,
              [id]: {
                ...existing,
                trackIds: [],
                trackSnapshots: {},
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // ── Track Management ─────────────────────────────────────────────────

      addTrack(playlistId, track): 'added' | 'duplicate' {
        const playlist = get().playlists[playlistId];
        if (!playlist) return 'duplicate';
        if (playlist.trackIds.includes(track.id)) return 'duplicate';

        set((state) => ({
          playlists: {
            ...state.playlists,
            [playlistId]: {
              ...playlist,
              trackIds: [...playlist.trackIds, track.id],
              trackSnapshots: {
                ...playlist.trackSnapshots,
                [track.id]: toSnapshot(track),
              },
              updatedAt: Date.now(),
            },
          },
        }));
        return 'added';
      },

      addMultipleTracks(playlistId, tracks): { added: number; skipped: number } {
        const playlist = get().playlists[playlistId];
        if (!playlist) return { added: 0, skipped: tracks.length };

        const existingSet = new Set(playlist.trackIds);
        const newTracks = tracks.filter((t) => !existingSet.has(t.id));
        const skipped = tracks.length - newTracks.length;

        if (newTracks.length === 0) return { added: 0, skipped };

        const newSnapshots: Record<string, PlaylistTrackSnapshot> = {};
        newTracks.forEach((t) => { newSnapshots[t.id] = toSnapshot(t); });

        set((state) => ({
          playlists: {
            ...state.playlists,
            [playlistId]: {
              ...playlist,
              trackIds: [...playlist.trackIds, ...newTracks.map((t) => t.id)],
              trackSnapshots: {
                ...playlist.trackSnapshots,
                ...newSnapshots,
              },
              updatedAt: Date.now(),
            },
          },
        }));
        return { added: newTracks.length, skipped };
      },

      removeTrack(playlistId, trackId) {
        set((state) => {
          const playlist = state.playlists[playlistId];
          if (!playlist) return state;
          const newSnapshots = { ...playlist.trackSnapshots };
          delete newSnapshots[trackId];
          return {
            playlists: {
              ...state.playlists,
              [playlistId]: {
                ...playlist,
                trackIds: playlist.trackIds.filter((id) => id !== trackId),
                trackSnapshots: newSnapshots,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      reorderTracks(playlistId, from, to) {
        // CRITICAL: This ONLY mutates playlist data.
        // It NEVER calls setQueue, never resets currentIndex, never touches player store.
        set((state) => {
          const playlist = state.playlists[playlistId];
          if (!playlist || from === to) return state;
          if (from < 0 || to < 0 || from >= playlist.trackIds.length || to >= playlist.trackIds.length) {
            return state;
          }
          const newIds = [...playlist.trackIds];
          const [moved] = newIds.splice(from, 1);
          newIds.splice(to, 0, moved);
          return {
            playlists: {
              ...state.playlists,
              [playlistId]: {
                ...playlist,
                trackIds: newIds,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // ── Metadata ─────────────────────────────────────────────────────────

      toggleLike(id) {
        set((state) => {
          const p = state.playlists[id];
          if (!p) return state;
          return {
            playlists: {
              ...state.playlists,
              [id]: { ...p, liked: !p.liked, updatedAt: Date.now() },
            },
          };
        });
      },

      togglePin(id) {
        set((state) => {
          const p = state.playlists[id];
          if (!p) return state;
          return {
            playlists: {
              ...state.playlists,
              [id]: { ...p, pinned: !p.pinned, updatedAt: Date.now() },
            },
          };
        });
      },

      updateArtwork(id, uri) {
        set((state) => {
          const p = state.playlists[id];
          if (!p) return state;
          return {
            playlists: {
              ...state.playlists,
              [id]: { ...p, coverArt: uri, updatedAt: Date.now() },
            },
          };
        });
      },

      updateLastPlayed(id) {
        set((state) => {
          const p = state.playlists[id];
          if (!p) return state;
          return {
            playlists: {
              ...state.playlists,
              [id]: { ...p, lastPlayedAt: Date.now() },
            },
          };
        });
      },

      setLastUsedPlaylist(id) {
        set({ lastUsedPlaylistId: id });
      },

      setSortBy(sort) {
        set({ sortBy: sort });
      },

      // ── Queries ──────────────────────────────────────────────────────────

      getPlaylistById(id): Playlist | undefined {
        return get().playlists[id];
      },

      getPlaylistsContainingTrack(trackId): Playlist[] {
        return Object.values(get().playlists).filter((p) =>
          p.trackIds.includes(trackId)
        );
      },

      getSortedPlaylists(): Playlist[] {
        const { playlists, playlistOrder, sortBy } = get();
        const all = Object.values(playlists);

        switch (sortBy) {
          case 'alphabetical':
            return [...all].sort((a, b) => a.name.localeCompare(b.name));
          case 'mostPlayed':
            return [...all].sort(
              (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)
            );
          case 'custom':
            return playlistOrder
              .map((id) => playlists[id])
              .filter(Boolean) as Playlist[];
          case 'recent':
          default:
            return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
        }
      },

      /**
       * Resolves the playlist's trackIds into PlayerTrack objects.
       *
       * Resolution priority per track:
       * 1. DownloadStore.downloadedTracks (most authoritative — local file)
       * 2. trackSnapshot (offline fallback)
       * 3. Skipped with warning (track lost)
       *
       * NOTE: Online resolution happens later in PlaybackService when setQueue
       * is called — url resolution is NOT this function's responsibility.
       */
      resolveTracks(playlistId): PlayerTrack[] {
        const playlist = get().playlists[playlistId];
        if (!playlist) return [];

        const downloadedTracks = useDownloadStore.getState().downloadedTracks;
        const resolved: PlayerTrack[] = [];

        for (const trackId of playlist.trackIds) {
          // Priority 1: downloaded local track (most authoritative)
          const downloaded = downloadedTracks[trackId];
          if (downloaded) {
            resolved.push(downloaded as PlayerTrack);
            continue;
          }

          // Priority 2: snapshot (offline fallback)
          const snap = playlist.trackSnapshots?.[trackId];
          if (snap) {
            resolved.push({
              id: snap.id,
              title: snap.title,
              artist: snap.artist,
              art: snap.art,
              url: '', // Will be resolved by PlaybackService/track-resolver
              duration: snap.duration,
              isLocal: snap.isLocal,
              albumId: snap.albumId,
              artistId: snap.artistId,
              source: snap.source,
              album: snap.album,
            });
            continue;
          }

          // Priority 3: skip (track lost)
          console.warn(`[PlaylistStore] Track ${trackId} in playlist ${playlistId} could not be resolved — skipping`);
        }

        return resolved;
      },
    }),
    {
      name: 'aura-playlists',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist everything — playlists are the primary data
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        playlists: state.playlists,
        playlistOrder: state.playlistOrder,
        sortBy: state.sortBy,
        lastUsedPlaylistId: state.lastUsedPlaylistId,
      }),
      // Migration hook for future schema changes
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        // v1 → future: add migration logic here
        return persistedState as PlaylistStoreState;
      },
    }
  )
);
