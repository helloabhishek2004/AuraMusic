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

      // Update playback-state fields
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

      // Update progress shared values (drives UI progress bar, no store write)
      playbackProgress.positionMs.value = state.positionMs;
      playbackProgress.durationMs.value = state.durationMs;

      // Update session max position for analytics
      if (state.positionMs > this.maxPositionMs) {
        this.maxPositionMs = state.positionMs;
      }

      // == FIX #1: Identity-Authoritative Native Reconciliation ==
      // Native Media3 currentMediaItem.id (= currentTrackId) is the single source of
      // truth for which track is currently playing.
      //
      // We reconcile JS state to native HERE -- in onPlaybackStateChanged -- rather
      // than waiting exclusively for PLAY_STARTED, because:
      //   * Cache hits do not reliably fire PLAY_STARTED
      //   * Seamless transitions may skip PLAY_STARTED
      //   * Downloaded-track playback may not emit PLAY_STARTED on every transition
      //
      // STALE-EVENT PROTECTION: we only reconcile when nativeTrackId != jsTrackId.
      // A late state event for the old track will have the old trackId, which is
      // already === jsTrackId (since we just updated to B), so it will be ignored.
      const nativeTrackId = state.currentTrackId;
      const jsTrackId = store.currentTrack?.id ?? null;

      if (nativeTrackId && nativeTrackId !== jsTrackId) {
        console.log(
          `[JS_TRACK_RECONCILE] NATIVE_CURRENT_TRACK=${nativeTrackId} JS_CURRENT=${jsTrackId ?? 'null'} -- reconciling JS state to native`
        );

        const queue = store.queue;
        const currentIdx = store.currentIndex;

        // Duplicate-queue-aware index resolution
        // Native only exposes trackId (not queue index) in state events.
        // If the same track appears multiple times (A B A C), we must not blindly
        // use findIndex(id) as it returns the FIRST occurrence.
        //
        // Strategy:
        //   1. If queue[currentIndex] === nativeTrackId, currentIndex is still valid.
        //   2. Scan FORWARD from currentIndex+1 (natural advance / next).
        //   3. Scan from 0 to currentIndex (wrap-around, shuffle, user jump backward).
        let resolvedIdx = -1;

        if (queue[currentIdx]?.id === nativeTrackId) {
          resolvedIdx = currentIdx; // current index still valid
        } else {
          // Forward scan -- most likely next track
          for (let i = currentIdx + 1; i < queue.length; i++) {
            if (queue[i]?.id === nativeTrackId) { resolvedIdx = i; break; }
          }
          // Backward / full scan -- shuffle, jump, or wrap
          if (resolvedIdx === -1) {
            for (let i = 0; i < currentIdx; i++) {
              if (queue[i]?.id === nativeTrackId) { resolvedIdx = i; break; }
            }
          }
        }

        if (resolvedIdx !== -1) {
          const resolvedTrack = queue[resolvedIdx];
          console.log(
            `[JS_TRACK_RECONCILE] RESOLVED idx=${resolvedIdx} title="${resolvedTrack.title}" id=${nativeTrackId}`
          );
          usePlayerStore.setState({
            currentTrack: resolvedTrack,
            currentIndex: resolvedIdx,
          });
        } else {
          // Track not in JS queue (e.g. downloaded song clicked while online queue was active,
          // or external media button event).
          // NEVER leave currentTrack stuck on the old track!
          console.warn(
            `[JS_TRACK_RECONCILE] QUEUE_MISMATCH nativeTrackId=${nativeTrackId} not found in JS queue (size=${queue.length}). Recovering track identity.`
          );
          const recovered = this.recoverTrack(nativeTrackId);
          console.log(
            `[JS_TRACK_RECONCILE] RECOVERED track="${recovered.title}" (${nativeTrackId})`
          );
          usePlayerStore.setState({
            currentTrack: recovered,
            queue: [recovered],
            currentIndex: 0,
          });
        }
      }
      // == END FIX #1 ==
    });

    onTrackChanged((data: { event: string; trackId: string }) => {
      const store = usePlayerStore.getState();
      console.log(
        `[NATIVE_TRACK_TRANSITION] event=${data.event} trackId=${data.trackId} jsCurrentTrack=${store.currentTrack?.id ?? 'null'}`
      );

      switch (data.event) {
        case 'PLAY_STARTED':
          this.startSession(data.trackId, playbackProgress.positionMs.value);
          // Secondary reconciliation guard:
          if (
            store.currentIndex >= 0 &&
            store.currentIndex < store.queue.length &&
            store.queue[store.currentIndex]?.id === data.trackId
          ) {
            if (store.currentTrack?.id !== data.trackId) {
              usePlayerStore.setState({ currentTrack: store.queue[store.currentIndex] });
            }
          } else if (store.currentTrack?.id !== data.trackId) {
            const queue = store.queue;
            const currentIdx = store.currentIndex;
            let resolvedIdx = -1;
            for (let i = currentIdx + 1; i < queue.length; i++) {
              if (queue[i]?.id === data.trackId) { resolvedIdx = i; break; }
            }
            if (resolvedIdx === -1) {
              for (let i = 0; i < queue.length; i++) {
                if (queue[i]?.id === data.trackId) { resolvedIdx = i; break; }
              }
            }
            if (resolvedIdx !== -1) {
              usePlayerStore.setState({ currentIndex: resolvedIdx, currentTrack: queue[resolvedIdx] });
            } else {
              const recovered = this.recoverTrack(data.trackId);
              usePlayerStore.setState({
                currentTrack: recovered,
                queue: [recovered],
                currentIndex: 0,
              });
            }
          }
          break;

        case 'PLAY_COMPLETED':
          this.flushCurrentSession(true);
          try {
            const { useSettingsStore } = require('../../settings/store/settings.store');
            const autoplayEnabled = useSettingsStore.getState().autoplayEnabled;
            const isAtEnd = store.currentIndex >= store.queue.length - 1;
            const isRepeatOff = store.repeatMode === 'off';

            if (autoplayEnabled && isAtEnd && isRepeatOff && store.currentTrack) {
              const { AutoplayRadio } = require('./autoplay-radio');
              AutoplayRadio.generateContinuationQueue(store.currentTrack)
                .then((continuationTracks: any[]) => {
                  if (continuationTracks && continuationTracks.length > 0) {
                    console.log(`[AutoplayRadio] Injected ${continuationTracks.length} continuation tracks at queue end`);
                    usePlayerStore.getState().injectAutoplayQueue(continuationTracks);
                  }
                })
                .catch((err: any) => {
                  console.warn('[AutoplayRadio] Error generating continuation queue:', err);
                });
            }
          } catch (e) {
            console.warn('[PlaybackController] Autoplay trigger error:', e);
          }
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

  private static recoverTrack(trackId: string): any {
    try {
      const { useDownloadStore } = require("../../download/store/download.store");
      const downloaded = useDownloadStore.getState().downloadedTracks[trackId];
      if (downloaded) return downloaded;
    } catch (_) {}

    try {
      const { useLikesStore } = require("../../likes/store/likes.store");
      const liked = useLikesStore.getState().likedTracks?.find((t: any) => t.id === trackId);
      if (liked) return liked;
    } catch (_) {}

    return {
      id: trackId,
      title: "Playing Track",
      artist: "AuraMusic",
      art: "",
      url: `auramusic://track/${trackId}`,
      duration: 0,
      isLocal: true,
    };
  }
}

// Auto-initialize on import
PlaybackController.initialize();
