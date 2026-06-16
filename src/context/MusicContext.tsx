import React, { createContext, useCallback, useContext, useMemo, useEffect, useRef } from "react";
import { SharedValue } from "react-native-reanimated";
import { usePlayerStore } from "../features/player/store/player.store";
import { PlayerTrack, RepeatMode } from "../features/player/types/player";
import { playbackProgress } from "../features/player/services/playback-progress";

export type Track = PlayerTrack;

type TrackContextType = {
  currentTrack: Track | null;
};

type PlaybackStateContextType = {
  isPlaying: boolean;
  isBuffering: boolean;
  isLoading: boolean;
  repeatMode: RepeatMode; 
  isShuffle: boolean;
  isPlayerReady: boolean;
};

type MusicProgressContextType = {
  progress: SharedValue<number>;
  positionMs: SharedValue<number>;
  durationMs: SharedValue<number>;
  bufferedMs: SharedValue<number>;
};

import { QueueContext } from "../features/player/services/queue-intelligence";

type MusicActionsContextType = {
  play: (track?: Track) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  prev: (forcePrevious?: boolean) => Promise<void>;
  seek: (progress: number) => Promise<void>;
  setTrack: (track: Track) => Promise<void>;
  setQueue: (tracks: Track[], startIndex?: number, context?: QueueContext) => Promise<void>;
  playNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  toggleRepeat: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  preloadTrack: (track: Track) => Promise<string | null>;
};

export type MusicContextType = TrackContextType &
  PlaybackStateContextType &
  MusicProgressContextType &
  MusicActionsContextType;

const TrackContext = createContext<TrackContextType | undefined>(undefined);
const PlaybackStateContext = createContext<PlaybackStateContextType | undefined>(undefined);
const MusicProgressContext = createContext<MusicProgressContextType | undefined>(undefined);
const MusicActionsContext = createContext<MusicActionsContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const status = usePlayerStore((s) => s.status);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffle = usePlayerStore((s) => s.isShuffle);

  const memoizedTrack = useMemo(() => {
    if (!currentTrack) return null;
    return {
      ...currentTrack,
      dominantColors: currentTrack.dominantColors || ["#bf5af2", "#7b2fbe"]
    };
  }, [currentTrack]);

  const trackValue = useMemo<TrackContextType>(
    () => ({ currentTrack: memoizedTrack }),
    [memoizedTrack]
  );

  const playbackStateValue = useMemo<PlaybackStateContextType>(
    () => ({
      isPlaying,
      isBuffering,
      isLoading: status === "loading",
      repeatMode,
      isShuffle,
      isPlayerReady: true,
    }),
    [isPlaying, isBuffering, status, repeatMode, isShuffle],
  );

  const progressValue = useMemo<MusicProgressContextType>(
    () => ({
      progress: playbackProgress.progress,
      positionMs: playbackProgress.positionMs,
      durationMs: playbackProgress.durationMs,
      bufferedMs: playbackProgress.bufferedMs,
    }),
    [],
  );

  const toggleRepeat = useCallback(async () => {
    const currentRepeatMode = usePlayerStore.getState().repeatMode;
    let nextMode: RepeatMode = "off";
    if (currentRepeatMode === "off") nextMode = "queue";
    else if (currentRepeatMode === "queue") nextMode = "track";
    else if (currentRepeatMode === "track") nextMode = "off";

    usePlayerStore.getState().setRepeatMode(nextMode);
  }, []);

  const actionsValue = useMemo<MusicActionsContextType>(
    () => ({
      play: async (track?: Track) => track ? usePlayerStore.getState().setTrack(track) : usePlayerStore.getState().play(),
      pause: async () => usePlayerStore.getState().pause(),
      next: async () => usePlayerStore.getState().next(),
      prev: async (forcePrevious?: boolean) => usePlayerStore.getState().previous(forcePrevious),
      seek: async (p: number) => {
        const duration = usePlayerStore.getState().duration;
        await usePlayerStore.getState().seek(p * duration);
      },
      setTrack: async (track: Track) => usePlayerStore.getState().setTrack(track),
      setQueue: async (tracks: Track[], startIndex?: number, context?: QueueContext) => usePlayerStore.getState().setQueue(tracks, startIndex, context),
      playNext: (track: Track) => usePlayerStore.getState().playNext(track),
      addToQueue: (track: Track) => usePlayerStore.getState().addToQueue(track),
      toggleRepeat,
      toggleShuffle: async () => usePlayerStore.getState().toggleShuffle(),
      setVolume: async (volume: number) => usePlayerStore.getState().setVolume(volume),
      preloadTrack: async (track: Track) => usePlayerStore.getState().preloadTrack(track),
    }),
    [toggleRepeat],
  );

  const providerRenderCount = useRef(0);
  providerRenderCount.current += 1;
  useEffect(() => {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.info(`[MusicProvider] Rendered: count = ${providerRenderCount.current}, currentTrackId = ${currentTrack?.id}, isPlaying = ${isPlaying}`);
    }
  });

  return (
    <TrackContext.Provider value={trackValue}>
      <PlaybackStateContext.Provider value={playbackStateValue}>
        <MusicProgressContext.Provider value={progressValue}>
          <MusicActionsContext.Provider value={actionsValue}>
            {children}
          </MusicActionsContext.Provider>
        </MusicProgressContext.Provider>
      </PlaybackStateContext.Provider>
    </TrackContext.Provider>
  );
};

export function usePlaybackState() {
  const context = useContext(PlaybackStateContext);
  if (!context) throw new Error("usePlaybackState must be used within MusicProvider");
  return context;
}

export function useMusicProgress(): MusicProgressContextType {
  const context = useContext(MusicProgressContext);
  if (!context) throw new Error("useMusicProgress must be used within MusicProvider");
  return context;
}

export function useMusicActions() {
  const context = useContext(MusicActionsContext);
  if (!context) throw new Error("useMusicActions must be used within MusicProvider");
  return context;
}

export function useNowPlayingTrack() {
  const context = useContext(TrackContext);
  if (!context) throw new Error("useNowPlayingTrack must be used within MusicProvider");
  return context.currentTrack;
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
    [actions, playback],
  );
}

export function useMusic(): MusicContextType {
  const track = useContext(TrackContext);
  const playback = usePlaybackState();
  const progress = useMusicProgress();
  const actions = useMusicActions();
  
  if (!track) throw new Error("useMusic must be used within MusicProvider");

  return useMemo(() => ({
    ...track,
    ...playback,
    ...progress,
    ...actions,
  }), [track, playback, progress, actions]);
}
