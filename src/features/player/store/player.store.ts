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
import { QueueContext } from "../services/queue-intelligence";
import { ensurePlayableTrack } from '../services/source-authority';
import { HydrationScheduler } from '../services/hydration.service';
import { MetadataCache } from '../../cache/services/metadata-cache.service';
import { isResolvedUrl, resolveAudioOnly } from '../utils/track-resolver';
import { validateTrackSource } from '../services/source-validator';
import { isSourceStale } from '../services/source-freshness-policy';
import { useTelemetryStore } from './telemetry.store';
import { useSourceHealthStore } from './source-health.store';
import { QueueRepairService } from '../services/queue-repair.service';

interface ExtendedPlayerStore extends PlayerStore {
  isPreloading: boolean;
  isReordering: boolean;
  isRestoringSession: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  activeContext: PlaybackContext | null;
  setActiveContext: (context: PlaybackContext | null) => void;
  updateTrackMetadata: (trackId: string, partial: Partial<PlayerTrack>) => void;
  restoreSession: () => Promise<void>;
  resolveAutoAdvance: () => Promise<void>;
  setShuffle: (shuffle: boolean) => Promise<void>;

  selectedTrackId?: string | null;
  selectedTrackIndex?: number | null;
  sourceArtistId?: string | null;
}

export const usePlayerStore = create<any>()(
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
    _hasHydrated: true,
      queueContext: null,
      selectedTrackId: null,
      selectedTrackIndex: null,
      sourceArtistId: null,

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
        // Handled natively via onPlaybackStateChanged / onTrackChanged
      },

      updateTrackMetadata: (trackId: string, partial: Partial<PlayerTrack>) => {
        const { getCanonicalTrackId } = require("../utils/track-identity");
        const state = get();
        
        const matchesTrack = (track: PlayerTrack) => {
          return track.id === trackId || getCanonicalTrackId(track) === trackId;
        };

        // 1. Update track in queue if it exists
        let queueChanged = false;
        const newQueue = state.queue.map((track: PlayerTrack) => {
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
        const newOriginal = state.originalQueue.map((track: PlayerTrack) => {
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

      setQueue: async (tracks: PlayerTrack[], startIndex: number = 0, context?: any) => {
        if (!tracks || tracks.length === 0) return;
        
        const currentTrack = tracks[startIndex];
        if (!currentTrack) return;

        const guard = get()._transitionGuard;
        set({
          queue: tracks,
          originalQueue: tracks,
          currentIndex: startIndex,
          currentTrack: currentTrack,
          status: "buffering",
          isBuffering: true,
          isPlaying: false,
          position: 0,
          lyrics: null,
          error: null,
          selectedTrackId: currentTrack.id,
          selectedTrackIndex: startIndex,
          queueContext: context || null,
          _transitionGuard: { ...guard, inProgress: true, owner: "user", destinationId: currentTrack.id, operationId: String(Number(guard.operationId || 0) + 1) }
        });

        try {
          await PlaybackService.loadTrack(currentTrack, tracks, startIndex);
        } catch (error) {
          console.error("[PlayerStore] setQueue native load failed:", error);
          set({ error: "Failed to load queue" });
        }
      },

      setTrack: async (track: PlayerTrack) => {
        if (!track) {
          return;
        }
        if (!track.id) {
          throw new Error("Queue target track missing");
        }

        const resolutionId = ++get().lastResolutionId;
        const currentTrack = get().currentTrack;
        const guard = get()._transitionGuard;

        if (currentTrack?.id === track.id && get().status === "playing" && !get().isTransitioning) {
          transitionManager.setTransitioning(false);
          return;
        }

        set({
          _transitionGuard: { ...guard, inProgress: true, owner: "setTrack", destinationId: track.id, operationId: String(Number(guard.operationId || 0) + 1) },
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

        // Immediately pause native playback so the old track stops playing while we resolve the new source
        try {
          PlaybackService.pause();
        } catch (e) {
          console.warn("[PlayerStore] Failed to pause native player on track change:", e);
        }

        try {
          const resolvedTrack = track; // Bypassed JS resolution

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
            isTransitioning: false,
            preloadedTrack: null,
            _transitionGuard: { ...resolvedGuard, inProgress: false, owner: null, destinationId: null }
          });

          transitionManager.setTransitioning(false);
          transitionManager.clearCache([resolvedTrack.id]);

          get().preloadNext();
          get().fetchLyrics(resolvedTrack);

        } catch (error) {
          console.warn("[PlayerStore] setTrack failed to resolve:", error);
          if (get().lastResolutionId === resolutionId) {
            const { queue } = get();
            if (queue.length > 1) {
              console.warn("[PlayerStore] Auto-skipping unplayable track, calling next().");
              get().next();
            } else {
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
        }
      },

      preloadTrack: async (track: PlayerTrack) => {
        if (get().preloadedTrack?.id === track.id) return get().preloadedTrack?.url || null;

        set({ isPreloading: true });
        try {
          const resolved = track; // Bypassed JS resolution

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
                const activeTrack = get().currentTrack;
                if (activeTrack && (activeTrack.id === track.id || getCanonicalTrackId(activeTrack) === canonicalId)) {
                    set({ lyrics: parsed ? { ...parsed, trackId: track.id } : null, isLyricsLoading: false });
                }
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
          if (activeTrack && (activeTrack.id === track.id || getCanonicalTrackId(activeTrack) === canonicalId)) {
            set({ lyrics: parsed ? { ...parsed, trackId: track.id } : null, isLyricsLoading: false });
          }
        } catch (error) {
          const activeTrack = get().currentTrack;
          if (activeTrack && (activeTrack.id === track.id || getCanonicalTrackId(activeTrack) === canonicalId)) {
            set({ isLyricsLoading: false, lyrics: null });
          }
        }
      },

      preloadNext: async () => {
        // Native Media3 handles buffering of the next item in the MediaItem list automatically.
      },

      resolveAutoAdvance: async () => {
        // Deprecated: Natural auto-advance is handled exclusively and natively by AuraPlayer.kt (ExoPlayer STATE_ENDED).
        console.info("[AutoAdvance] resolveAutoAdvance called on JS store (no-op; native AuraPlayer is sole authority)");
      },

      seek: async (position: number) => {
        try {
          await PlaybackService.seek(position);
          set({ position });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      play: async () => {
        try {
          await PlaybackService.play();
        } catch (e) {
          console.warn("[PlayerStore] play failed:", e);
        }
      },

      pause: async () => {
        try {
          await PlaybackService.pause();
        } catch (e) {
          console.warn("[PlayerStore] pause failed:", e);
        }
      },

      togglePlayback: async () => {
        if (get().isPlaying) {
          await get().pause();
        } else {
          await get().play();
        }
      },

      stop: async () => {
        try {
          await PlaybackService.reset();
          set({ isPlaying: false, status: "idle", position: 0 });
        } catch (e) {
          console.warn("[PlayerStore] stop failed:", e);
        }
      },

      next: async () => {
        try {
          await PlaybackService.skipToNext();
        } catch (e) {
          console.warn("[PlayerStore] next failed:", e);
        }
      },

      previous: async (forcePrevious = false) => {
        try {
          await PlaybackService.skipToPrevious();
        } catch (e) {
          console.warn("[PlayerStore] previous failed:", e);
        }
      },

      jumpToQueueIndex: async (index: number) => {
        const { queue } = get();
        if (index < 0 || index >= queue.length) return;
        const target = queue[index];
        if (!target) return;
        set({ currentIndex: index, currentTrack: target, isBuffering: true });
        await PlaybackService.loadTrack(target, queue, index);
      },

      addToQueue: (track: PlayerTrack) => {
        const { queue, originalQueue, currentIndex } = get();
        const newQueue = [...queue, track];
        const newOriginal = [...originalQueue, track];
        set({ queue: newQueue, originalQueue: newOriginal });
        PlaybackService.syncQueue(newQueue, currentIndex);
      },

      playNext: (track: PlayerTrack) => {
        const { queue, originalQueue, currentIndex } = get();
        const insertIdx = Math.max(0, currentIndex + 1);
        const newQueue = [...queue.slice(0, insertIdx), track, ...queue.slice(insertIdx)];
        const newOriginal = [...originalQueue, track];
        set({ queue: newQueue, originalQueue: newOriginal });
        PlaybackService.syncQueue(newQueue, currentIndex);
      },

      removeFromQueue: (index: number) => {
        const { queue, originalQueue, currentIndex } = get();
        if (index < 0 || index >= queue.length) return;
        const newQueue = queue.filter((_: PlayerTrack, i: number) => i !== index);
        const newOriginal = originalQueue.filter((t: PlayerTrack) => t.id !== queue[index]?.id);
        let newIdx = currentIndex;
        if (index < currentIndex) {
          newIdx = currentIndex - 1;
        } else if (index === currentIndex) {
          newIdx = Math.min(currentIndex, newQueue.length - 1);
        }
        set({
          queue: newQueue,
          originalQueue: newOriginal,
          currentIndex: newIdx,
          currentTrack: newQueue[newIdx] || null,
        });
        PlaybackService.syncQueue(newQueue, newIdx);
      },

      reorderQueue: (from: number, to: number) => {
        const { queue, currentIndex } = get();
        if (from === to || from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
        const newQueue = [...queue];
        const [moved] = newQueue.splice(from, 1);
        newQueue.splice(to, 0, moved);

        let newIdx = currentIndex;
        if (currentIndex === from) {
          newIdx = to;
        } else if (from < currentIndex && to >= currentIndex) {
          newIdx = currentIndex - 1;
        } else if (from > currentIndex && to <= currentIndex) {
          newIdx = currentIndex + 1;
        }

        set({ queue: newQueue, currentIndex: newIdx });
        PlaybackService.syncQueue(newQueue, newIdx);
      },

      appendQueue: async (continuationTracks: PlayerTrack[]) => {
        const { queue, originalQueue } = get();
        if (!continuationTracks || continuationTracks.length === 0) return;

        // Filter out tracks already present in the queue
        const existingIds = new Set(queue.map((t: PlayerTrack) => t.id));
        const uniqueNewTracks = continuationTracks.filter((t: PlayerTrack) => !existingIds.has(t.id));
        if (uniqueNewTracks.length === 0) return;

        const newQueue = [...queue, ...uniqueNewTracks];
        const newOriginal = [...originalQueue, ...uniqueNewTracks];

        set({ queue: newQueue, originalQueue: newOriginal });
        await PlaybackService.appendQueue(uniqueNewTracks);
        console.log(`[PlayerStore] appendQueue added ${uniqueNewTracks.length} tracks, new queue size: ${newQueue.length}`);
      },

      injectAutoplayQueue: async (continuationTracks: PlayerTrack[]) => {
        const { queue, originalQueue, currentIndex } = get();
        if (!continuationTracks || continuationTracks.length === 0) return;

        // Filter out tracks already present in the queue
        const existingIds = new Set(queue.map((t: PlayerTrack) => t.id));
        const uniqueNewTracks = continuationTracks.filter((t: PlayerTrack) => !existingIds.has(t.id));
        if (uniqueNewTracks.length === 0) return;

        const newQueue = [...queue, ...uniqueNewTracks];
        const newOriginal = [...originalQueue, ...uniqueNewTracks];

        set({ queue: newQueue, originalQueue: newOriginal });
        await PlaybackService.syncQueue(newQueue, currentIndex);

        // Advance to the first injected track
        const nextIdx = currentIndex + 1;
        if (nextIdx < newQueue.length) {
          const nextTrack = newQueue[nextIdx];
          set({ currentIndex: nextIdx, currentTrack: nextTrack });
          await PlaybackService.loadTrack(nextTrack, newQueue, nextIdx);
        }
      },

      setVolume: async (volume: number) => {
        const currentVol = get().volume;
        if (Math.abs(currentVol - volume) < 0.01) return;

        set({ volume });

        const now = Date.now();
        set({ _lastVolumeSync: now } as any);
        await PlaybackService.setVolume(volume);
      },

      setRepeatMode: (mode: RepeatMode) => {
        const { repeatMode: oldMode } = get();
        console.log(`[RepeatTrace] mode changed ${oldMode} -> ${mode}`);
        set({ repeatMode: mode });
        PlaybackService.setRepeatMode(mode);
      },

      toggleRepeatMode: () => {
        const { repeatMode } = get();
        let newMode: RepeatMode = "off";
        if (repeatMode === "off") newMode = "queue";
        else if (repeatMode === "queue") newMode = "track";
        else if (repeatMode === "track") newMode = "off";

        console.log(`[RepeatTrace] toggle ${repeatMode} -> ${newMode}`);
        set({ repeatMode: newMode });
        PlaybackService.setRepeatMode(newMode);
      },

      toggleShuffle: async () => {
        const { isShuffle, queue, originalQueue, currentIndex, currentTrack } = get();
        const newShuffle = !isShuffle;

        if (!currentTrack || queue.length === 0) {
          console.log(`[ShuffleTrace] toggle with empty queue/track (enabled=${newShuffle})`);
          set({ isShuffle: newShuffle });
          return;
        }

        let freshCurrent = currentTrack;
        if (newShuffle) {
          // Shuffle ON
          const shuffledQueue = QueueEngine.buildShuffledQueue(queue, freshCurrent, currentIndex);
          const resolvedQueue = shuffledQueue.map((t: PlayerTrack) => t.id === freshCurrent.id ? freshCurrent : t);

          console.log(`[ShuffleTrace] enabled=true currentTrack=${freshCurrent.id} originalIndex=${currentIndex} newQueueLength=${resolvedQueue.length}`);

          set({
            isShuffle: newShuffle,
            queue: resolvedQueue,
            currentIndex: 0,
            currentTrack: freshCurrent,
          });

          // Mirror the shuffled queue natively (current track is stable anchor at index 0)
          PlaybackService.syncQueue(resolvedQueue, 0);
        } else {
          // Shuffle OFF
          const { queue: restoredQueue, restoredIndex } = QueueEngine.restoreOriginalQueue(
            originalQueue,
            freshCurrent
          );
          const resolvedQueue = restoredQueue.map((t: PlayerTrack) => t.id === freshCurrent.id ? freshCurrent : t);

          console.log(`[ShuffleTrace] enabled=false currentTrack=${freshCurrent.id} restoredIndex=${restoredIndex} queueLength=${resolvedQueue.length}`);

          set({
            isShuffle: newShuffle,
            queue: resolvedQueue,
            currentIndex: restoredIndex,
            currentTrack: freshCurrent,
          });

          // Mirror restored sequential queue natively keeping current track active
          PlaybackService.syncQueue(resolvedQueue, restoredIndex);
        }
      },

      setShuffle: async (shuffle: boolean) => {
        const current = get().isShuffle;
        if (current !== shuffle) {
          await get().toggleShuffle();
        }
      },

      updateProgress: (position: number, duration: number, buffered: number) => {
        const s = get();
        if (Math.abs(s.position - position) > 100 || Math.abs(s.duration - duration) > 100) {
          set({ position, duration, bufferedPosition: buffered });
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
             let freshCurrent = currentTrack;
             try {
               freshCurrent = currentTrack; // Bypassed JS resolution
               if (freshCurrent.url !== currentTrack.url) {
                 useTelemetryStore.getState().incrementMetric("streamRecoveryCount");
                 const newQueue = [...queue];
                 if (currentIndex >= 0 && currentIndex < newQueue.length) {
                   newQueue[currentIndex] = freshCurrent;
                   set({
                     currentTrack: freshCurrent,
                     queue: newQueue
                   });
                 }
               }
             } catch (validationErr) {
               console.warn("[PlayerStore] Startup validation failed for current track:", validationErr);
               useTelemetryStore.getState().incrementMetric("sourceErrorCount");
             }
             
             if (position > 0) {
               await PlaybackService.seek(position);
             }
             if (volume !== undefined) {
               await PlaybackService.setVolume(volume);
             }

             // Explicitly force pause to guarantee that music does not auto-play on app start.
             await PlaybackService.pause();
             set({ isPlaying: false, status: "paused" });
             
             console.info("[PlayerStore] Session restored in paused state at position:", position);

             // 3. Lazy repair of next 3 tracks asynchronously (after 3 seconds)
             setTimeout(async () => {
               try {
                 const latestStore = usePlayerStore.getState();
                 const next3Queue = [];
                 const N = latestStore.queue.length;
                 for (let i = 1; i <= 3; i++) {
                   const nextIdx = (latestStore.currentIndex + i) % N;
                   const nextTrack = latestStore.queue[nextIdx];
                   if (nextTrack && nextTrack.id !== freshCurrent.id) {
                     next3Queue.push(nextTrack);
                   }
                 }

                 for (const track of next3Queue) {
                   if (useSourceHealthStore.getState().isCooldownActive(track.id)) {
                     console.info(`Skipped repair: track currently in cooldown (id: ${track.id}, title: "${track.title}")`);
                     continue;
                   }
                   const validation = await validateTrackSource(track);
                   const stale = isSourceStale(track);
                   if (!validation.valid || stale) {
                     try {
                       const repaired = track; // Bypassed JS resolution
                       const storeInstance = usePlayerStore.getState();
                       const newQ = [...storeInstance.queue];
                       const idx = newQ.findIndex((t: PlayerTrack) => t.id === track.id);
                        if (idx !== -1) {
                          const merged = { ...track, ...repaired };
                          newQ[idx] = merged;
                          usePlayerStore.setState({ queue: newQ });
                          await PlaybackService.updateMediaItem(idx, merged);
                        }
                     } catch (err) {
                       console.warn(`[StartupLazyRepair] Failed to repair track "${track.title}":`, err);
                     }
                   }
                 }
               } catch (lazyErr) {
                 console.warn("[StartupLazyRepair] Lazy repair failed:", lazyErr);
               }
             }, 3000);

             // 4. Start maintenance worker and run initial sliding window queue repair (after 10 seconds)
             setTimeout(async () => {
               try {
                 QueueRepairService.startMaintenanceWorker();
                 await QueueRepairService.repairQueue(true);
               } catch (workerErr) {
                 console.warn("[PlayerStore] Failed to initialize queue repair service:", workerErr);
               }
             }, 10000);

           } catch (e) {
             console.error("[PlayerStore] Failed to restore session", e);
           }
        }
        set({ isRestoringSession: false });
      },
    })
);

// Compatibility stub for any legacy code checking usePlayerStore.persist
(usePlayerStore as any).persist = {
  hasHydrated: () => true,
  rehydrate: () => Promise.resolve(),
};
