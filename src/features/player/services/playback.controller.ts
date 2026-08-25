import { usePlayerStore } from "../store/player.store";
import { playbackProgress } from "./playback-progress";
import { onPlaybackStateChanged, onTrackChanged, NativePlaybackState } from "../../../services/native-core";
import { PlaybackService } from "./playback.service";

let _controllerInitialized = false;

export class PlaybackController {
  private static isInitialized = false;
  private static lastState: NativePlaybackState | null = null;
  private static sessionTrackId: string | null = null;
  private static sessionStartedAt: number = 0;
  private static sessionStartPositionMs: number = 0;
  private static maxPositionMs: number = 0;

  static initialize() {
    if (this.isInitialized || _controllerInitialized) return;
    this.isInitialized = true;
    _controllerInitialized = true;

    // Listen to our custom Native module
    onPlaybackStateChanged((state: NativePlaybackState) => {
      const store = usePlayerStore.getState();
      
      // Update store
      store.setPlaying(state.isPlaying);
      store.setBuffering(state.isBuffering);
      
      if (state.error) {
        console.error("[NativeCore] Playback Error:", state.error);
        store.setError(state.error);
        store.next(); // Try to skip on error
      } else {
        store.setError(null);
      }

      // Update progress
      playbackProgress.positionMs.value = state.positionMs;
      playbackProgress.durationMs.value = state.durationMs;
      
      // Update session max position for analytics
      if (state.positionMs > this.maxPositionMs) {
        this.maxPositionMs = state.positionMs;
      }
    });

    onTrackChanged((data: { event: string; trackId: string }) => {
      const store = usePlayerStore.getState();
      console.log(`[NativeCore] Track Event: ${data.event} for ${data.trackId}`);

      switch (data.event) {
        case 'PLAY_STARTED':
          this.startSession(data.trackId, playbackProgress.positionMs.value);
          // Sync store queue if needed
          const idx = store.queue.findIndex(t => t.id === data.trackId);
          if (idx !== -1 && idx !== store.currentIndex) {
            usePlayerStore.setState({ currentIndex: idx, currentTrack: store.queue[idx] });
          }
          break;
          
        case 'PLAY_COMPLETED':
          this.flushCurrentSession(true);
          // Auto-advance is handled natively via skipNext, but we just let the event sync the store
          store.resolveAutoAdvance();
          break;

        case 'PLAY_SKIPPED':
          this.flushCurrentSession(false);
          break;
      }
    });
  }

  private static startSession(trackId: string, startPositionMs: number = 0) {
    if (this.sessionTrackId && this.sessionTrackId !== trackId) {
      this.flushCurrentSession(false);
    }
    this.sessionTrackId = trackId;
    this.sessionStartedAt = Date.now();
    this.sessionStartPositionMs = startPositionMs;
    this.maxPositionMs = startPositionMs;
  }

  private static clearSession() {
    this.sessionTrackId = null;
    this.sessionStartedAt = 0;
    this.sessionStartPositionMs = 0;
    this.maxPositionMs = 0;
  }

  private static async flushCurrentSession(wasCompleted: boolean) {
    if (!this.sessionTrackId) return;
    const trackId = this.sessionTrackId;
    const finalPosition = this.maxPositionMs;
    this.clearSession();

    try {
      const playerStore = usePlayerStore.getState();
      const track = playerStore.queue.find(t => t.id === trackId) || playerStore.currentTrack;
      if (!track) return;
      
      const duration = track.duration || playerStore.duration || 0;
      const completionRatio = wasCompleted
        ? 1.0
        : (duration > 0 ? Math.min(1.0, finalPosition / (duration * 1000)) : 0);

      // Record to analytics
      const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
      useAnalyticsStore.getState().recordPlay(track, {
        duration: duration,
        listenDuration: finalPosition / 1000,
        completionRatio,
        completed: completionRatio >= 0.95 || wasCompleted,
        skipped: !wasCompleted && completionRatio < 0.95,
      });

    } catch (e) {
      console.warn("Failed to flush session", e);
    }
  }
}

// Auto-initialize on import
PlaybackController.initialize();

