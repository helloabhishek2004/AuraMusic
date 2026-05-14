import TrackPlayer, { Event, PlaybackState } from "@rntp/player";
import { usePlayerStore } from "../store/player.store";
import { PlayerTrack } from "../types/player";

/**
 * PlaybackController - The authoritative bridge between native RNTP and Zustand store.
 * Implemented as a singleton to ensure event listeners are registered exactly once.
 */
export class PlaybackController {
  private static isInitialized = false;
  private static pollInterval: NodeJS.Timeout | null = null;
  private static lastState: PlaybackState | null = null;

  static initialize() {
    if (this.isInitialized) {
      console.log("[Player] PlaybackController already initialized, skipping.");
      return;
    }

    console.log("[Player] PlaybackController initializing (Singleton)...");

    // 1. Playback State Changed
    TrackPlayer.addEventListener(Event.PlaybackStateChanged, (data) => {
      const store = usePlayerStore.getState();
      const newState = data.state;
      
      if (this.lastState === newState) return; // Deduplicate
      const previousState = this.lastState;
      this.lastState = newState;

      console.log("[Player] Playback state:", newState);

      // Deep diagnostics for local playback
      if (store.currentTrack?.isLocal) {
        const progress = TrackPlayer.getProgress();
        const activeItem = TrackPlayer.getActiveMediaItem();
        console.log(`[LocalPlayer Diagnostic] State: ${previousState} -> ${newState}`, {
          activeTrack: activeItem?.title,
          activeId: activeItem?.mediaId,
          pos: progress.position.toFixed(2),
          dur: progress.duration.toFixed(2),
        });

        if (previousState === PlaybackState.Buffering && newState === PlaybackState.Idle) {
          console.error("[LocalPlayer] Native preparation failed: buffering -> idle transition detected.");
        }
      }

      switch (newState) {
        case PlaybackState.Ready:
          if (TrackPlayer.isPlaying()) {
            store.setStatus("playing");
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
          if (store.isTransitioning) {
            console.log("[Player] Ignoring Ended event during active transition.");
            return;
          }
          console.log("[Player] Track ended naturally.");
          store.updateProgress(0, store.duration, 0);
          this.stopManualPolling();
          
          // Use store.next() to handle the transition safely
          store.next();
          break;
        case PlaybackState.Idle:
          store.setStatus("idle");
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
      
      // Only update if there is a divergence to prevent event storms
      if (store.isPlaying !== playing) {
        console.log("[Player] IsPlaying sync:", playing);
        store.setStatus(playing ? "playing" : "paused");
        
        if (playing) {
          this.startManualPolling();
        } else {
          this.stopManualPolling();
        }
      }
    });

    // 3. Media Item Transition (Sync currentIndex)
    TrackPlayer.addEventListener(Event.MediaItemTransition, (data) => {
      const store = usePlayerStore.getState();
      if (!data.item) return;

      const newIndex = store.queue.findIndex((t: PlayerTrack) => t.id === data.item?.mediaId);
      if (newIndex !== -1 && newIndex !== store.currentIndex) {
        console.log(`[Player] Native transition sync: ${newIndex}`);
        
        const nextTrack = store.queue[newIndex];
        const preloaded = store.preloadedTrack;

        usePlayerStore.setState({ 
          currentIndex: newIndex, 
          currentTrack: (preloaded && preloaded.id === nextTrack.id) ? preloaded : nextTrack,
          preloadedTrack: null
        });

        store.preloadNext();
      }
    });

    // 4. Remote Control Events (Deduplicated - No logic in service.js)
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
      console.log("[Player] Remote Play");
      TrackPlayer.play();
    });

    TrackPlayer.addEventListener(Event.RemotePause, () => {
      console.log("[Player] Remote Pause");
      TrackPlayer.pause();
    });

    TrackPlayer.addEventListener(Event.RemoteNext, () => {
      console.log("[Player] Remote Next");
      usePlayerStore.getState().next();
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
      console.log("[Player] Remote Previous");
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
    console.log("[Player] PlaybackController initialized successfully.");
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
        
        // Use shallow checks to reduce store updates
        if (Math.abs(store.position - posMs) > 300 || Math.abs(store.duration - durMs) > 1000) {
          store.updateProgress(posMs, durMs, bufMs);
        }

        // Sync Volume with threshold
        const nativeVolume = await TrackPlayer.getVolume();
        if (Math.abs(store.volume - nativeVolume) > 0.05) {
           usePlayerStore.setState({ volume: nativeVolume });
        }
      } catch (e) {
        // Silent catch for JSI read failures during transitions
      }
    }, 500);
  }

  private static stopManualPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  static logNativeState(context: string) {
    try {
      const state = TrackPlayer.getPlaybackState();
      const activeTrack = TrackPlayer.getActiveMediaItem();
      const progress = TrackPlayer.getProgress();

      console.log(`[Playback Diagnostics] @ ${context}:`, {
        state,
        track: activeTrack?.title ?? "None",
        pos: progress.position.toFixed(1),
        dur: progress.duration.toFixed(1),
      });
    } catch (e) {}
  }
}

