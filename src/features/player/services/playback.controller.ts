import TrackPlayer, { Event, PlaybackState } from "@rntp/player";
import { usePlayerStore } from "../store/player.store";
import { PlayerTrack, RepeatMode } from "../types/player";
import { transitionManager } from "./transition-manager";
import { playbackProgress } from "./playback-progress";

let _controllerInitialized = false;

/**
 * PlaybackController - The authoritative bridge between native RNTP and Zustand store.
 * Implemented as a singleton to ensure event listeners are registered exactly once.
 * Uses module-level flags to prevent duplicate registration across hot-reloads.
 */
export class PlaybackController {
  private static isInitialized = false;
  private static lastState: PlaybackState | null = null;
  private static healingInProgress = new Set<string>();
  private static consecutiveFailures = 0;

  // Analytics Session State
  private static sessionTrackId: string | null = null;
  private static sessionStartedAt: number = 0;
  private static sessionStartPositionMs: number = 0;
  private static maxPositionMs: number = 0;
  private static hasCrossed30s: boolean = false;
  private static hasRegisteredPlay: boolean = false;
  private static lastFlushedTrackId: string | null = null;

  private static startSession(trackId: string, startPositionMs: number = 0) {
    if (this.sessionTrackId && this.sessionTrackId !== trackId) {
      this.flushCurrentSession(false);
    }

    if (this.lastFlushedTrackId === trackId && startPositionMs < 5000) {
      try {
        const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
        useAnalyticsStore.getState().trackRepeated(trackId);
      } catch (e) {}
    }
    this.lastFlushedTrackId = null;

    this.sessionTrackId = trackId;
    this.sessionStartedAt = Date.now();
    this.sessionStartPositionMs = startPositionMs;
    this.maxPositionMs = startPositionMs;
    this.hasCrossed30s = startPositionMs >= 30000;
    this.hasRegisteredPlay = startPositionMs >= 30000;

    try {
      const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
      useAnalyticsStore.getState().setCurrentSession({
        trackId,
        startedAt: this.sessionStartedAt,
        startPosition: startPositionMs,
      });
    } catch (e) {
      console.warn("[PlaybackController] Failed to set currentSession in analytics store:", e);
    }
  }

  private static clearSession() {
    this.sessionTrackId = null;
    this.sessionStartedAt = 0;
    this.sessionStartPositionMs = 0;
    this.maxPositionMs = 0;
    this.hasCrossed30s = false;
    this.hasRegisteredPlay = false;

    try {
      const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
      useAnalyticsStore.getState().setCurrentSession(null);
    } catch (e) {}
  }

  private static async flushCurrentSession(wasCompleted: boolean) {
    if (!this.sessionTrackId) return;

    const trackId = this.sessionTrackId;
    const startPositionMs = this.sessionStartPositionMs;
    const finalPosition = this.maxPositionMs;
    const hasCrossed30s = this.hasCrossed30s;

    this.lastFlushedTrackId = trackId;

    // Reset immediately to avoid duplicate flush triggers from concurrent event handlers
    this.clearSession();

    try {
      const playerStore = usePlayerStore.getState();
      const track = playerStore.queue.find(t => t.id === trackId) || playerStore.currentTrack;
      if (!track) return;

      const duration = track.duration || playerStore.duration || 0;
      const completionRatio = wasCompleted
        ? 1.0
        : (duration > 0 ? Math.min(1.0, finalPosition / duration) : 0);

      // Skip Detection: position < 30000 AND track changes (not completed naturally)
      const skipped = !hasCrossed30s && !wasCompleted;

      const { useAnalyticsStore } = require("../../analytics/store/analytics.store");

      const activeContext = playerStore.activeContext;
      let sourceContext = activeContext ? {
        type: activeContext.type as any,
        id: activeContext.id,
        title: activeContext.name || undefined
      } : undefined;

      if (playerStore.queueContext?.sourceType === "autoplay") {
        sourceContext = {
          type: "autoplay",
          id: "autoplay-radio",
          title: "Autoplay Radio"
        };
      }

      // 1. Write history entry
      useAnalyticsStore.getState().addHistoryEntry({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artistId: track.artistId || null,
        album: track.album || null,
        albumId: track.albumId || null,
        art: track.art || null,
        positionMs: finalPosition,
        durationMs: duration,
        completionRatio,
        skipped,
        trackSnapshot: track,
        sourceContext,
      });

      // 2. Accumulate affinities
      const listenMs = Math.max(0, finalPosition - startPositionMs);
      const skipWithin15s = skipped && finalPosition < 15000;
      const abandoned = skipped && sourceContext?.type === "playlist" && finalPosition < 30000;

      const affinityUpdate: any = {
        totalListenMs: listenMs,
        trackId: track.id,
        albumName: track.album || undefined,
        skipWithin15s,
        abandoned,
      };

      if (skipped) {
        affinityUpdate.skipCount = 1;
      }

      if (wasCompleted) {
        affinityUpdate.completionCount = 1;
      }

      if (track.artist) {
        useAnalyticsStore.getState().incrementArtistAffinity(track.artist, affinityUpdate);
      }
      if (track.album) {
        useAnalyticsStore.getState().incrementAlbumAffinity(track.album, {
          totalListenMs: listenMs,
          playCount: 0,
          completionCount: wasCompleted ? 1 : 0,
          skipCount: skipped ? 1 : 0,
          score: 0,
        });
      }
      useAnalyticsStore.getState().incrementTrackAffinity(track.id, {
        totalListenMs: listenMs,
        playCount: 0,
        completionCount: wasCompleted ? 1 : 0,
        skipCount: skipped ? 1 : 0,
        score: 0,
      });

    } catch (e) {
      console.error("[PlaybackController] Error flushing session telemetry:", e);
    }
  }

  static initialize() {
    if (_controllerInitialized && this.isInitialized) return;
    _controllerInitialized = true;

    if (this.isInitialized) return;

    // 1. Playback State Changed
    TrackPlayer.addEventListener(Event.PlaybackStateChanged, (data) => {
      const store = usePlayerStore.getState();
      const newState = data.state;
      
      if (this.lastState === newState) return;
      this.lastState = newState;

      switch (newState) {
        case PlaybackState.Ready:
          if (TrackPlayer.isPlaying()) {
            usePlayerStore.setState({
              status: "playing",
              isPlaying: true,
              isTransitioning: false,
              isBuffering: false
            });
          } else {
            store.setStatus("paused");
          }
          break;
        case PlaybackState.Buffering:
          store.setStatus("buffering");
          break;
        case PlaybackState.Ended:
          if (store.isTransitioning) return;
          
          PlaybackController.flushCurrentSession(true);

          store.updateProgress(0, store.duration, 0);

          if (store.repeatMode === "track" && store.currentTrack) {
            try {
              const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
              useAnalyticsStore.getState().trackRepeated(store.currentTrack.id);
            } catch (e) {}
          }

          const { useSettingsStore } = require("../../settings/store/settings.store");
          const settings = useSettingsStore.getState();
          if (settings.autoplayEnabled && store.repeatMode === "off" && store.currentIndex === store.queue.length - 1 && store.currentTrack) {
            const lastTrack = store.currentTrack;
            const { AutoplayRadio } = require("./autoplay-radio");
            AutoplayRadio.generateContinuationQueue(lastTrack).then((continuationTracks: PlayerTrack[]) => {
              if (continuationTracks && continuationTracks.length > 0) {
                store.injectAutoplayQueue(continuationTracks).then(() => {
                  store.resolveAutoAdvance();
                });
              } else {
                store.resolveAutoAdvance();
              }
            }).catch((err: any) => {
              console.error("[PlaybackController] Autoplay failed:", err);
              store.resolveAutoAdvance();
            });
          } else {
            store.resolveAutoAdvance();
          }
          break;
        case PlaybackState.Idle:
          if (store.status !== "idle") {
            store.setStatus("idle");
          }
          // Safe fallback if player goes idle and has an uncompleted active session
          if (PlaybackController.sessionTrackId) {
            PlaybackController.flushCurrentSession(false);
          }
          break;
        case PlaybackState.Error:
          store.setStatus("error");
          break;
      }
    });

    // 1.5. Playback Progress Updated (Atomic position and duration sync)
    // Writes to SharedValues first (zero React involvement) then to Zustand for non-perf-critical consumers.
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (data) => {
      const elapsedMs = (data.position || 0) * 1000;
      const durationMs = (data.duration || 0) * 1000;

      // Direct SharedValue write — UI thread reads these without React rerenders
      playbackProgress.positionMs.value = elapsedMs;
      playbackProgress.durationMs.value = durationMs;
      playbackProgress.progress.value = durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 0;
      playbackProgress.bufferedMs.value = 0; 

      // Zustand still updated for non-perf-critical consumers (queue, seek, crossfade, etc.)
      const store = usePlayerStore.getState();
      store.updateProgress(elapsedMs, durationMs, store.bufferedPosition);

      // Playback Telemetry Sync
      const currentTrack = store.currentTrack;
      if (currentTrack && currentTrack.id) {
        if (PlaybackController.sessionTrackId !== currentTrack.id) {
          PlaybackController.startSession(currentTrack.id, elapsedMs);
        }

        if (elapsedMs > PlaybackController.maxPositionMs) {
          PlaybackController.maxPositionMs = elapsedMs;
        }

        // 30 Second Rule Check
        if (!PlaybackController.hasRegisteredPlay && PlaybackController.maxPositionMs >= 30000) {
          PlaybackController.hasCrossed30s = true;
          PlaybackController.hasRegisteredPlay = true;

          try {
            const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
            const artistAffUpdate = {
              playCount: 1,
              trackId: currentTrack.id,
              albumName: currentTrack.album || undefined,
            };
            if (currentTrack.artist) {
              useAnalyticsStore.getState().incrementArtistAffinity(currentTrack.artist, artistAffUpdate);
            }
            if (currentTrack.album) {
              useAnalyticsStore.getState().incrementAlbumAffinity(currentTrack.album, { playCount: 1, score: 1 });
            }
            useAnalyticsStore.getState().incrementTrackAffinity(currentTrack.id, { playCount: 1, score: 1 });
          } catch (e) {
            console.error("[PlaybackController] Error registering 30s play count affinity:", e);
          }
        }
      }
    });

    // 2. Is Playing Changed (Atomic toggle sync)
    TrackPlayer.addEventListener(Event.IsPlayingChanged, (data) => {
      const store = usePlayerStore.getState();
      const playing = data.playing;
      
      if (playing) {
        PlaybackController.consecutiveFailures = 0;
      }
      
      if (store.isPlaying !== playing) {
        store.setStatus(playing ? "playing" : "paused");
      }
    });

    // 2.5. Player Error Handling (with self-healing re-resolution for expired stream URLs)
    TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
      console.error("[Player] Native Error:", error.message, error.code);
      const store = usePlayerStore.getState();
      const currentTrack = store.currentTrack;

      try {
        const { useTelemetryStore } = require("../store/telemetry.store");
        useTelemetryStore.getState().incrementMetric("sourceErrorCount");
      } catch (e) {}

      // Self-healing: If this is an online streaming track, attempt to re-resolve the stream URL and resume
      if (currentTrack && currentTrack.id && !currentTrack.isLocal) {
        if (PlaybackController.healingInProgress.has(currentTrack.id)) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.info(`[PlayerController] Healing already in progress for ${currentTrack.id}, ignoring duplicate.`);
          }
          return;
        }
        PlaybackController.healingInProgress.add(currentTrack.id);

        console.info(`[PlayerController] Stream error detected for ${currentTrack.title} (${currentTrack.id}). Attempting self-healing re-resolution...`);
        
        try {
          // 1. Invalidate backend stream URL cache
          const { musicService } = require("../../../services/api/music");
          musicService.invalidateStreamCache(currentTrack.id);
          
          // 2. Invalidate local media-cache store cached record so we don't fetch expired url again
          const { useMediaCacheStore } = require("../../cache/store/media-cache.store");
          const cacheStore = useMediaCacheStore.getState();
          const cachedRecord = cacheStore.getCachedTrack(currentTrack.id);
          if (cachedRecord && cachedRecord.track) {
            cacheStore.cacheTrack({ ...cachedRecord.track, url: "" });
          }

          // 3. Clear preloaded transitioning states to prevent skips and show loading indicator
          usePlayerStore.setState({ isTransitioning: false, isBuffering: true });

          // 4. Resolve a fresh signed stream URL from the backend (bypassing caches)
          const { ensurePlayableTrack } = require("./source-authority");
          const resolvedTrack = await ensurePlayableTrack({ ...currentTrack, url: "" });
          
          if (resolvedTrack && resolvedTrack.url && resolvedTrack.url.startsWith("http")) {
            console.info(`[PlayerController] Successfully resolved fresh stream URL: ${resolvedTrack.url.substring(0, 60)}...`);
            
            // Get current active native item and current playback position
            const progress = await TrackPlayer.getProgress();
            const currentPosition = progress.position;
            
            // Mutate the store track reference so future UI checks are updated
            store.updateTrackMetadata(currentTrack.id, { url: resolvedTrack.url });
            
            // Force load the resolved track natively (this will re-inject queue and play resolved URL)
            const { PlaybackService } = require("./playback.service");
            await PlaybackService.loadTrack(resolvedTrack, store.queue, store.currentIndex);
            
            // Seek back to where the error occurred
            if (currentPosition > 0) {
              await PlaybackService.seek(currentPosition);
            }
            
            // [Aura_Ownership] Reset status to playing after successful self-healing.
            // Without this, the store stays in "error" state even though playback
            // was recovered — causing the UI to show an error banner indefinitely.
            usePlayerStore.setState({ status: "playing" });
            
            console.info("[PlayerController] Self-healing completed. Resumed playback successfully!");
            PlaybackController.consecutiveFailures = 0;
            return; // Recovered successfully!
          }
        } catch (healError: any) {
          console.error("[PlayerController] Self-healing re-resolution failed:", healError.message || healError);
        } finally {
          PlaybackController.healingInProgress.delete(currentTrack.id);
        }
      }

      // Default error state fallback if self-healing is not applicable or fails
      PlaybackController.consecutiveFailures++;
      const limit = Math.min(store.queue.length || 1, 5);
      console.warn(`[PlayerController] Playback error on track, consecutive failure count: ${PlaybackController.consecutiveFailures}/${limit}`);

      if (PlaybackController.consecutiveFailures >= limit) {
        console.error(`[PlayerController] Consecutive failures limit reached (${limit}). Stopping playback.`);
        PlaybackController.consecutiveFailures = 0; // Reset consecutive failures
        
        store.setStatus("error");
        usePlayerStore.setState({ 
          error: error.message || "Playback failed: too many consecutive errors",
          isBuffering: false,
          isTransitioning: false,
          isPlaying: false
        });
        try {
          await TrackPlayer.stop();
        } catch (stopErr) {
          console.warn("[PlayerController] Failed to stop player on failures limit", stopErr);
        }
      } else {
        // Automatically skip to the next track
        console.info(`[PlayerController] Auto-skipping to next track (failures: ${PlaybackController.consecutiveFailures}/${limit})`);
        
        usePlayerStore.setState({ 
          isBuffering: false,
          isTransitioning: false
        });
        
        try {
          await store.next();
        } catch (nextErr) {
          console.error("[PlayerController] Failed to auto-skip to next track", nextErr);
        }
      }
    });

    // 3. Media Item Transition (Confirmation Layer Only)
    // [Aura_Ownership] MIT is a confirmation mechanism, NOT a state authority.
    // It confirms the native queue index and track identity after a transport jump.
    // It NEVER writes: status, isPlaying, isBuffering — those are owned by
    // PlaybackStateChanged and IsPlayingChanged events.
    // When a JS operation (_transitionGuard.inProgress) is active, MIT defers
    // to the operation's completion handler (Pattern A) or confirms the expected
    // transition (Pattern B). Only when no JS operation is in flight does MIT
    // act as the fallback authority for index/track sync (Pattern C).
    TrackPlayer.addEventListener(Event.MediaItemTransition, async (data) => {
      try {
        const { PlaybackService } = require('./playback.service');
        const store = usePlayerStore.getState();
        const guard = store._transitionGuard;

        // Analytics Telemetry Sync on Transition
        const mediaId = data.item ? ((data.item as any)?.mediaId || (data.item as any)?.id) : null;
        if (PlaybackController.sessionTrackId && PlaybackController.sessionTrackId !== mediaId) {
          PlaybackController.flushCurrentSession(false);
        }
        if (mediaId && PlaybackController.sessionTrackId !== mediaId) {
          PlaybackController.startSession(mediaId, 0);
        }

        // Defensive: reset isTransitioning on native transition to prevent lockup.
        // But only when no JS operation owns the transition — never cancel a
        // transition that setTrack/resolveAutoAdvance/next/previous initiated.
        if (store.isTransitioning && !guard.inProgress) {
            usePlayerStore.setState({ isTransitioning: false });
        }

        if (PlaybackService.isReorderingQueue()) return;
        if (!data.item) return;

        if (!mediaId) return;

        const newIndex = store.queue.findIndex((t: PlayerTrack) => t && t.id === mediaId);
        if (newIndex < 0 || newIndex >= store.queue.length) return;

        // ── Transition Guard ──────────────────────────────────────────
        // If a JS operation owns the current transition, check whether this MIT
        // matches the expected destination. If not, defer to avoid state corruption.
        if (guard.inProgress) {
          if (guard.destinationId === mediaId) {
            if (guard.owner === "setTrack" || guard.owner === "jump") {
              // Pattern A: setTrack/jump have completion handlers that write
              // final state. MIT defers entirely to prevent races.
              return;
            }
            // Pattern B: skip/previous/autoAdvance have no completion handler.
            // MIT confirms and clears the guard. Reset progress state atomically
            // so UI never shows stale position/duration from the previous track.
            const validTrack = store.queue[newIndex];
            if (!validTrack || !validTrack.id) return;
            
            usePlayerStore.setState({
              currentIndex: newIndex,
              currentTrack: validTrack,
              position: 0,
              duration: validTrack.duration || 0,
              bufferedPosition: 0,
              preloadedTrack: null,
              lyrics: null,
              isLyricsLoading: false,
              _transitionGuard: { ...guard, inProgress: false, owner: null, destinationId: null }
            });
            transitionManager.clearCache([validTrack.id]);
            PlaybackController.logForensicState(`transition: ${validTrack.title}`);
            store.preloadNext();
            return;
          }
          // Unexpected destination — log and defer to the owning operation
          console.warn(`[PlayerController] MIT destination ${mediaId} != expected ${guard.destinationId}. Deferring.`);
          return;
        }

        // ── Pattern C: No JS operation in flight ──────────────────────
        // MIT is the fallback authority for index/track sync.
        // Status/isPlaying/isBuffering come from PlaybackStateChanged events.
        const isDifferentTrack = store.currentTrack?.id !== mediaId;
        const isDifferentIndex = newIndex !== -1 && newIndex !== store.currentIndex;

        if (isDifferentIndex || isDifferentTrack) {
          const nextTrack = store.queue[newIndex];
          if (!nextTrack || !nextTrack.id) return;

          const preloaded = store.preloadedTrack;
          const cachedFromManager = transitionManager.getCachedTrack(nextTrack.id);

          const trackToUse = (preloaded && preloaded.id === nextTrack.id) ?
            preloaded : (cachedFromManager || nextTrack);

          const validTrack = transitionManager.validatePreload(trackToUse) ? trackToUse : nextTrack;
          if (!validTrack || !validTrack.id) return;

          // Eagerly resolve unresolved URLs in-place instead of replacing the full queue
          const { isResolvedUrl } = require('../utils/track-resolver');
          const { isPlaceholderSource } = require('./source-validator');
          const isLocal = validTrack.isLocal || validTrack.url?.startsWith("file://") || validTrack.url?.startsWith("content://");
          if (!isLocal && (!isResolvedUrl(validTrack.url) || isPlaceholderSource(validTrack.url))) {
              try {
                const { ensurePlayableTrack } = require('./source-authority');
                const resolved = await ensurePlayableTrack(nextTrack);
                if (resolved && resolved.url && isResolvedUrl(resolved.url) && resolved.id) {
                  await PlaybackService.updateMediaItem(newIndex, resolved);
                  const newQueue = [...store.queue];
                  newQueue[newIndex] = resolved;
                  usePlayerStore.setState({
                    currentIndex: newIndex,
                    currentTrack: resolved,
                    queue: newQueue,
                    position: 0,
                    duration: resolved.duration || 0,
                    bufferedPosition: 0,
                    preloadedTrack: null,
                    lyrics: null,
                    isLyricsLoading: false
                  });
                  transitionManager.setTransitioning(false);
                  transitionManager.clearCache([resolved.id]);
                  store.preloadNext();
                  return;
                }
              } catch (e) {
                console.warn("[PlayerController] Eager resolution failed, falling back to setTrack", e);
              }
              usePlayerStore.getState().setTrack(nextTrack);
              return;
          }

          // [Aura_Ownership] MIT confirms index and track ONLY.
          // Status/isPlaying/isBuffering are NOT written here — they arrive via
          // PlaybackStateChanged / IsPlayingChanged from the native player.
          // Progress state (position/duration/bufferedPosition) IS reset here
          // to prevent the UI from showing stale seek bar data from the old track.
          usePlayerStore.setState({
            currentIndex: newIndex,
            currentTrack: validTrack,
            position: 0,
            duration: validTrack.duration || 0,
            bufferedPosition: 0,
            preloadedTrack: null,
            lyrics: null,
            isLyricsLoading: false
          });

          try {
            const { HydrationScheduler } = require("./hydration.service");
            HydrationScheduler.scheduleHydration(validTrack);
          } catch (e) {
            console.warn("[playback.controller] Background hydration failed to schedule", e);
          }

          transitionManager.setTransitioning(false);
          transitionManager.clearCache([validTrack.id]);

          PlaybackController.logForensicState(`transition: ${validTrack.title}`);

          store.preloadNext();
        }
      } catch (err) {
        console.error("[PlayerController] Fatal error in MediaItemTransition listener:", err);
        usePlayerStore.setState({ isTransitioning: false });
      }
    });

    // 4. Remote Control Events - silent execution
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
      TrackPlayer.play();
    });

    // 5. Remote Pause
    TrackPlayer.addEventListener(Event.RemotePause, () => {
      TrackPlayer.pause();
    });

    TrackPlayer.addEventListener(Event.RemoteNext, () => {
      usePlayerStore.getState().next();
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
      usePlayerStore.getState().previous();
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
      TrackPlayer.seekTo(event.position);
    });

    TrackPlayer.addEventListener(Event.RemoteSkipForward, (event) => {
      const pos = TrackPlayer.getProgress().position;
      TrackPlayer.seekTo(pos + event.interval);
    });

    TrackPlayer.addEventListener(Event.RemoteSkipBackward, (event) => {
      const pos = TrackPlayer.getProgress().position;
      TrackPlayer.seekTo(Math.max(0, pos - event.interval));
    });

    TrackPlayer.addEventListener((Event as any).RemoteCustomAction, (event: any) => {
      const store = usePlayerStore.getState();
      if (event.customAction === "like") {
         // handle like
         console.log("Like triggered from notification");
      } else if (event.customAction === "loop") {
         let nextMode: RepeatMode = "off";
         if (store.repeatMode === "off") nextMode = "queue";
         else if (store.repeatMode === "queue") nextMode = "track";
         else if (store.repeatMode === "track") nextMode = "off";
         store.setRepeatMode(nextMode);
      }
    });

    TrackPlayer.addEventListener((Event as any).RemoteDuck, async (event: any) => {
      console.log("[Player] [Aura_Stabilization] RemoteDuck event:", event);
      const store = usePlayerStore.getState();
      
      if (event.permanent) {
        // Permanent audio focus loss - e.g., phone call or other exclusive audio player.
        await store.pause();
      } else if (event.ducking) {
        // Transient focus loss - e.g., navigation chime or system notification.
        // Lower volume to 0.2 natively without updating store preference.
        await TrackPlayer.setVolume(0.2);
      } else if (event.paused) {
        // Temporary focus loss - pause until focus is regained.
        await store.pause();
      } else {
        // Focus restored! Restore native volume back to user preference and resume.
        await TrackPlayer.setVolume(store.volume);
        if (store.isPlaying) {
          await TrackPlayer.play();
          store.setStatus("playing");
        }
      }
    });

    TrackPlayer.addEventListener(Event.MetadataReceived, (data) => {
      try {
        const store = usePlayerStore.getState();
        const currentTrack = store.currentTrack;
        if (!currentTrack || !currentTrack.id) return;

        console.log("[MetadataReceived] event payload received:", data);

        const updates: Partial<PlayerTrack> = {};
        if (data.title && data.title !== currentTrack.title && data.title.trim().length > 0) {
          updates.title = data.title;
        }
        if (data.artist && data.artist !== currentTrack.artist && data.artist.trim().length > 0 && data.artist !== "Local Artist" && data.artist !== "Local") {
          updates.artist = data.artist;
        }
        if (data.artworkUrl && data.artworkUrl !== currentTrack.art && data.artworkUrl.trim().length > 0) {
          updates.art = data.artworkUrl;
        }
        if (data.albumTitle && data.albumTitle !== currentTrack.album && data.albumTitle.trim().length > 0) {
          updates.album = data.albumTitle;
        }

        if (Object.keys(updates).length > 0) {
          console.log(`[PlaybackController] Updating metadata for track ${currentTrack.id}:`, updates);
          store.updateTrackMetadata(currentTrack.id, updates);
          
          const { useMediaCacheStore } = require("../../cache/store/media-cache.store");
          useMediaCacheStore.getState().cacheTrack(currentTrack, updates);
        }
      } catch (e) {
        console.error("[PlaybackController] Error in MetadataReceived listener:", e);
      }
    });

    this.isInitialized = true;
  }

  static async logForensicState(context: string) {
    try {
      const store = usePlayerStore.getState();
      const { getCanonicalTrackId } = require("../utils/track-identity");
      
      // Safe retrieval of native state
      let nativeIndex = -1;
      let activeItem = null;
      
      try {
        const index = await TrackPlayer.getActiveMediaItemIndex();
        nativeIndex = index ?? -1;
      } catch (e) {}

      try {
        activeItem = await TrackPlayer.getActiveMediaItem();
      } catch (e) {}
      
      const { useMediaCacheStore } = require("../../cache/store/media-cache.store");
      const cacheStore = useMediaCacheStore.getState();
      const canonicalId = store.currentTrack ? getCanonicalTrackId(store.currentTrack) : 'none';
      const cached = store.currentTrack ? cacheStore.getCachedTrack(canonicalId) : null;
      
      console.info(`========================================
[FORENSIC STATE TRACE] - ${context.toUpperCase()}
[PLAYER] status: "${store.status}", isPlaying: ${store.isPlaying}, isBuffering: ${store.isBuffering}
[PLAYER] currentTrack: "${store.currentTrack?.title}" (${store.currentTrack?.id})
[PLAYER] canonicalTrackId: "${canonicalId}"
[QUEUE] JS index: ${store.currentIndex}, queueSize: ${store.queue.length}
[RNTP] nativeIndex: ${nativeIndex}, activeMediaId: "${(activeItem as any)?.mediaId || (activeItem as any)?.id}"
[METADATA] artworkSource: "${store.currentTrack?.art ? 'online/local url' : 'fallback picsum'}"
[LYRICS] state: ${store.lyrics ? `loaded (${store.lyrics.lyrics?.length || 0} lines)` : 'null'}, isLyricsLoading: ${store.isLyricsLoading}
[LYRICS] cacheStatus: ${cached?.lyrics ? (cached.lyrics.unavailable ? 'cached negative (unavailable)' : 'cached positive') : 'miss'}
========================================`);
    } catch (e) {
      console.warn("[Forensic Log] Failed to retrieve full state:", e);
    }
  }

  static logNativeState(context: string) {
    this.logForensicState(context);
  }
}
