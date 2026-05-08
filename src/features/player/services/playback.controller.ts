import TrackPlayer, { Event } from "@rntp/player";
import { usePlayerStore } from "../store/player.store";

/**
 * PlaybackController - The bridge between the audio engine and the state management.
 * This is the ONLY place where TrackPlayer events are converted into Store actions.
 *
 * V5 Migration: Event listeners are registered directly on TrackPlayer.
 * State values are now string enums (e.g., 'playing', 'paused', 'idle').
 */
export const PlaybackController = {
  initialize: () => {
    console.log("[Player] PlaybackController initializing...");

    // Diagnostic Helper - V5 uses synchronous getters via JSI
    const logNativeState = (context: string) => {
      try {
        const state = TrackPlayer.getPlaybackState();
        const activeTrack = TrackPlayer.getActiveMediaItem();
        const queue = TrackPlayer.getQueue();
        const progress = TrackPlayer.getProgress();

        console.log(`[Playback Diagnostics] @ ${context}:`, {
          state,
          activeTrack: activeTrack?.title ?? "None",
          queueSize: queue.length,
          position: progress.position,
          duration: progress.duration,
        });
      } catch (e) {
        console.warn("[Player] Diagnostic read failed:", e);
      }
    };

    // Playback state changed
    TrackPlayer.addEventListener(Event.PlaybackStateChanged, (data) => {
      const store = usePlayerStore.getState();
      const newState = typeof data === 'string' ? data : data.state;
      
      console.log("[Player] Playback state event:", newState, "(Raw:", data, ")");
      logNativeState("StateChange");

      switch (newState) {
        case "playing":
          store.setStatus("playing");
          startManualPolling();
          break;
        case "paused":
          store.setStatus("paused");
          stopManualPolling();
          break;
        case "buffering":
        case "loading":
          store.setStatus("buffering");
          break;
        case "idle":
        case "stopped":
          store.setStatus("idle");
          stopManualPolling();
          // Reset progress on stop
          store.updateProgress(0, store.duration, 0);
          break;
        case "error":
          store.setStatus("error");
          stopManualPolling();
          break;
      }
    });

    // Is playing changed (More reliable in some v5 scenarios)
    TrackPlayer.addEventListener(Event.IsPlayingChanged, (data) => {
      const store = usePlayerStore.getState();
      const playing = typeof data === 'boolean' ? data : data.playing;
      console.log("[Player] IsPlaying event:", playing);
      
      if (playing) {
        store.setStatus("playing");
        startManualPolling();
      } else {
        // Only set to paused if we were actually playing or buffering
        // This avoids overriding 'loading' state when a track is first initialized
        if (store.status === "playing" || store.status === "buffering") {
          store.setStatus("paused");
        }
        stopManualPolling();
      }
    });

    // Progress updated (Native event)
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (data) => {
      const store = usePlayerStore.getState();
      store.updateProgress(
        data.position * 1000,
        data.duration * 1000,
        data.buffered * 1000,
      );
    });

    // Manual Polling Mechanism for v5
    let pollInterval: NodeJS.Timeout | null = null;

    const startManualPolling = () => {
      if (pollInterval) return;
      console.log("[Player] Starting manual progress polling...");
      pollInterval = setInterval(() => {
        try {
          const progress = TrackPlayer.getProgress();
          const store = usePlayerStore.getState();
          store.updateProgress(
            progress.position * 1000,
            progress.duration * 1000,
            progress.buffered * 1000
          );
        } catch (e) {
          // Ignore polling errors
        }
      }, 500);
    };

    const stopManualPolling = () => {
      if (pollInterval) {
        console.log("[Player] Stopping manual progress polling...");
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    // Media item transition (Queue handling)
    TrackPlayer.addEventListener(Event.MediaItemTransition, (data) => {
      console.log("[Player] Media item transition:", data);
      const store = usePlayerStore.getState();
      
      if (!data.item) {
        // Queue ended or item is null
        if (store.repeatMode === "queue") {
          store.next();
        } else {
          store.setStatus("idle");
        }
      }
    });

    // Remote control events
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
      console.log("[Player] RemotePlay received");
      TrackPlayer.play();
    });

    TrackPlayer.addEventListener(Event.RemotePause, () => {
      console.log("[Player] RemotePause received");
      TrackPlayer.pause();
    });

    TrackPlayer.addEventListener(Event.RemoteNext, () => {
      console.log("[Player] RemoteNext received");
      usePlayerStore.getState().next();
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
      console.log("[Player] RemotePrevious received");
      usePlayerStore.getState().previous();
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
      console.log("[Player] RemoteSeek received", event);
      TrackPlayer.seekTo(event.position);
    });

    // Initial state log
    logNativeState("InitialLoad");
  },
};
