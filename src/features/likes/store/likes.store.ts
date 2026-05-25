import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerTrack } from '../../player/types/player';

interface LikesState {
  likedTrackIds: Record<string, boolean>;
  likedAt: Record<string, number>;
  // We store a small snapshot of metadata for the "Liked Songs" list 
  // to support offline/cold-start viewing without needing to resolve everything immediately.
  // However, the source of truth for the ID set is likedTrackIds.
  trackMetadata: Record<string, Partial<PlayerTrack>>;
}

interface LikesActions {
  toggleLike: (track: PlayerTrack) => void;
  likeTrack: (track: PlayerTrack) => void;
  unlikeTrack: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
  getLikedIds: () => string[];
  clearLikes: () => void;
}

export const useLikesStore = create<LikesState & LikesActions>()(
  persist(
    (set, get) => ({
      likedTrackIds: {},
      likedAt: {},
      trackMetadata: {},

      toggleLike: (track: PlayerTrack) => {
        const { likedTrackIds } = get();
        if (likedTrackIds[track.id]) {
          get().unlikeTrack(track.id);
        } else {
          get().likeTrack(track);
        }
      },

      likeTrack: (track: PlayerTrack) => {
        set((state) => ({
          likedTrackIds: { ...state.likedTrackIds, [track.id]: true },
          likedAt: { ...state.likedAt, [track.id]: Date.now() },
          trackMetadata: {
            ...state.trackMetadata,
            [track.id]: {
              id: track.id,
              title: track.title,
              artist: track.artist,
              art: track.art,
              duration: track.duration,
              isLocal: track.isLocal,
              source: track.source,
            },
          },
        }));

        // Trigger Auto-Download if enabled
        const { useSettingsStore } = require('../../settings/store/settings.store');
        if (useSettingsStore.getState().autoDownloadLikedSongs) {
          const { useDownloadStore } = require('../../download/store/download.store');
          useDownloadStore.getState().addDownload(track);
        }
      },

      unlikeTrack: (trackId: string) => {
        set((state) => {
          const newIds = { ...state.likedTrackIds };
          const newTimes = { ...state.likedAt };
          const newMeta = { ...state.trackMetadata };
          delete newIds[trackId];
          delete newTimes[trackId];
          delete newMeta[trackId];
          return {
            likedTrackIds: newIds,
            likedAt: newTimes,
            trackMetadata: newMeta,
          };
        });
      },

      isLiked: (trackId: string) => {
        return !!get().likedTrackIds[trackId];
      },

      getLikedIds: () => {
        return Object.keys(get().likedTrackIds).sort(
          (a, b) => (get().likedAt[b] || 0) - (get().likedAt[a] || 0)
        );
      },

      clearLikes: () => {
        set({ likedTrackIds: {}, likedAt: {}, trackMetadata: {} });
      },
    }),
    {
      name: 'aura-liked-tracks',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
