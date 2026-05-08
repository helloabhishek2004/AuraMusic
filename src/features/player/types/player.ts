export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  art: string;
  url: string;
  duration?: number;
  dominantColors?: string[];
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';

export type RepeatMode = 'off' | 'track' | 'queue';

export interface PlaybackState {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  currentIndex: number;
  status: PlaybackStatus;
  isPlaying: boolean;
  isBuffering: boolean;
  duration: number; // in milliseconds
  position: number; // in milliseconds
  bufferedPosition: number; // in milliseconds
  volume: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  error: string | null;
}

export interface PlaybackActions {
  setTrack: (track: PlayerTrack) => Promise<void>;
  setQueue: (tracks: PlayerTrack[], startIndex?: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlayback: () => Promise<void>;
  stop: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  updateProgress: (position: number, duration: number, buffered: number) => void;
  setStatus: (status: PlaybackStatus) => void;
}

export type PlayerStore = PlaybackState & PlaybackActions;
