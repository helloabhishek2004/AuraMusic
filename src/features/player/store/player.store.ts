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
import { QueueEngine } from "../utils/queue-engine";

interface ExtendedPlayerStore extends PlayerStore {
  isPreloading: boolean;
  isReordering: boolean;
  isRestoringSession: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  // Playlist-aware playback context
  activeContext: PlaybackContext | null;
  setActiveContext: (context: PlaybackContext | null) => void;
  updateTrackMetadata: (trackId: string, partial: Partial<PlayerTrack>) => void;
  restoreSession: () => Promise<void>;
  resolveAutoAdvance: () => Promise<void>;
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
      isRestoringSession: false,
      _lastVolumeSync: 0,
      _transitionGuard: {
        inProgress: false,
        owner: null,
        destinationId: null,
        operationId: 0,
      },

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
               set({ 
                 currentIndex: foundIndex, 
                 currentTrack: store.queue[foundIndex],
                 lyrics: null,
                 isLyricsLoading: false
               });
            }
          }
        } catch (e) {}
      },
      updateTrackMetadata: (trackId: string, partial: Partial<PlayerTrack>) => {
        const { getCanonicalTrackId } = require("../utils/track-identity");
        const state = get();
        
        const matchesTrack = (track: PlayerTrack) => {
          return track.id === trackId || getCanonicalTrackId(track) === trackId;
        };

        // 1. Update track in queue if it exists
        let queueChanged = false;
        const newQueue = state.queue.map(track => {
          if (matchesTrack(track)) {
            let changed = false;
            for (const key of Object.keys(partial)) {
              if ((track as any)[key] !== (partial as any)[key]) {
                changed = true;
                break;
              }
            }
            if (changed) {
              queueChanged = true;
              return { ...track, ...partial };
            }
          }
          return track;
        });

        // 2. Update track in originalQueue if it exists
        let originalChanged = false;
        const newOriginal = state.originalQueue.map(track => {
          if (matchesTrack(track)) {
            let changed = false;
            for (const key of Object.keys(partial)) {
              if ((track as any)[key] !== (partial as any)[key]) {
                changed = true;
                break;
              }
            }
            if (changed) {
              originalChanged = true;
              return { ...track, ...partial };
            }
          }
          return track;
        });

        // 3. Update currentTrack if it matches
        let currentChanged = false;
        let newCurrent = state.currentTrack;
        if (state.currentTrack && matchesTrack(state.currentTrack)) {
          let changed = false;
          for (const key of Object.keys(partial)) {
            if ((state.currentTrack as any)[key] !== (partial as any)[key]) {
              changed = true;
              break;
            }
          }
          if (changed) {
            currentChanged = true;
            newCurrent = { ...state.currentTrack, ...partial };
          }
        }

        if (queueChanged || originalChanged || currentChanged) {
          const updates: Partial<ExtendedPlayerStore> = {};
          if (queueChanged) updates.queue = newQueue;
          if (originalChanged) updates.originalQueue = newOriginal;
          if (currentChanged) updates.currentTrack = newCurrent;
          set(updates);

          // 4. Mirror to native media item if it's the currently playing track
          if (currentChanged) {
            PlaybackService.updateMetadata(state.currentIndex, partial);
          }
        }
      },

      // Actions
      setTrack: async (track: PlayerTrack) => {

        const resolutionId = ++get().lastResolutionId;
        const currentTrack = get().currentTrack;
        const guard = get()._transitionGuard;

        if (currentTrack?.id === track.id && get().status === "playing" && !get().isTransitioning) {
          transitionManager.setTransitioning(false);
          return;
        }

        set({
          _transitionGuard: { ...guard, inProgress: true, owner: "setTrack", destinationId: track.id, operationId: guard.operationId + 1 },
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
          const { resolveAudioOnly } = await import("../utils/track-resolver");
          const { HydrationScheduler } = await import("../services/hydration.service");
          const { MetadataCache } = await import("../../cache/services/metadata-cache.service");

          const resolvedTrack = await resolveAudioOnly(track, null, true);

          if (get().lastResolutionId !== resolutionId) {
            transitionManager.setTransitioning(false);
            set({ isTransitioning: false });
            return;
          }

          // Instantly patch from hot cache if available
          const hotCache = MetadataCache.getHotEntry(resolvedTrack);
          if (hotCache) {
             if (hotCache.lyrics) set({ lyrics: hotCache.lyrics });
             resolvedTrack.albumId = hotCache.albumId || resolvedTrack.albumId;
             resolvedTrack.art = hotCache.artwork || resolvedTrack.art;
             resolvedTrack.album = hotCache.album || resolvedTrack.album;
          }

          // Trigger progressive hydration in background
          HydrationScheduler.scheduleHydration(resolvedTrack);

          await PlaybackService.loadTrack(resolvedTrack, get().queue, get().currentIndex);

          const resolvedGuard = get()._transitionGuard;
          set({
            currentTrack: resolvedTrack,
            status: "playing",
            isPlaying: true,
            isBuffering: false,
            isTransitioning: false,
            preloadedTrack: null,
            _transitionGuard: { ...resolvedGuard, inProgress: false, owner: null, destinationId: null }
          });

          transitionManager.setTransitioning(false);
          transitionManager.clearCache([resolvedTrack.id]);

          get().preloadNext();

        } catch (error) {
          if (get().lastResolutionId === resolutionId) {
            transitionManager.setTransitioning(false);
            const errGuard = get()._transitionGuard;
            set({
              status: "error",
              error: (error as Error).message || "Playback failed",
              isPlaying: false,
              isBuffering: false,
              isTransitioning: false,
              _transitionGuard: { ...errGuard, inProgress: false, owner: null, destinationId: null }
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
        const { getCanonicalTrackId } = require("../utils/track-identity");
        const canonicalId = getCanonicalTrackId(track);
        
        // Use cache first (including negative cache)
        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(canonicalId) || cacheStore.getCachedTrack(track.id);
        if (cached?.lyrics) {
            if (cached.lyrics.unavailable === true) {
                const NEGATIVE_CACHE_TTL = 60 * 60 * 1000;
                const age = Date.now() - (cached.lyrics.cachedAt || 0);
                if (age < NEGATIVE_CACHE_TTL) {
                    set({ lyrics: null, isLyricsLoading: false });
                    return;
                }
            } else {
                const { parseLyricsData } = require("../utils/lyrics-parser");
                const parsed = parseLyricsData(cached.lyrics);
                set({ lyrics: parsed, isLyricsLoading: false });
                return;
            }
        }

        set({ isLyricsLoading: true, lyrics: null });
        try {
          const { lyricsService } = require("../../lyrics/services/lyrics.service");
          const response = await lyricsService.fetchLyrics(
            track.id,
            track.title,
            track.artist,
            track.duration
          );
          
          let parsed = null;
          if (response && response.unavailable !== true) {
              const { parseLyricsData } = require("../utils/lyrics-parser");
              parsed = parseLyricsData(response);
          }
          
          const activeTrack = get().currentTrack;
          if (activeTrack && getCanonicalTrackId(activeTrack) === canonicalId) {
            set({ lyrics: parsed, isLyricsLoading: false });
          }
        } catch (error) {
          const activeTrack = get().currentTrack;
          if (activeTrack && getCanonicalTrackId(activeTrack) === canonicalId) {
            set({ isLyricsLoading: false, lyrics: null });
          }
        }
      },

      preloadNext: async () => {
        const { queue, currentIndex, preloadedTrack, isPreloading, currentTrack, repeatMode } = get();
        if (queue.length === 0 || isPreloading || !currentTrack) return;

        // Level 2 Preload: background metadata enrichment for the next 10 tracks
        try {
          const { HydrationScheduler } = await import("../services/hydration.service");
          for (let i = 1; i <= 10; i++) {
            const idx = (currentIndex + i) % queue.length;
            const track = queue[idx];
            if (track && track.id !== currentTrack.id) {
              HydrationScheduler.scheduleHydration(track);
            }
          }
        } catch (e) {
          console.warn("[PlayerStore] Level 2 preload failed:", e);
        }

        const nextIndex = QueueEngine.resolvePreloadIndex(currentIndex, queue.length, repeatMode);
        if (nextIndex === -1) return;
        
        const nextTrack = queue[nextIndex];
        if (!nextTrack) return;
        
        // Predictive metadata enrichment for next track
        const { TrackOrchestrator } = await import("../services/track-orchestrator");
        TrackOrchestrator.prefetchMetadata(nextTrack);

        // [Aura_Preload_Fix] Always push resolved URL to native player.
        // Check preloadedTrack (store-level cache), then transitionManager cache.
        if (preloadedTrack && preloadedTrack.id === nextTrack.id) {
          PlaybackService.updateMediaItem(nextIndex, preloadedTrack);
          return;
        }

        const cachedFromManager = transitionManager.getCachedTrack(nextTrack.id);
        if (cachedFromManager) {
          PlaybackService.updateMediaItem(nextIndex, cachedFromManager);
          const newQueue = [...get().queue];
          newQueue[nextIndex] = cachedFromManager;
          set({ queue: newQueue });
          return;
        }

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

          // [Aura_Preload_Fix] Preload multiple tracks ahead for skip resilience
          const secondIndex = QueueEngine.resolvePreloadIndex(nextIndex, queue.length, repeatMode);
          if (secondIndex !== -1 && secondIndex !== nextIndex && queue[secondIndex]) {
            const secondTrack = queue[secondIndex];
            transitionManager.preloadSecondaryTrack(secondTrack, currentTrack.id);
            // Push second track's cached URL to native if already resolved
            const cachedSecond = transitionManager.getCachedTrack(secondTrack.id);
            if (cachedSecond) {
              PlaybackService.updateMediaItem(secondIndex, cachedSecond);
              newQueue[secondIndex] = cachedSecond;
            }
          }
          const thirdIndex = secondIndex !== -1
            ? QueueEngine.resolvePreloadIndex(secondIndex, queue.length, repeatMode)
            : -1;
          if (thirdIndex !== -1 && thirdIndex !== secondIndex && thirdIndex !== nextIndex && queue[thirdIndex]) {
            const thirdTrack = queue[thirdIndex];
            transitionManager.preloadSecondaryTrack(thirdTrack, currentTrack.id);
            const cachedThird = transitionManager.getCachedTrack(thirdTrack.id);
            if (cachedThird) {
              PlaybackService.updateMediaItem(thirdIndex, cachedThird);
              newQueue[thirdIndex] = cachedThird;
            }
          }
          if (secondIndex !== -1 || thirdIndex !== -1) {
            set({ queue: newQueue });
          }
        } else {
          set({ isPreloading: false });
        }
      },

      setQueue: async (tracks: PlayerTrack[], startIndex: number = 0) => {
        // Hydrate from cache immediately for responsive UI
        const cacheStore = useMediaCacheStore.getState();
        const hydratedTracks = tracks.map(t => {
            const cached = cacheStore.getCachedTrack(t.id);
            return cached ? { ...t, ...cached.track } : t;
        });

        const original = [...hydratedTracks];
        const isShuffle = get().isShuffle;

        let activeQueue = [...original];
        let targetIndex = startIndex;

        if (isShuffle && original.length > 0) {
          const startingTrack = original[startIndex];
          if (startingTrack) {
            const remainingTracks = original.filter((_, idx) => idx !== startIndex);
            const shuffledRemaining = [...remainingTracks].sort(() => Math.random() - 0.5);
            activeQueue = [startingTrack, ...shuffledRemaining];
            targetIndex = 0;
          }
        }

        // [Aura_Queue_Fix] Invalidate and clean up unused preloaded track cache entries when queue changes
        transitionManager.clearCache();

        set({
          queue: activeQueue,
          originalQueue: original,
          currentIndex: targetIndex,
        });

        await get().setTrack(activeQueue[targetIndex]);
      },

      playNext: async (track: PlayerTrack) => {
        const { queue, originalQueue, currentIndex, isShuffle } = get();
        
        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(track.id);
        const hydratedTrack = cached ? { ...track, ...cached.track } as PlayerTrack : track;

        try {
          await PlaybackService.insertTrack(currentIndex + 1, hydratedTrack);
          console.info("[PlayerStore] Native insertTrack succeeded");
          
          const newQueue = [...queue];
          newQueue.splice(currentIndex + 1, 0, hydratedTrack);

          // [Aura_Queue_Fix] When shuffle is OFF, insert in originalQueue at the
          // matching position (after the current track). When shuffle is ON, append.
          let newOriginal: PlayerTrack[];
          if (!isShuffle) {
            newOriginal = [...originalQueue];
            const currentOrigIdx = newOriginal.findIndex(t => t.id === queue[currentIndex]?.id);
            if (currentOrigIdx !== -1 && !newOriginal.find(t => t.id === hydratedTrack.id)) {
              newOriginal.splice(currentOrigIdx + 1, 0, hydratedTrack);
            } else if (!newOriginal.find(t => t.id === hydratedTrack.id)) {
              newOriginal.push(hydratedTrack);
            }
          } else {
            newOriginal = [...originalQueue];
            if (!newOriginal.find(t => t.id === hydratedTrack.id)) {
              newOriginal.push(hydratedTrack);
            }
          }

          set({ queue: newQueue, originalQueue: newOriginal });
        } catch (e) {
          console.error("[PlayerStore] Native playNext failed", e);
        }
      },

      addToQueue: async (track: PlayerTrack) => {
        const { queue, originalQueue } = get();

        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(track.id);
        const hydratedTrack = cached ? { ...track, ...cached.track } as PlayerTrack : track;

        try {
          await PlaybackService.addTrack(hydratedTrack);
          console.info("[PlayerStore] Native addTrack succeeded");

          const newQueue = [...queue, hydratedTrack];
          const newOriginal = [...originalQueue];
          if (!newOriginal.find(t => t.id === hydratedTrack.id)) {
            newOriginal.push(hydratedTrack);
          }

          set({ queue: newQueue, originalQueue: newOriginal });
        } catch (e) {
          console.error("[PlayerStore] Native addToQueue failed", e);
        }
      },

      removeFromQueue: async (index: number) => {
        const { queue, originalQueue, currentIndex } = get();
        if (index < 0 || index >= queue.length) return;

        if (index === currentIndex) return;

        const removedTrack = queue[index];

        try {
          await PlaybackService.removeTrack(index);
          console.info(`[PlayerStore] Native removeTrack(${index}) succeeded`);

          const newQueue = [...queue];
          newQueue.splice(index, 1);

          // [Aura_Queue_Fix] Always remove from originalQueue too to prevent
          // stale tracks from reappearing when shuffle is turned off.
          const newOriginal = [...originalQueue];
          const origIdx = newOriginal.findIndex(t => t.id === removedTrack.id);
          if (origIdx !== -1) {
            newOriginal.splice(origIdx, 1);
          }

          let newIndex = currentIndex;
          if (index < currentIndex) newIndex--;

          set({ queue: newQueue, originalQueue: newOriginal, currentIndex: newIndex });
        } catch (e) {
          console.error("[PlayerStore] Native removeFromQueue failed", e);
        }
      },

      reorderQueue: async (from: number, to: number) => {
        const { queue, originalQueue, currentIndex, isReordering, isShuffle } = get();

        if (isReordering || from === to) return;
        set({ isReordering: true });
        PlaybackService.setReordering(true);

        try {
          // 1. Sync with Native Player natively first (Authority)
          await PlaybackService.moveTrack(from, to);
          console.info(`[PlayerStore] Native moveTrack(${from}, ${to}) succeeded`);

          // 2. Mirror into Zustand atomically only after native success
          const newQueue = [...queue];
          const [movedItem] = newQueue.splice(from, 1);
          newQueue.splice(to, 0, movedItem);

          // [Aura_Queue_Fix] When shuffle is OFF, keep originalQueue in sync with user reorder.
          // When shuffle is ON, the shuffle order is temporary; originalQueue stays as-is.
          let newOriginal = originalQueue;
          if (!isShuffle) {
            newOriginal = [...originalQueue];
            const origFrom = newOriginal.findIndex(t => t.id === movedItem.id);
            if (origFrom !== -1) {
              const [origItem] = newOriginal.splice(origFrom, 1);
              const origTo = Math.min(to, newOriginal.length);
              newOriginal.splice(origTo, 0, origItem);
            }
          }

          let newIndex = currentIndex;
          if (currentIndex === from) {
            newIndex = to;
          } else if (currentIndex > from && currentIndex <= to) {
            newIndex--;
          } else if (currentIndex < from && currentIndex >= to) {
            newIndex++;
          }

          set({
            queue: newQueue,
            originalQueue: newOriginal,
            currentIndex: newIndex,
          });

          // Verification & Repair
          try {
              const TrackPlayer = (await import("@rntp/player")).default;
              const active = await TrackPlayer.getActiveMediaItem();
              if (active) {
                  const verifiedIndex = newQueue.findIndex(t => t.id === (active as any).id || t.id === (active as any).mediaId);
                  if (verifiedIndex !== -1 && verifiedIndex !== get().currentIndex) {
                      set({ currentIndex: verifiedIndex });
                  }
              }

              // REPAIR: Resolve and push the next track URL (don't wrap at end)
              const currentIdx = get().currentIndex;
              if (currentIdx < newQueue.length - 1) {
                  const repairIndex = currentIdx + 1;
                  const repairTrack = newQueue[repairIndex];
                  if (repairTrack) {
                      const { resolveTrack } = await import("../utils/track-resolver");
                      const resolved = await resolveTrack(repairTrack);
                      if (resolved.url) {
                          PlaybackService.updateMediaItem(repairIndex, resolved);
                      }
                  }
              }
          } catch (e) {}

        } catch (e) {
          console.error("[PlayerStore] Native reorderQueue failed", e);
        } finally {
          PlaybackService.setReordering(false);
          set({ isReordering: false });
          // [Aura_Queue_Fix] Queue topology changed — all preload assumptions are invalid.
          // Invalidate every cached preload so the rebuild starts from fresh resolutions.
          transitionManager.clearCache();
          get().preloadNext();
        }
      },

      jumpToQueueIndex: async (index: number) => {
        const { queue, _transitionGuard } = get();
        if (index < 0 || index >= queue.length) return;

        set({
          currentIndex: index,
          currentTrack: queue[index],
          lyrics: null,
          isLyricsLoading: false,
          isTransitioning: true,
          status: "buffering",
          isBuffering: true,
          _transitionGuard: { ..._transitionGuard, inProgress: true, owner: "jump", destinationId: queue[index].id, operationId: _transitionGuard.operationId + 1 }
        });
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
        const { queue, repeatMode } = get();
        if (queue.length === 0) return;

        // Increment resolution ID to cancel any in-flight skips
        const resolutionId = ++get().lastResolutionId;

        // Calculate next index based on the store's current (possibly optimistic) index
        const currentIndex = get().currentIndex;
        const nextIndex = QueueEngine.getNextIndex(currentIndex, queue.length, repeatMode);
        if (nextIndex === -1) {
          await get().stop();
          return;
        }

        const nextTrack = queue[nextIndex];
        const guard = get()._transitionGuard;

        // Optimistically update the store state immediately to reflect the skip in UI
        set({
          currentIndex: nextIndex,
          currentTrack: nextTrack,
          status: "buffering",
          isBuffering: true,
          isTransitioning: true,
          position: 0,
          lyrics: null,
          error: null,
          _transitionGuard: { 
            ...guard, 
            inProgress: true, 
            owner: "skip", 
            destinationId: nextTrack.id, 
            operationId: guard.operationId + 1 
          }
        });

        let resolved = nextTrack;
        try {
          // Resolve target URL with retry before skipping.
          if (!nextTrack.isLocal) {
            const { isResolvedUrl, resolveAudioOnly } = await import("../utils/track-resolver");
            if (!isResolvedUrl(nextTrack.url)) {
              const delays = [500, 1000, 2000];
              for (let attempt = 0; attempt <= delays.length; attempt++) {
                // Abort if superseded
                if (get().lastResolutionId !== resolutionId) return;

                try {
                  const r = await resolveAudioOnly(attempt === 0 ? nextTrack : resolved, null, true);
                  if (r && r.url && isResolvedUrl(r.url)) {
                    resolved = r;
                    break;
                  }
                } catch (e) {
                  if (attempt < delays.length) {
                    console.warn(`[PlayerStore] next resolve attempt ${attempt + 1}/${delays.length + 1} failed, retrying in ${delays[attempt]}ms`);
                    await new Promise(r => setTimeout(r, delays[attempt]));
                  }
                }
              }

              // Abort if superseded
              if (get().lastResolutionId !== resolutionId) return;

              if (!isResolvedUrl(resolved.url)) {
                const failGuard = get()._transitionGuard;
                set({
                  isTransitioning: false,
                  error: "Unable to load track. Tap to retry.",
                  _transitionGuard: { ...failGuard, inProgress: false, owner: null, destinationId: null }
                });
                return;
              }

              // Update the queue in the store with the resolved track
              const updatedQueue = [...get().queue];
              const resolvedIdx = updatedQueue.findIndex(t => t.id === resolved.id);
              if (resolvedIdx !== -1) {
                updatedQueue[resolvedIdx] = resolved;
                set({ queue: updatedQueue });
              }
            }
          }

          // Abort if superseded
          if (get().lastResolutionId !== resolutionId) return;

          // Mirror the resolved track natively before skipping
          await PlaybackService.updateMediaItem(nextIndex, resolved);

          // Abort if superseded
          if (get().lastResolutionId !== resolutionId) return;

          await PlaybackService.skipToNext();

          // Reset transition guard upon successful skipping
          const finalGuard = get()._transitionGuard;
          set({
            isTransitioning: false,
            _transitionGuard: { ...finalGuard, inProgress: false, owner: null, destinationId: null }
          });

          // Trigger preloading for the next songs
          get().preloadNext();
        } catch (e) {
          console.warn("[PlayerStore] skipToNext failed:", e);
          if (get().lastResolutionId === resolutionId) {
            const failGuard = get()._transitionGuard;
            set({ isTransitioning: false, _transitionGuard: { ...failGuard, inProgress: false, owner: null, destinationId: null } });
          }
        }
      },

      previous: async () => {
        const { queue, repeatMode } = get();
        if (queue.length === 0) return;

        let posMs = get().position;
        try {
          const TrackPlayer = require("@rntp/player").default;
          const p = await TrackPlayer.getProgress();
          if (p && p.position) posMs = p.position * 1000;
        } catch(e) {}

        if (posMs > 3000) {
          await get().seek(0);
          await get().play();
          return;
        }

        // Increment resolution ID to cancel any in-flight skips
        const resolutionId = ++get().lastResolutionId;

        // Calculate previous index based on the store's current (possibly optimistic) index
        const currentIndex = get().currentIndex;
        const prevIndex = QueueEngine.getPreviousIndex(currentIndex, queue.length, repeatMode);
        if (prevIndex === -1) {
          await get().seek(0);
          await get().play();
          return;
        }

        const prevTrack = queue[prevIndex];
        const guard = get()._transitionGuard;

        // Optimistically update the store state immediately to reflect the skip in UI
        set({
          currentIndex: prevIndex,
          currentTrack: prevTrack,
          status: "buffering",
          isBuffering: true,
          isTransitioning: true,
          position: 0,
          lyrics: null,
          error: null,
          _transitionGuard: { 
            ...guard, 
            inProgress: true, 
            owner: "previous", 
            destinationId: prevTrack.id, 
            operationId: guard.operationId + 1 
          }
        });

        let resolved = prevTrack;
        try {
          // Resolve target URL with retry before skipping.
          if (!prevTrack.isLocal) {
            const { isResolvedUrl, resolveAudioOnly } = await import("../utils/track-resolver");
            if (!isResolvedUrl(prevTrack.url)) {
              const delays = [500, 1000, 2000];
              for (let attempt = 0; attempt <= delays.length; attempt++) {
                // Abort if superseded
                if (get().lastResolutionId !== resolutionId) return;

                try {
                  const r = await resolveAudioOnly(attempt === 0 ? prevTrack : resolved, null, true);
                  if (r && r.url && isResolvedUrl(r.url)) {
                    resolved = r;
                    break;
                  }
                } catch (e) {
                  if (attempt < delays.length) {
                    console.warn(`[PlayerStore] previous resolve attempt ${attempt + 1}/${delays.length + 1} failed, retrying in ${delays[attempt]}ms`);
                    await new Promise(r => setTimeout(r, delays[attempt]));
                  }
                }
              }

              // Abort if superseded
              if (get().lastResolutionId !== resolutionId) return;

              if (!isResolvedUrl(resolved.url)) {
                const failGuard = get()._transitionGuard;
                set({
                  isTransitioning: false,
                  error: "Unable to load track. Tap to retry.",
                  _transitionGuard: { ...failGuard, inProgress: false, owner: null, destinationId: null }
                });
                return;
              }

              // Update the queue in the store with the resolved track
              const updatedQueue = [...get().queue];
              const resolvedIdx = updatedQueue.findIndex(t => t.id === resolved.id);
              if (resolvedIdx !== -1) {
                updatedQueue[resolvedIdx] = resolved;
                set({ queue: updatedQueue });
              }
            }
          }

          // Abort if superseded
          if (get().lastResolutionId !== resolutionId) return;

          // Mirror the resolved track natively before skipping
          await PlaybackService.updateMediaItem(prevIndex, resolved);

          // Abort if superseded
          if (get().lastResolutionId !== resolutionId) return;

          await PlaybackService.skipToPrevious();

          // Reset transition guard upon successful skipping
          const finalGuard = get()._transitionGuard;
          set({
            isTransitioning: false,
            _transitionGuard: { ...finalGuard, inProgress: false, owner: null, destinationId: null }
          });

          // Trigger preloading for the next songs
          get().preloadNext();
        } catch (e) {
          console.warn("[PlayerStore] skipToPrevious failed:", e);
          if (get().lastResolutionId === resolutionId) {
            const failGuard = get()._transitionGuard;
            set({ isTransitioning: false, _transitionGuard: { ...failGuard, inProgress: false, owner: null, destinationId: null } });
          }
        }
      },

      resolveAutoAdvance: async () => {
        const { queue, currentIndex, repeatMode, isTransitioning, currentTrack, _transitionGuard } = get();
        console.info(`[AutoAdvance]
 repeat=${repeatMode}
 currentIndex=${currentIndex}
 currentTrack=${currentTrack?.title}`);
        if (queue.length === 0 || isTransitioning) return;

        const nextIndex = QueueEngine.resolveAutoAdvance(currentIndex, queue.length, repeatMode);
        console.info(`[AutoAdvance] nextIndex=${nextIndex} mode=${repeatMode === 'track' ? 'RELOAD' : repeatMode === 'queue' ? 'WRAP' : 'ADVANCE'}`);
        if (nextIndex === -1) {
          await get().stop();
          return;
        }

        if (repeatMode === 'track' && currentTrack) {
          set({
            isTransitioning: true,
            position: 0,
            _transitionGuard: { ..._transitionGuard, inProgress: true, owner: "autoAdvance", destinationId: currentTrack.id, operationId: _transitionGuard.operationId + 1 }
          });
          try {
            await get().setTrack(currentTrack);
          } catch (e) {
            console.warn("[PlayerStore] resolveAutoAdvance track-repeat reload failed:", e);
            const failGuard = get()._transitionGuard;
            set({ isTransitioning: false, _transitionGuard: { ...failGuard, inProgress: false, owner: null, destinationId: null } });
          }
          return;
        }

        const nextTrack = queue[nextIndex];
        set({
          isTransitioning: true,
          _transitionGuard: { ..._transitionGuard, inProgress: true, owner: "autoAdvance", destinationId: nextTrack.id, operationId: _transitionGuard.operationId + 1 }
        });
        try {
          await PlaybackService.skipToNext();
        } catch (e) {
          console.warn("[PlayerStore] resolveAutoAdvance skipToNext failed:", e);
          const failGuard = get()._transitionGuard;
          set({ isTransitioning: false, _transitionGuard: { ...failGuard, inProgress: false, owner: null, destinationId: null } });
        }
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

      toggleRepeatMode: () => {
        const { repeatMode } = get();
        let newMode: RepeatMode = "off";
        if (repeatMode === "off") newMode = "queue";
        else if (repeatMode === "queue") newMode = "track";
        else if (repeatMode === "track") newMode = "off";

        PlaybackService.setRepeatMode(newMode);
        set({ repeatMode: newMode });
      },

      toggleShuffle: async () => {
        const { isShuffle, queue, originalQueue, currentTrack } = get();
        const newShuffle = !isShuffle;

        if (!currentTrack || queue.length === 0) {
          set({ isShuffle: newShuffle });
          return;
        }

        // [Aura_Shuffle_Fix] Freshly resolve current track URL before rebuilding
        // native queue. The current track's native media item gets replaced during
        // updateQueue — if its URL is stale, the native player will emit a source
        // error before JS can intervene.
        const { isResolvedUrl, resolveAudioOnly } = await import("../utils/track-resolver");
        let freshCurrent = currentTrack;
        if (!currentTrack.isLocal) {
          try {
            const resolved = await resolveAudioOnly({ ...currentTrack, url: "" }, null, true);
            if (resolved && resolved.url) {
              freshCurrent = resolved;
            }
          } catch (e) {
            console.warn("[PlayerStore] Shuffle pre-resolve failed, using existing URL", e);
          }
        }

        if (newShuffle) {
          // Shuffle ON
          const shuffledQueue = QueueEngine.buildShuffledQueue(queue, freshCurrent);
          // Replace current track in queue with freshly resolved version
          const resolvedQueue = shuffledQueue.map(t => t.id === freshCurrent.id ? freshCurrent : t);

          set({
            isShuffle: newShuffle,
            queue: resolvedQueue,
            currentIndex: 0,
            currentTrack: freshCurrent,
          });

          // Mirror the shuffled queue natively (current track is stable anchor at index 0)
          await PlaybackService.updateQueue(resolvedQueue, 0);
        } else {
          // Shuffle OFF
          const { queue: restoredQueue, restoredIndex } = QueueEngine.restoreOriginalQueue(
            originalQueue,
            freshCurrent
          );
          // Replace current track in queue with freshly resolved version
          const resolvedQueue = restoredQueue.map(t => t.id === freshCurrent.id ? freshCurrent : t);

          set({
            isShuffle: newShuffle,
            queue: resolvedQueue,
            currentIndex: restoredIndex,
            currentTrack: freshCurrent,
          });

          // Mirror restored sequential queue natively keeping current track active
          await PlaybackService.updateQueue(resolvedQueue, restoredIndex);
        }
      },

      updateProgress: (position: number, duration: number, buffered: number) => {
        const s = get();
        if (Math.abs(s.position - position) > 100 || Math.abs(s.duration - duration) > 100) {
          set({ position, duration, bufferedPosition: buffered });
        }

        // Handle Crossfade / Fade logic
        const { useSettingsStore } = require("../../settings/store/settings.store");
        const settings = useSettingsStore.getState();

        if (settings.crossfadeEnabled && duration > 0) {
          const remainingSeconds = (duration - position) / 1000;
          const currentSeconds = position / 1000;
          
          // FADE OUT
          if (remainingSeconds <= settings.crossfadeDuration && remainingSeconds > 0) {
             const targetVol = s.volume * (remainingSeconds / settings.crossfadeDuration);
             PlaybackService.setVolume(targetVol);
             
             if (remainingSeconds < 0.5 && !s.isTransitioning) {
                 if (typeof __DEV__ !== "undefined" && __DEV__) {
                     console.info(`[CROSSFADE] Fading out: ${s.currentTrack?.title}. Remaining: ${remainingSeconds.toFixed(1)}s`);
                 }
             }
          } 
          // FADE IN
          else if (currentSeconds <= 1.0) {
             const targetVol = s.volume * currentSeconds;
             PlaybackService.setVolume(targetVol);
          }
          // SUSTAIN
          else if (s.status === 'playing') {
             PlaybackService.setVolume(s.volume);
          }
        }

        if (s.isPlaying && !s.isTransitioning && !s.isPreloading && transitionManager.shouldPreload(position, duration)) {
          const nextIndex = QueueEngine.resolvePreloadIndex(s.currentIndex, s.queue.length, s.repeatMode);
          if (nextIndex !== -1) {
            const nextTrack = s.queue[nextIndex];
            if (nextTrack && nextTrack.id !== s.currentTrack?.id) {
              transitionManager.preloadNextTrack(nextTrack, s.currentTrack?.id || '');
            }
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

      restoreSession: async () => {
        if (get().isRestoringSession) return;
        set({ isRestoringSession: true });

        const { currentTrack, queue, currentIndex, position, volume, repeatMode } = get();
        if (currentTrack && queue.length > 0) {
           console.info("[PlayerStore] Restoring session natively...");
           try {
             // Let PlaybackService handle the silent queue injection
             const { PlaybackService } = await import("../services/playback.service");
             
             // Use updateQueue instead of loadTrack so it doesn't auto-play
             await PlaybackService.updateQueue(queue, currentIndex);
             
             if (position > 0) {
               await PlaybackService.seek(position);
             }
             if (volume !== undefined) {
               await PlaybackService.setVolume(volume);
             }
             if (repeatMode) {
               PlaybackService.setRepeatMode(repeatMode);
             }

             // Explicitly force pause to guarantee that the music does not auto-play on app start.
             const TrackPlayer = (await import("@rntp/player")).default;
             await TrackPlayer.pause();
             set({ isPlaying: false, status: "paused" });
             
             console.info("[PlayerStore] Session restored in paused state at position:", position);
           } catch (e) {
             console.error("[PlayerStore] Failed to restore session", e);
           }
        }
        set({ isRestoringSession: false });
      },
    }),
    {
      name: 'aura-player',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        // Grab real position from RNTP natively right before saving (AppState backgrounding triggers saves usually, or periodic debounce)
        try {
          const TrackPlayer = require("@rntp/player").default;
          if (state.isPlaying) {
            const p = TrackPlayer.getProgress();
            if (p && p.position) state.position = p.position * 1000;
          }
        } catch(e) {}
        
        return {
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
        };
      },
      onRehydrateStorage: (state) => {
        return (hydratedState, error) => {
          if (!error && hydratedState) {
            hydratedState.setHasHydrated(true);
            hydratedState.setStatus("paused");
            hydratedState.isPlaying = false;
            // Restore session asynchronously
            setTimeout(() => {
              hydratedState.restoreSession();
            }, 1000);
          }
        };
      },
    }
  )
);
