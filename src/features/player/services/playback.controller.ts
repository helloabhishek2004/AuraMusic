import TrackPlayer, { Event, PlaybackState } from "@rntp/player";
import { usePlayerStore } from "../store/player.store";
import { PlayerTrack } from "../types/player";
import { transitionManager } from "./transition-manager";

let _controllerInitialized = false;

/**
 * PlaybackController - The authoritative bridge between native RNTP and Zustand store.
 * Implemented as a singleton to ensure event listeners are registered exactly once.
 * Uses module-level flags to prevent duplicate registration across hot-reloads.
 */
export class PlaybackController {
  private static isInitialized = false;
  private static lastState: PlaybackState | null = null;

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
          
          store.updateProgress(0, store.duration, 0);
          store.next();
          break;
        case PlaybackState.Idle:
          if (store.status !== "idle") {
            store.setStatus("idle");
          }
          break;
        case PlaybackState.Error:
          store.setStatus("error");
          break;
      }
    });

    // 2. Is Playing Changed (Atomic toggle sync)
    TrackPlayer.addEventListener(Event.IsPlayingChanged, (data) => {
      const store = usePlayerStore.getState();
      const playing = data.playing;
      
      if (store.isPlaying !== playing) {
        store.setStatus(playing ? "playing" : "paused");
      }
    });

    // 2.5. Player Error Handling (with self-healing re-resolution for expired stream URLs)
    TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
      console.error("[Player] Native Error:", error.message, error.code);
      const store = usePlayerStore.getState();
      const currentTrack = store.currentTrack;

      // Self-healing: If this is an online streaming track, attempt to re-resolve the stream URL and resume
      if (currentTrack && !currentTrack.isLocal && currentTrack.id) {
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
          const { resolveAudioOnly } = require("../utils/track-resolver");
          const resolvedTrack = await resolveAudioOnly({ ...currentTrack, url: "" });
          
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
            
            console.info("[PlayerController] Self-healing completed. Resumed playback successfully!");
            return; // Recovered successfully!
          }
        } catch (healError: any) {
          console.error("[PlayerController] Self-healing re-resolution failed:", healError.message || healError);
        }
      }

      // Default error state fallback if self-healing is not applicable or fails
      store.setStatus("error");
      usePlayerStore.setState({ 
        error: error.message || "Native playback error",
        isBuffering: false,
        isTransitioning: false,
        isPlaying: false
      });
    });

    // 3. Media Item Transition (Sync currentIndex)
    TrackPlayer.addEventListener(Event.MediaItemTransition, async (data) => {
      try {
        const { PlaybackService } = require('./playback.service');
        const store = usePlayerStore.getState();

        // [Aura_Stabilization] Always reset isTransitioning on ANY native transition
        // to prevent UI lockup if a move/reorder was in progress during transition.
        if (store.isTransitioning) {
            usePlayerStore.setState({ isTransitioning: false });
        }

        if (PlaybackService.isReorderingQueue()) return;

        if (!data.item) return;

        const mediaId = data.item?.mediaId || data.item?.id || (data.item as any)?.mediaId || (data.item as any)?.id;
        if (!mediaId) {
          console.warn("[PlayerController] Event.MediaItemTransition: data.item contains no identity ID.");
          return;
        }

        const newIndex = store.queue.findIndex((t: PlayerTrack) => t.id === mediaId);
        
        if (newIndex === -1) {
            console.warn(`[PlayerController] Transitioned to unknown track: ${mediaId}.`);
            return;
        }

        const isDifferentTrack = store.currentTrack?.id !== mediaId;
        const isDifferentIndex = newIndex !== -1 && newIndex !== store.currentIndex;

        if (isDifferentIndex || isDifferentTrack) {
          const nextTrack = store.queue[newIndex];
          if (!nextTrack) {
            usePlayerStore.setState({ isTransitioning: false });
            return;
          }
          
          const preloaded = store.preloadedTrack;
          const cachedFromManager = transitionManager.getCachedTrack(nextTrack.id);
          
          const trackToUse = (preloaded && preloaded.id === nextTrack.id) ? 
            preloaded : (cachedFromManager || nextTrack);
          
          const validTrack = transitionManager.validatePreload(trackToUse) ? trackToUse : nextTrack;
          
          // If the track is a dummy/unresolved item, we must properly resolve it via setTrack
          const { isResolvedUrl } = require('../utils/track-resolver');
          if (!validTrack.isLocal && !isResolvedUrl(validTrack.url)) {
              usePlayerStore.getState().setTrack(nextTrack);
              return;
          }

          // [Aura_Stabilization] Authoritatively synchronize native active track to store
          usePlayerStore.setState({ 
            currentIndex: newIndex, 
            currentTrack: validTrack,
            preloadedTrack: null,
            isTransitioning: false,
            status: "playing",
            isPlaying: true,
            lyrics: null,
            isLyricsLoading: false
          });
          
          // Trigger progressive hydration in background
          try {
            const { HydrationScheduler } = require("./hydration.service");
            HydrationScheduler.scheduleHydration(validTrack);
          } catch (e) {
            console.warn("[playback.controller] Background hydration failed to schedule", e);
          }
          
          transitionManager.setTransitioning(false);
          transitionManager.clearCache([validTrack.id]);
          
          // Asynchronously print forensic logs
          PlaybackController.logForensicState(`transition: ${validTrack.title}`);
          
          store.preloadNext();
        } else {
          // Even if same track, ensure we reset transitioning if it was stuck
          if (store.isTransitioning) usePlayerStore.setState({ isTransitioning: false });
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

    TrackPlayer.addEventListener(Event.RemoteCustomAction, (event) => {
      const store = usePlayerStore.getState();
      if (event.customAction === "like") {
         // handle like
         console.log("Like triggered from notification");
      } else if (event.customAction === "loop") {
         const nextMode = store.repeatMode === "off" ? "track" : "off";
         store.setRepeatMode(nextMode);
      }
    });

    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
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
[RNTP] nativeIndex: ${nativeIndex}, activeMediaId: "${activeItem?.mediaId || activeItem?.id}"
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
