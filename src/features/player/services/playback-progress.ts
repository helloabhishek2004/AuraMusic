/**
 * playback-progress.ts — Singleton SharedValue Progress Pipeline
 *
 * Written by PlaybackController at ~5Hz (200ms native events).
 * Read by scrubber, lyrics, and mini-player on the UI thread.
 * Zero React participation — no component rerenders from progress updates.
 *
 * Uses `makeMutable` instead of `useSharedValue` because this is a
 * module-level singleton, not a React hook.
 */
import { makeMutable, SharedValue } from 'react-native-reanimated';

let _positionMs: SharedValue<number> | null = null;
let _durationMs: SharedValue<number> | null = null;
let _bufferedMs: SharedValue<number> | null = null;
let _progress: SharedValue<number> | null = null;

export const playbackProgress = {
  /** Current playback position in milliseconds */
  get positionMs(): SharedValue<number> {
    if (!_positionMs) _positionMs = makeMutable(0);
    return _positionMs;
  },
  /** Total track duration in milliseconds */
  get durationMs(): SharedValue<number> {
    if (!_durationMs) _durationMs = makeMutable(0);
    return _durationMs;
  },
  /** Buffered position in milliseconds */
  get bufferedMs(): SharedValue<number> {
    if (!_bufferedMs) _bufferedMs = makeMutable(0);
    return _bufferedMs;
  },
  /** Playback progress as a percentage (0 to 1) */
  get progress(): SharedValue<number> {
    if (!_progress) _progress = makeMutable(0);
    return _progress;
  },
};
