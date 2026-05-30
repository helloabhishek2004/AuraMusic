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
  latestLikedTrackId: string | null;
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
      latestLikedTrackId: null,

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
          latestLikedTrackId: track.id,
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

          let newLatestId = state.latestLikedTrackId;
          if (state.latestLikedTrackId === trackId) {
            const remainingIds = Object.keys(newIds);
            if (remainingIds.length > 0) {
              remainingIds.sort((a, b) => (newTimes[b] || 0) - (newTimes[a] || 0));
              newLatestId = remainingIds[0];
            } else {
              newLatestId = null;
            }
          }

          return {
            likedTrackIds: newIds,
            likedAt: newTimes,
            trackMetadata: newMeta,
            latestLikedTrackId: newLatestId,
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
        set({ likedTrackIds: {}, likedAt: {}, trackMetadata: {}, latestLikedTrackId: null });
      },
    }),
    {
      name: 'aura-liked-tracks',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
