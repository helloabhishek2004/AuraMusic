import { QueueContext } from "../services/queue-intelligence";

export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  art: string;
  url: string;
  duration?: number;
  dominantColors?: string[];
  isLocal?: boolean;
  album?: string;
  year?: string;
  source?: string;
  artistId?: string;
  albumId?: string;
  mimeType?: string;
  sourceFetchedAt?: number;
  isOfficial?: boolean;
  musicVideoType?: string;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';

export type RepeatMode = 'off' | 'track' | 'queue';

export type TransitionGuardOwner = 'setTrack' | 'skip' | 'previous' | 'autoAdvance' | 'jump';

export interface TransitionGuard {
  inProgress: boolean;
  owner: TransitionGuardOwner | null;
  destinationId: string | null;
  operationId: number;
}

export interface PlaybackState {
  currentTrack: PlayerTrack | null;
  previousTrack: PlayerTrack | null;
  originalQueue: PlayerTrack[];
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
  lastResolutionId: number;
  preloadedTrack: PlayerTrack | null;
  isTransitioning: boolean;
  isPreloading: boolean;
  isReordering: boolean;
  _transitionGuard: TransitionGuard;
  lyrics: any;
  isLyricsLoading: boolean;
  queueContext?: QueueContext | null;
}

export interface PlaybackActions {
  setTrack: (track: PlayerTrack) => Promise<void>;
  fetchLyrics: (track: PlayerTrack) => Promise<void>;
  setQueue: (tracks: PlayerTrack[], startIndex?: number, context?: QueueContext) => Promise<void>;
  addToQueue: (track: PlayerTrack) => void;
  playNext: (track: PlayerTrack) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  jumpToQueueIndex: (index: number) => Promise<void>;
  preloadNext: () => Promise<void>;
  preloadTrack: (track: PlayerTrack) => Promise<string | null>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlayback: () => Promise<void>;
  stop: () => Promise<void>;
  next: () => Promise<void>;
  previous: (forcePrevious?: boolean) => Promise<void>;
  seek: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  updateProgress: (position: number, duration: number, buffered: number) => void;
  setStatus: (status: PlaybackStatus) => void;
  injectAutoplayQueue: (continuationTracks: PlayerTrack[]) => Promise<void>;
}

export type PlayerStore = PlaybackState & PlaybackActions;
