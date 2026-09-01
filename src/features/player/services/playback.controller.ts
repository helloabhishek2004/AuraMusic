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
      usePlayerStore.setState({
        isPlaying: state.isPlaying,
        isBuffering: state.isBuffering,
        status: state.isPlaying ? 'playing' : (state.isBuffering ? 'buffering' : 'paused')
      });
      
      if (state.error) {
        console.error("[NativeCore] Playback Error:", state.error);
        usePlayerStore.setState({ error: state.error, status: "error" });
      } else {
        usePlayerStore.setState({ error: null });
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
          // Sync store queue with duplicate-awareness
          if (store.currentIndex >= 0 && store.currentIndex < store.queue.length && store.queue[store.currentIndex]?.id === data.trackId) {
            if (store.currentTrack?.id !== data.trackId) {
              usePlayerStore.setState({ currentTrack: store.queue[store.currentIndex] });
            }
          } else {
            const idx = store.queue.findIndex((t: any) => t.id === data.trackId);
            if (idx !== -1) {
              usePlayerStore.setState({ currentIndex: idx, currentTrack: store.queue[idx] });
            }
          }
          break;
          
        case 'PLAY_COMPLETED':
          this.flushCurrentSession(true);
          // Auto-advance is handled natively by AuraPlayer (ExoPlayer).
          // PLAY_STARTED for the next track will sync currentIndex and currentTrack.
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
      const track = playerStore.queue.find((t: any) => t.id === trackId) || playerStore.currentTrack;
      if (!track) return;
      
      const duration = track.duration || playerStore.duration || 0;
      const completionRatio = wasCompleted
        ? 1.0
        : (duration > 0 ? Math.min(1.0, finalPosition / (duration * 1000)) : 0);

      // Record to analytics
      const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
      const analytics = useAnalyticsStore.getState();
      if (analytics?.addHistoryEntry) {
        analytics.addHistoryEntry({
          id: track.id,
          title: track.title,
          artist: track.artist,
          artistId: track.artistId || null,
          album: track.album || null,
          albumId: track.albumId || null,
          art: track.artwork || track.art || null,
          artwork: track.artwork || track.art || null,
          duration: duration,
          position: finalPosition / 1000,
          positionMs: finalPosition,
          durationMs: duration * 1000,
          completionRatio,
          skipped: !wasCompleted && completionRatio < 0.95,
          trackSnapshot: track,
        });
      }

    } catch (e) {
      console.warn("Failed to flush session", e);
    }
  }
}

// Auto-initialize on import
PlaybackController.initialize();


