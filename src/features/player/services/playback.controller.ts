import TrackPlayer, { Event, PlaybackState } from "@rntp/player";
import { usePlayerStore } from "../store/player.store";
import { PlayerTrack } from "../types/player";
import { transitionManager } from "./transition-manager";

let _controllerInitialized = false;
let _listenersRegistered = false;

/**
 * PlaybackController - The authoritative bridge between native RNTP and Zustand store.
 * Implemented as a singleton to ensure event listeners are registered exactly once.
 * Uses module-level flags to prevent duplicate registration across hot-reloads.
 */
export class PlaybackController {
  private static isInitialized = false;
  private static pollInterval: NodeJS.Timeout | null = null;
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
            this.startManualPolling();
          } else {
            store.setStatus("paused");
            this.stopManualPolling();
          }
          break;
        case PlaybackState.Buffering:
          store.setStatus("buffering");
          break;
        case PlaybackState.Ended:
          if (store.isTransitioning) return;
          
          store.updateProgress(0, store.duration, 0);
          this.stopManualPolling();
          store.next();
          break;
        case PlaybackState.Idle:
          if (store.status !== "idle") {
            store.setStatus("idle");
          }
          this.stopManualPolling();
          break;
        case PlaybackState.Error:
          store.setStatus("error");
          this.stopManualPolling();
          break;
      }
    });

    // 2. Is Playing Changed (Atomic toggle sync)
    TrackPlayer.addEventListener(Event.IsPlayingChanged, (data) => {
      const store = usePlayerStore.getState();
      const playing = data.playing;
      
      if (store.isPlaying !== playing) {
        store.setStatus(playing ? "playing" : "paused");
        
        if (playing) {
          this.startManualPolling();
        } else {
          this.stopManualPolling();
        }
      }
    });

    // 2.5. Player Error Handling
    TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
      console.error("[Player] Native Error:", error.message, error.code);
      const store = usePlayerStore.getState();
      
      store.setStatus("error");
      usePlayerStore.setState({ 
        error: error.message || "Native playback error",
        isBuffering: false,
        isTransitioning: false,
        isPlaying: false
      });
      
      this.stopManualPolling();
    });

    // 3. Media Item Transition (Sync currentIndex)
    TrackPlayer.addEventListener(Event.MediaItemTransition, (data) => {
      const { PlaybackService } = require('./playback.service');
      if (PlaybackService.isReorderingQueue()) return;

      const store = usePlayerStore.getState();
      if (!data.item) return;

      const newIndex = store.queue.findIndex((t: PlayerTrack) => t.id === data.item?.mediaId);
      if (newIndex !== -1 && newIndex !== store.currentIndex) {
        const nextTrack = store.queue[newIndex];
        if (!nextTrack) return;
        
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

        usePlayerStore.setState({ 
          currentIndex: newIndex, 
          currentTrack: validTrack,
          preloadedTrack: null,
          isTransitioning: false,
          status: "playing",
          isPlaying: true
        });
        
        transitionManager.setTransitioning(false);
        transitionManager.clearCache([validTrack.id]);
        
        store.preloadNext();
      }
    });

    // 4. Remote Control Events - silent execution
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
      TrackPlayer.play();
    });

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

    this.isInitialized = true;
  }

  private static startManualPolling() {
    if (this.pollInterval) return;
    
    this.pollInterval = setInterval(async () => {
      try {
        const store = usePlayerStore.getState();
        const progress = TrackPlayer.getProgress();
        
        const posMs = progress.position * 1000;
        const durMs = progress.duration * 1000;
        const bufMs = progress.buffered * 1000;
        
        if (Math.abs(store.position - posMs) > 200 || Math.abs(store.duration - durMs) > 500) {
          store.updateProgress(posMs, durMs, bufMs);
        }

        const nativeVolume = await TrackPlayer.getVolume();
        if (Math.abs(store.volume - nativeVolume) > 0.05) {
           usePlayerStore.setState({ volume: nativeVolume });
        }
      } catch (e) {}
    }, 250);
  }

  private static stopManualPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  static logNativeState(_context: string) {
    // Diagnostics disabled for production - can be enabled for debugging
  }
}

