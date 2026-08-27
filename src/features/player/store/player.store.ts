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
  // Playlist-aware playback context
  activeContext: PlaybackContext | null;
  setActiveContext: (context: PlaybackContext | null) => void;
  updateTrackMetadata: (trackId: string, partial: Partial<PlayerTrack>) => void;
  restoreSession: () => Promise<void>;
  resolveAutoAdvance: () => Promise<void>;

  selectedTrackId?: string | null;
  selectedTrackIndex?: number | null;
  sourceArtistId?: string | null;
}

export const usePlayerStore = create<any>()( // @ts-ignore

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
        try {
          
          const active = null; /* Handled natively */
          const index = get().currentIndex;

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

      setQueue: async (tracks, startIndex = 0, context) => {
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

          if (false) {
            throw new Error(`Track "${resolvedTrack.title}" has no playable stream URL.`);
          }

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
        // Native Media3 handles buffering of the next item in the MediaItem list automatically.
        // JS manual preload resolution is no longer needed.
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
        if (nextIndex === -1 || nextIndex < 0 || nextIndex >= queue.length) {
          await get().stop();
          return;
        }

        if (repeatMode === 'track' && currentTrack) {
          set({
            isTransitioning: true,
            position: 0,
            selectedTrackId: currentTrack.id,
            selectedTrackIndex: currentIndex,
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
        if (!nextTrack) {
          await get().stop();
          return;
        }
        set({
          isTransitioning: true,
          selectedTrackId: nextTrack.id,
          selectedTrackIndex: nextIndex,
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
        
        set({ repeatMode: mode });
      },

      toggleRepeatMode: () => {
        const { repeatMode } = get();
        let newMode: RepeatMode = "off";
        if (repeatMode === "off") newMode = "queue";
        else if (repeatMode === "queue") newMode = "track";
        else if (repeatMode === "track") newMode = "off";

        
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
          // await PlaybackService.updateQueue(resolvedQueue, 0);
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
          // await PlaybackService.updateQueue(resolvedQueue, restoredIndex);
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
             // 1. Validate and repair current track immediately
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

             // 2. Inject playable queue natively (uses filtered playable queue inside updateQueue)
             // await PlaybackService.updateQueue(get().queue, currentIndex);
             
             if (position > 0) {
               await PlaybackService.seek(position);
             }
             if (volume !== undefined) {
               await PlaybackService.setVolume(volume);
             }
             if (repeatMode) {
               
             }

             // Explicitly force pause to guarantee that the music does not auto-play on app start.
             
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
                       const idx = newQ.findIndex(t => t.id === track.id);
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
    }),
    {
      name: 'aura-player',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        // Grab real position from RNTP natively right before saving (AppState backgrounding triggers saves usually, or periodic debounce)
        try {
          
          if (state.isPlaying) {
            const p = { position: 0, duration: 0 }; /* Sync not supported synchronously */
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
          queueContext: state.queueContext,
        };
      },
      onRehydrateStorage: () => {
        return (hydratedState, error) => {
          if (!error && hydratedState) {
            usePlayerStore.setState({ _hasHydrated: true, status: "paused", isPlaying: false });
            // Restore session asynchronously
            setTimeout(() => {
              usePlayerStore.getState().restoreSession();
            }, 1000);
          }
        };
      },
    }
  )
);

