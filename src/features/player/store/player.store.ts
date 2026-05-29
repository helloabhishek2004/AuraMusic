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
  isRestoringSession: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  // Playlist-aware playback context
  activeContext: PlaybackContext | null;
  setActiveContext: (context: PlaybackContext | null) => void;
  updateTrackMetadata: (trackId: string, partial: Partial<PlayerTrack>) => void;
  restoreSession: () => Promise<void>;
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
          const { resolveAudioOnly } = await import("../utils/track-resolver");
          const { HydrationScheduler } = await import("../services/hydration.service");
          const { MetadataCache } = await import("../../cache/services/metadata-cache.service");

          const resolvedTrack = await resolveAudioOnly(track);

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
        // Hydrate from cache immediately for responsive UI
        const cacheStore = useMediaCacheStore.getState();
        const hydratedTracks = tracks.map(t => {
            const cached = cacheStore.getCachedTrack(t.id);
            return cached ? { ...t, ...cached.track } : t;
        });

        const activeQueue = [...hydratedTracks];
        const newStartIndex = startIndex;

        set({
          queue: activeQueue,
          originalQueue: [...hydratedTracks],
          currentIndex: newStartIndex,
        });

        await get().setTrack(activeQueue[newStartIndex]);
      },

      playNext: async (track: PlayerTrack) => {
        const { queue, originalQueue, currentIndex } = get();
        
        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(track.id);
        const hydratedTrack = cached ? { ...track, ...cached.track } as PlayerTrack : track;

        try {
          await PlaybackService.insertTrack(currentIndex + 1, hydratedTrack);
          console.info("[PlayerStore] Native insertTrack succeeded");
          
          const newQueue = [...queue];
          newQueue.splice(currentIndex + 1, 0, hydratedTrack);

          const newOriginal = [...originalQueue];
          if (!newOriginal.find(t => t.id === hydratedTrack.id)) {
            newOriginal.push(hydratedTrack);
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
        const { queue, currentIndex } = get();
        if (index < 0 || index >= queue.length) return;

        if (index === currentIndex) return;

        try {
          await PlaybackService.removeTrack(index);
          console.info(`[PlayerStore] Native removeTrack(${index}) succeeded`);

          const newQueue = [...queue];
          newQueue.splice(index, 1);

          let newIndex = currentIndex;
          if (index < currentIndex) newIndex--;

          set({ queue: newQueue, currentIndex: newIndex });
        } catch (e) {
          console.error("[PlayerStore] Native removeFromQueue failed", e);
        }
      },

      reorderQueue: async (from: number, to: number) => {
        const { queue, originalQueue, currentIndex, isReordering } = get();

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
            currentIndex: newIndex,
          });

          // Verification & Repair
          try {
              const TrackPlayer = (await import("@rntp/player")).default;
              const active = await TrackPlayer.getActiveMediaItem();
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

        } catch (e) {
          console.error("[PlayerStore] Native reorderQueue failed", e);
        } finally {
          PlaybackService.setReordering(false);
          set({ isReordering: false });
          get().preloadNext();
        }
      },

      jumpToQueueIndex: async (index: number) => {
        const { queue } = get();
        if (index < 0 || index >= queue.length) return;

        // [Aura_Transition_Hardening] Optimistically update store metadata instantly
        set({
          currentIndex: index,
          currentTrack: queue[index],
          lyrics: null,
          isLyricsLoading: false,
          isTransitioning: true,
          status: "buffering",
          isBuffering: true,
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
        const { queue, isTransitioning, currentIndex } = get();

        if (queue.length === 0 || isTransitioning) return;
        if (transitionManager.getTransitionState()) return;

        const nextIndex = (currentIndex + 1) % queue.length;
        const nextTrack = queue[nextIndex];
        if (nextTrack) {
          // [Aura_Transition_Hardening] Optimistically update store metadata instantly
          set({
            currentIndex: nextIndex,
            currentTrack: nextTrack,
            lyrics: null,
            isLyricsLoading: false,
            isTransitioning: true,
            status: "buffering",
            isBuffering: true,
          });
        }

        try {
          await PlaybackService.skipToNext();
        } catch (e) {
          console.warn("[PlayerStore] Native skipToNext failed:", e);
        }
      },

      previous: async () => {
        const { queue, isTransitioning, position, currentIndex } = get();
        if (queue.length === 0 || isTransitioning) return;

        let posMs = position;
        try {
          const TrackPlayer = require("@rntp/player").default;
          const p = await TrackPlayer.getProgress();
          if (p && p.position) posMs = p.position * 1000;
        } catch(e) {}

        // If we are more than 5 seconds into the track, seeking to 0 is standard behavior
        if (posMs > 5000) {
          await get().seek(0);
          await get().play();
          return;
        }

        const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
        const prevTrack = queue[prevIndex];
        if (prevTrack) {
          // [Aura_Transition_Hardening] Optimistically update store metadata instantly
          set({
            currentIndex: prevIndex,
            currentTrack: prevTrack,
            lyrics: null,
            isLyricsLoading: false,
            isTransitioning: true,
            status: "buffering",
            isBuffering: true,
          });
        }

        try {
          await PlaybackService.skipToPrevious();
        } catch (e) {
          console.warn("[PlayerStore] Native skipToPrevious failed:", e);
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

      toggleShuffle: () => {
        const { isShuffle } = get();
        const newShuffle = !isShuffle;

        PlaybackService.setShuffleMode(newShuffle);
        set({ isShuffle: newShuffle });
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
