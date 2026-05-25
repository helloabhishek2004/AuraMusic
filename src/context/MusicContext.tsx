import React, { createContext, useCallback, useContext, useMemo } from "react";
import { usePlayerStore } from "../features/player/store/player.store";
import { PlayerTrack } from "../features/player/types/player";

export type Track = PlayerTrack;

type PlaybackStateContextType = {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  isLoading: boolean;
  repeatMode: 0 | 1; // 0: off, 1: track
  isShuffle: boolean;
  isPlayerReady: boolean;
};

type MusicProgressContextType = {
  progress: number;
  elapsedSec: number;
  durationSec: number;
  bufferedSec: number;
};

type MusicActionsContextType = {
  play: (track?: Track) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (progress: number) => Promise<void>;
  setTrack: (track: Track) => Promise<void>;
  setQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  playNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  toggleRepeat: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  preloadTrack: (track: Track) => Promise<string | null>;
};

export type MusicContextType = PlaybackStateContextType &
  MusicProgressContextType &
  MusicActionsContextType;

const PlaybackStateContext = createContext<
  PlaybackStateContextType | undefined
>(undefined);
const MusicProgressContext = createContext<
  MusicProgressContextType | undefined
>(undefined);
const MusicActionsContext = createContext<MusicActionsContextType | undefined>(
  undefined,
);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Use granular selectors to avoid re-rendering the provider when progress updates
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const status = usePlayerStore((s) => s.status);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffle = usePlayerStore((s) => s.isShuffle);

  // Actions - individual stable selectors to avoid object-literal rerender loop
  const setTrackStore = usePlayerStore((s) => s.setTrack);
  const setQueueStore = usePlayerStore((s) => s.setQueue);
  const playStore = usePlayerStore((s) => s.play);
  const pauseStore = usePlayerStore((s) => s.pause);
  const nextStore = usePlayerStore((s) => s.next);
  const previousStore = usePlayerStore((s) => s.previous);
  const seekStore = usePlayerStore((s) => s.seek);
  const playNextStore = usePlayerStore((s) => s.playNext);
  const addToQueueStore = usePlayerStore((s) => s.addToQueue);
  const setRepeatModeStore = usePlayerStore((s) => s.setRepeatMode);
  const toggleShuffleStore = usePlayerStore((s) => s.toggleShuffle);
  const setVolumeStore = usePlayerStore((s) => s.setVolume);
  const preloadTrackStore = usePlayerStore((s) => s.preloadTrack);

  const repeatModeMap: Record<string, 0 | 1> = {
    off: 0,
    track: 1,
  };

  const reverseRepeatModeMap: Record<number, "off" | "track"> = {
    0: "off",
    1: "track",
  };

  const playbackValue = useMemo<PlaybackStateContextType>(
    () => ({
      currentTrack: currentTrack
        ? {
            ...currentTrack,
            dominantColors: currentTrack.dominantColors || [
              "#bf5af2",
              "#7b2fbe",
            ],
          }
        : null,
      isPlaying,
      isBuffering,
      isLoading: status === "loading",
      repeatMode: repeatModeMap[repeatMode] as 0 | 1,
      isShuffle,
      isPlayerReady: true,
    }),
    [currentTrack, isPlaying, isBuffering, status, repeatMode, isShuffle],
  );

  const toggleRepeat = useCallback(async () => {
    const nextMode = repeatMode === "off" ? "track" : "off";
    setRepeatModeStore(nextMode);
  }, [repeatMode, setRepeatModeStore]);

  const actionsValue = useMemo<MusicActionsContextType>(
    () => ({
      play: async (track?: Track) =>
        track ? setTrackStore(track) : playStore(),
      pause: pauseStore,
      next: nextStore,
      prev: previousStore,
      seek: async (p: number) => {
        const duration = usePlayerStore.getState().duration;
        await seekStore(p * duration);
      },
      setTrack: setTrackStore,
      setQueue: setQueueStore,
      playNext: playNextStore,
      addToQueue: addToQueueStore,
      toggleRepeat,
      toggleShuffle: async () => {
        toggleShuffleStore();
      },
      setVolume: setVolumeStore,
      preloadTrack: preloadTrackStore,
    }),
    [
      setTrackStore,
      playStore,
      pauseStore,
      nextStore,
      previousStore,
      seekStore,
      setQueueStore,
      toggleRepeat,
      toggleShuffleStore,
      setVolumeStore,
      preloadTrackStore,
    ],
  );

  return (
    <PlaybackStateContext.Provider value={playbackValue}>
      <MusicActionsContext.Provider value={actionsValue}>
        {children}
      </MusicActionsContext.Provider>
    </PlaybackStateContext.Provider>
  );
};

export function usePlaybackState() {
  const context = useContext(PlaybackStateContext);
  if (!context)
    throw new Error("usePlaybackState must be used within MusicProvider");
  return context;
}

export function useMusicProgress(): MusicProgressContextType {
  const rntpProgress = require("@rntp/player").useProgress(0.5);

  return useMemo(
    () => ({
      progress: rntpProgress.duration > 0 ? rntpProgress.position / rntpProgress.duration : 0,
      elapsedSec: rntpProgress.position,
      durationSec: rntpProgress.duration,
      bufferedSec: rntpProgress.buffered,
    }),
    [rntpProgress.position, rntpProgress.duration, rntpProgress.buffered],
  );
}

export function useMusicActions() {
  const context = useContext(MusicActionsContext);
  if (!context)
    throw new Error("useMusicActions must be used within MusicProvider");
  return context;
}

export function useNowPlayingTrack() {
  return usePlaybackState().currentTrack;
}

export function useMusicControls() {
  const playback = usePlaybackState();
  const actions = useMusicActions();
  return useMemo(
    () => ({
      ...actions,
      isPlaying: playback.isPlaying,
      isBuffering: playback.isBuffering,
      isLoading: playback.isLoading,
      repeatMode: playback.repeatMode,
      isShuffle: playback.isShuffle,
      isPlayerReady: playback.isPlayerReady,
    }),
    [
      actions,
      playback.isPlayerReady,
      playback.isPlaying,
      playback.isBuffering,
      playback.isLoading,
      playback.isShuffle,
      playback.repeatMode,
    ],
  );
}

export function useMusic(): MusicContextType {
  return {
    ...usePlaybackState(),
    ...useMusicProgress(),
    ...useMusicActions(),
  };
}
