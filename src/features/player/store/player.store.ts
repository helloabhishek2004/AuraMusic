import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlaybackService } from "../services/playback.service";
import { transitionManager } from "../services/transition-manager";
import { musicService } from "../../../services/api/music";
import {
    PlaybackStatus,
    PlayerStore,
    PlayerTrack,
    RepeatMode,
} from "../types/player";
import type { PlaybackContext } from '@/src/features/playlist/types/playlist';
import { useMediaCacheStore } from "../../cache/store/media-cache.store";

interface ExtendedPlayerStore extends PlayerStore {
  isPreloading: boolean;
  isReordering: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  // Playlist-aware playback context
  activeContext: PlaybackContext | null;
  setActiveContext: (context: PlaybackContext | null) => void;
}

export const usePlayerStore = create<ExtendedPlayerStore>()(
  persist(
    (set, get) => ({
      // State
      currentTrack: null,
      originalQueue: [],
      queue: [],
      currentIndex: -1,
      status: "idle",
      isPlaying: false,
      isBuffering: false,
      duration: 0,
      position: 0,
      bufferedPosition: 0,
      volume: 1.0,
      repeatMode: "off",
      isShuffle: false,
      error: null,
      _hasHydrated: false,

      // Lyrics State
      lyrics: null as any,
      isLyricsLoading: false,

      // Transition / Sync State
      lastResolutionId: 0,
      preloadedTrack: null,
      previousTrack: null,
      isTransitioning: false,
      isPreloading: false,
      isReordering: false,
      _lastVolumeSync: 0,

      // Playback context (for playlist-aware queue tracking)
      activeContext: null,

      setHasHydrated: (val: boolean) => set({ _hasHydrated: val }),
      setActiveContext: (context: PlaybackContext | null) => set({ activeContext: context }),
      syncWithNative: async () => {
        try {
          const TrackPlayer = (await import("@rntp/player")).default;
          const active = await TrackPlayer.getActiveMediaItem();
          const index = await TrackPlayer.getActiveMediaItemIndex();

          if (active) {
            const store = get();
            const foundIndex = store.queue.findIndex(t => t.id === (active as any).id || t.id === (active as any).mediaId);

            if (foundIndex !== -1 && (foundIndex !== store.currentIndex || foundIndex !== index)) {
               if (typeof __DEV__ !== "undefined" && __DEV__) {
                 console.info("[Player] Store synced with Native:", foundIndex);
               }
               set({ currentIndex: foundIndex, currentTrack: store.queue[foundIndex] });
            }
          }
        } catch (e) {}
      },

      // Actions
      setTrack: async (track: PlayerTrack) => {

        const resolutionId = ++get().lastResolutionId;
        const currentTrack = get().currentTrack;

        if (currentTrack?.id === track.id && get().status === "playing") {
          transitionManager.setTransitioning(false);
          return;
        }

        set({
          isTransitioning: true,
          previousTrack: currentTrack,
          currentTrack: track,
          status: "buffering",
          isBuffering: true,
          isPlaying: false,
          position: 0,
          lyrics: null,
          error: null
        });

        try {
          const { TrackOrchestrator } = await import("../services/track-orchestrator");
          const resolvedTrack = await TrackOrchestrator.resolveAndEnrich(track);

          if (get().lastResolutionId !== resolutionId) {
            transitionManager.setTransitioning(false);
            set({ isTransitioning: false });
            return;
          }

          // Hydrate lyrics from cache if available, otherwise fetch
          const cached = useMediaCacheStore.getState().getCachedTrack(resolvedTrack.id);
          if (cached?.lyrics) {
              set({ lyrics: cached.lyrics });
          } else {
              get().fetchLyrics(resolvedTrack);
          }

          await PlaybackService.loadTrack(resolvedTrack, get().queue, get().currentIndex);

          set({
            currentTrack: resolvedTrack,
            status: "playing",
            isPlaying: true,
            isBuffering: false,
            isTransitioning: false,
            preloadedTrack: null
          });

          transitionManager.setTransitioning(false);
          transitionManager.clearCache([resolvedTrack.id]);

          get().preloadNext();

        } catch (error) {
          if (get().lastResolutionId === resolutionId) {
            transitionManager.setTransitioning(false);
            set({
              status: "error",
              error: (error as Error).message || "Playback failed",
              isPlaying: false,
              isBuffering: false,
              isTransitioning: false
            });
          }
        }
      },

      preloadTrack: async (track: PlayerTrack) => {
        if (get().preloadedTrack?.id === track.id) return get().preloadedTrack?.url || null;

        set({ isPreloading: true });
        try {
          const { resolveTrack } = await import("../utils/track-resolver");
          const resolved = await resolveTrack(track);

          set({
            preloadedTrack: resolved,
            isPreloading: false
          });
          return resolved.url;
        } catch (e) {
          set({ isPreloading: false });
          return null;
        }
      },

      fetchLyrics: async (track: PlayerTrack) => {
        if (!track) return;
        
        // Use cache first
        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(track.id);
        if (cached?.lyrics) {
            set({ lyrics: cached.lyrics, isLyricsLoading: false });
            return;
        }

        set({ isLyricsLoading: true, lyrics: null });
        try {
          const response = await musicService.resolveLyrics(track);
          if (response) {
              cacheStore.cacheLyrics(track.id, response);
          }
          if (get().currentTrack?.id === track.id) {
            set({ lyrics: response, isLyricsLoading: false });
          }
        } catch (error) {
          if (get().currentTrack?.id === track.id) {
            set({ isLyricsLoading: false, lyrics: null });
          }
        }
      },

      preloadNext: async () => {
        const { queue, currentIndex, preloadedTrack, isPreloading, currentTrack } = get();
        if (queue.length === 0 || isPreloading || !currentTrack) return;

        const nextIndex = (currentIndex + 1) % queue.length;
        const nextTrack = queue[nextIndex];

        if (!nextTrack) return;
        
        // Predictive metadata enrichment for next track
        const { TrackOrchestrator } = await import("../services/track-orchestrator");
        TrackOrchestrator.prefetchMetadata(nextTrack);

        if (preloadedTrack && preloadedTrack.id === nextTrack.id) return;
        if (transitionManager.getCachedTrack(nextTrack.id)) return;

        set({ isPreloading: true });

        const cached = await transitionManager.preloadNextTrack(nextTrack, currentTrack.id);

        if (cached) {
          // Sync with Native Player immediately so auto-next is seamless
          PlaybackService.updateMediaItem(nextIndex, cached);

          // Update store queue with resolved track to prevent stale references
          const newQueue = [...get().queue];
          newQueue[nextIndex] = cached;

          if (get().currentIndex === nextIndex) {
            set({ queue: newQueue, preloadedTrack: cached, isPreloading: false });
          } else {
            set({ queue: newQueue, isPreloading: false });
          }

          const secondIndex = (nextIndex + 1) % queue.length;
          if (secondIndex !== nextIndex && queue[secondIndex]) {
            transitionManager.preloadSecondaryTrack(queue[secondIndex], currentTrack.id);
          }
        } else {
          set({ isPreloading: false });
        }
      },

      setQueue: async (tracks: PlayerTrack[], startIndex: number = 0) => {
        const isShuffle = get().isShuffle;
        
        // Hydrate from cache immediately for responsive UI
        const cacheStore = useMediaCacheStore.getState();
        const hydratedTracks = tracks.map(t => {
            const cached = cacheStore.getCachedTrack(t.id);
            return cached ? { ...t, ...cached.track } : t;
        });

        let activeQueue = [...hydratedTracks];
        let newStartIndex = startIndex;

        if (isShuffle) {
          const selectedTrack = hydratedTracks[startIndex];
          const otherTracks = hydratedTracks.filter((_, i) => i !== startIndex);
          for (let i = otherTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
          }
          activeQueue = [selectedTrack, ...otherTracks];
          newStartIndex = 0;
        }

        set({
          originalQueue: hydratedTracks,
          queue: activeQueue,
          currentIndex: newStartIndex
        });

        if (activeQueue[newStartIndex]) {
          await get().setTrack(activeQueue[newStartIndex]);
        }
      },

      playNext: (track: PlayerTrack) => {
        const { queue, originalQueue, currentIndex } = get();
        
        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(track.id);
        const hydratedTrack = cached ? { ...track, ...cached.track } as PlayerTrack : track;

        const newQueue = [...queue];
        newQueue.splice(currentIndex + 1, 0, hydratedTrack);

        const newOriginal = [...originalQueue];
        if (!newOriginal.find(t => t.id === hydratedTrack.id)) {
          newOriginal.push(hydratedTrack);
        }

        set({ queue: newQueue, originalQueue: newOriginal });

        PlaybackService.updateQueue(newQueue, currentIndex);
      },

      addToQueue: (track: PlayerTrack) => {
        const { queue, originalQueue, currentIndex } = get();

        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(track.id);
        const hydratedTrack = cached ? { ...track, ...cached.track } as PlayerTrack : track;

        const newQueue = [...queue, hydratedTrack];
        const newOriginal = [...originalQueue];
        if (!newOriginal.find(t => t.id === hydratedTrack.id)) {
          newOriginal.push(hydratedTrack);
        }

        set({ queue: newQueue, originalQueue: newOriginal });

        PlaybackService.updateQueue(newQueue, currentIndex);
      },

      removeFromQueue: (index: number) => {
        const { queue, currentIndex } = get();
        if (index < 0 || index >= queue.length) return;

        if (index === currentIndex) return;

        const newQueue = [...queue];
        newQueue.splice(index, 1);

        let newIndex = currentIndex;
        if (index < currentIndex) newIndex--;

        set({ queue: newQueue, currentIndex: newIndex });

        PlaybackService.updateQueue(newQueue, newIndex);
      },

      reorderQueue: (from: number, to: number) => {
        const { queue, originalQueue, currentIndex, isReordering } = get();

        if (isReordering || from === to) return;

        // 1. Update queue order
        const newQueue = [...queue];
        const [movedItem] = newQueue.splice(from, 1);
        newQueue.splice(to, 0, movedItem);

        // 2. Adjust currentIndex if necessary
        let newIndex = currentIndex;
        if (currentIndex === from) {
          newIndex = to;
        } else if (currentIndex > from && currentIndex <= to) {
          newIndex--;
        } else if (currentIndex < from && currentIndex >= to) {
          newIndex++;
        }

        // 3. Update state
        set({
          queue: newQueue,
          currentIndex: newIndex,
          isReordering: true
        });
        
        // 3.5 Set global service lock to prevent race conditions during move
        PlaybackService.setReordering(true);

        // 4. Sync with Native Player using atomic move
        PlaybackService.moveTrack(from, to).finally(async () => {
          // 5. Verification & Repair step: Ensure native index matches JS expectation
          try {
              const TrackPlayer = (await import("@rntp/player")).default;
              const active = await TrackPlayer.getActiveMediaItem();
              const nativeIndex = await TrackPlayer.getActiveMediaItemIndex();
              
              if (active) {
                  const verifiedIndex = newQueue.findIndex(t => t.id === (active as any).id || t.id === (active as any).mediaId);
                  if (verifiedIndex !== -1 && verifiedIndex !== newIndex) {
                      set({ currentIndex: verifiedIndex });
                  }
              }

              // REPAIR: Resolve and push the NEW next track URL to native player immediately
              const repairIndex = (get().currentIndex + 1) % newQueue.length;
              const repairTrack = newQueue[repairIndex];
              if (repairTrack) {
                  const { resolveTrack } = await import("../utils/track-resolver");
                  const resolved = await resolveTrack(repairTrack);
                  if (resolved.url) {
                      PlaybackService.updateMediaItem(repairIndex, resolved);
                  }
              }

          } catch (e) {}

          // Wait for native side to settle before releasing lock
          setTimeout(() => {
            PlaybackService.setReordering(false);
            set({ isReordering: false });
            get().preloadNext(); 
          }, 400); 
        });
      },

      jumpToQueueIndex: async (index: number) => {
        const { queue } = get();
        if (index < 0 || index >= queue.length) return;

        set({ currentIndex: index });
        await get().setTrack(queue[index]);
      },

      play: async () => {
        try {
          await PlaybackService.play();
          set({ isPlaying: true, status: "playing" });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      pause: async () => {
        try {
          await PlaybackService.pause();
          set({ isPlaying: false, status: "paused" });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      togglePlayback: async () => {
        const { isPlaying, status, queue } = get();
        if (isPlaying) {
          await get().pause();
        } else {
          if (status === "idle" && queue.length > 0) {
            await get().setTrack(queue[0]);
          } else {
            await get().play();
          }
        }
      },

      stop: async () => {
        await PlaybackService.stop();
        set({ isPlaying: false, status: "idle", position: 0 });
      },

      next: async () => {
        const { queue, currentIndex, repeatMode, isTransitioning, currentTrack } = get();

        if (queue.length === 0 || isTransitioning) return;

        if (transitionManager.getTransitionState()) return;

        transitionManager.setTransitioning(true);
        set({ isTransitioning: true });

        if (repeatMode === "track" && currentTrack) {
          transitionManager.setTransitioning(false);
          set({ isTransitioning: false });
          await get().seek(0);
          await get().play();
          return;
        }

        let nextIndex = currentIndex + 1;

        if (nextIndex >= queue.length) {
          if (repeatMode === "queue") {
            nextIndex = 0;
          } else {
            transitionManager.setTransitioning(false);
            set({ isTransitioning: false });
            return;
          }
        }

        const nextTrack = queue[nextIndex];
        if (!nextTrack) {
          transitionManager.setTransitioning(false);
          set({ isTransitioning: false });
          return;
        }

        const cachedPreload = transitionManager.getCachedTrack(nextTrack.id);
        const hasUrl = (t: PlayerTrack) => !!(t.url && t.url.length > 10 && !t.url.startsWith('data:'));

        if (nextTrack.isLocal || (cachedPreload && hasUrl(cachedPreload))) {
          // SEAMLESS PATH: Native queue already has the resolved URL
          await PlaybackService.skipToNext();
          return;
        }

        // RESOLUTION PATH: Must resolve and reload queue
        set({ currentIndex: nextIndex });
        await get().setTrack(nextTrack);
      },

      previous: async () => {
        const { queue, currentIndex, position, isTransitioning, repeatMode, currentTrack } = get();
        if (queue.length === 0 || isTransitioning) return;

        if (position > 5000 || repeatMode === "track") {
          await get().seek(0);
          return;
        }

        transitionManager.setTransitioning(true);
        set({ isTransitioning: true });

        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
          if (repeatMode === "queue" && queue.length > 0) {
            prevIndex = queue.length - 1;
          } else {
            transitionManager.setTransitioning(false);
            set({ isTransitioning: false });
            await get().seek(0);
            return;
          }
        }

        const prevTrack = queue[prevIndex];
        if (prevTrack?.isLocal || (prevTrack?.url && prevTrack.url.length > 10 && !prevTrack.url.startsWith('data:'))) {
          // SEAMLESS PATH
          await PlaybackService.skipToPrevious();
          return;
        }

        set({ currentIndex: prevIndex });
        await get().setTrack(queue[prevIndex]);
      },

      seek: async (position: number) => {
        try {
          await PlaybackService.seek(position);
          set({ position });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      setVolume: async (volume: number) => {
        const currentVol = get().volume;
        if (Math.abs(currentVol - volume) < 0.01) return;

        set({ volume });

        const now = Date.now();
        const lastSync = (get() as any)._lastVolumeSync || 0;
        if (now - lastSync < 100) return;

        set({ _lastVolumeSync: now } as any);
        await PlaybackService.setVolume(volume);
      },

      setRepeatMode: (mode: RepeatMode) => {
        PlaybackService.setRepeatMode(mode);
        set({ repeatMode: mode });
      },

      toggleShuffle: () => {
        const { isShuffle, originalQueue, currentTrack } = get();
        const newShuffle = !isShuffle;

        let newQueue = [...originalQueue];
        let newIndex = originalQueue.findIndex((t: PlayerTrack) => t.id === currentTrack?.id);

        if (newShuffle) {
          const otherTracks = originalQueue.filter((t: PlayerTrack) => t.id !== currentTrack?.id);
          for (let i = otherTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
          }
          newQueue = currentTrack ? [currentTrack, ...otherTracks] : otherTracks;
          newIndex = 0;
        }

        set({ isShuffle: newShuffle, queue: newQueue, currentIndex: newIndex });

        PlaybackService.updateQueue(newQueue, newIndex);
      },

      updateProgress: (position: number, duration: number, buffered: number) => {
        const s = get();
        if (Math.abs(s.position - position) > 100 || Math.abs(s.duration - duration) > 100) {
          set({ position, duration, bufferedPosition: buffered });
        }

        if (s.isPlaying && !s.isTransitioning && !s.isPreloading && transitionManager.shouldPreload(position, duration)) {
          const nextIndex = (s.currentIndex + 1) % s.queue.length;
          const nextTrack = s.queue[nextIndex];

          if (nextTrack && nextTrack.id !== s.currentTrack?.id) {
            transitionManager.preloadNextTrack(nextTrack, s.currentTrack?.id || '');
          }
        }
      },

      setStatus: (status: PlaybackStatus) => {
        const currentStatus = get().status;
        if (currentStatus === status) return;

        set({
          status,
          isPlaying: status === "playing",
          isBuffering: status === "buffering",
        });
      },

      clearPreviousTrack: () => {
        set({ previousTrack: null });
      },
    }),
    {
      name: 'aura-player',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentTrack: state.currentTrack,
        originalQueue: state.originalQueue,
        queue: state.queue,
        currentIndex: state.currentIndex,
        position: state.position,
        duration: state.duration,
        volume: state.volume,
        repeatMode: state.repeatMode,
        isShuffle: state.isShuffle,
        activeContext: state.activeContext,
      }),
      onRehydrateStorage: (state) => {
        return (hydratedState, error) => {
          if (!error && hydratedState) {
            hydratedState.setHasHydrated(true);
            hydratedState.setStatus("paused");
          }
        };
      },
    }
  )
);
