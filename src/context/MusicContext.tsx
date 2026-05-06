import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { clamp } from '@/src/utils/color';
import { catalogTracks, CatalogTrack } from '@/src/data/music-catalog';

// --- Safe TrackPlayer Setup ---
let TrackPlayer: any = null;
let Capability: any = {};
let Event: any = {};
let RepeatMode: any = { Off: 0, Track: 1, Queue: 2 };
let State: any = { None: 'none', Ready: 'ready', Playing: 'playing', Paused: 'paused', Stopped: 'stopped', Buffering: 'buffering', Loading: 'loading' };
let AppKilledPlaybackBehavior: any = {};
let AndroidAudioContentType: any = {};
let useProgress: any = () => ({ position: 0, duration: 0, buffered: 0 });
let useTrackPlayerEvents: any = () => {};

try {
  if (Platform.OS !== 'web') {
    const TP = require('react-native-track-player');
    TrackPlayer = TP.default;
    Capability = TP.Capability || {};
    Event = TP.Event || {};
    RepeatMode = TP.RepeatMode || RepeatMode;
    State = TP.State || State;
    AppKilledPlaybackBehavior = TP.AppKilledPlaybackBehavior || {};
    AndroidAudioContentType = TP.AndroidAudioContentType || {};
    useProgress = TP.useProgress;
    useTrackPlayerEvents = TP.useTrackPlayerEvents;
  }
} catch (e) {
  console.warn('TrackPlayer native module not found. Audio features will be disabled.');
}

export interface Track extends CatalogTrack {
  url: string;
}

type PlaybackStateContextType = {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  isLoading: boolean;
  repeatMode: RepeatModeValue;
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
  toggleRepeat: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
};

export type MusicContextType = PlaybackStateContextType & MusicProgressContextType & MusicActionsContextType;
type RepeatModeValue = any;

const MOCK_TRACKS: Track[] = catalogTracks.map(t => ({
  ...t,
  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' // Default fallback
}));

const PlaybackStateContext = createContext<PlaybackStateContextType | undefined>(undefined);
const MusicProgressContext = createContext<MusicProgressContextType | undefined>(undefined);
const MusicActionsContext = createContext<MusicActionsContextType | undefined>(undefined);

function normalizeTrack(track: any): Track | null {
  if (!track) return null;
  return {
    id: track.id,
    title: track.title || 'Unknown Title',
    artist: track.artist || 'Unknown Artist',
    artistId: track.artistId || 'unknown',
    url: track.url || '',
    art: track.artwork || track.art || '',
    durationSec: track.durationSec || track.duration || 0,
    dominantColors: track.dominantColors || ['#bf5af2', '#7b2fbe'],
  } as Track;
}

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(MOCK_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatModeValue>(RepeatMode.Off);
  const [isShuffle, setIsShuffle] = useState(false);

  // Faster progress updates for smoothness
  const { position, duration, buffered } = useProgress(200);
  const activeDuration = duration > 0 ? duration : currentTrack?.durationSec ?? 1;
  const progress = clamp(activeDuration > 0 ? position / activeDuration : 0);

  useEffect(() => {
    async function setupPlayer() {
      try {
        if (Platform.OS === 'web' || !TrackPlayer) {
          setIsPlayerReady(true);
          return;
        }

        let isSetup = false;
        try {
          const state = await TrackPlayer.getPlaybackState();
          isSetup = state.state !== State.None;
        } catch {
          isSetup = false;
        }

        if (!isSetup) {
          await TrackPlayer.setupPlayer({
            minBuffer: 15,
            maxBuffer: 50,
            playBuffer: 2.0,
            backBuffer: 15,
            maxCacheSize: 1024 * 64,
            autoHandleInterruptions: true,
            androidAudioContentType: AndroidAudioContentType.Music,
          });

          await TrackPlayer.updateOptions({
            android: {
              appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
              alwaysPauseOnInterruption: true,
            },
            capabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
              Capability.SeekTo,
              Capability.Stop,
            ],
            compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
            progressUpdateEventInterval: 0.2, // Smoother progress bar
          });

          await TrackPlayer.add(MOCK_TRACKS);
        }

        const index = await TrackPlayer.getActiveTrackIndex();
        if (typeof index === 'number') {
          const track = await TrackPlayer.getTrack(index);
          setCurrentTrack(normalizeTrack(track));
        }

        setRepeatMode(await TrackPlayer.getRepeatMode());
        setIsPlayerReady(true);
      } catch (error) {
        console.error('TrackPlayer setup failed:', error);
      }
    }

    setupPlayer();
  }, []);

  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackActiveTrackChanged, Event.PlaybackError], async (event: any) => {
    if (event.type === Event.PlaybackState) {
      const state = event.state;
      setIsPlaying(state === State.Playing);
      setIsBuffering(state === State.Buffering);
      setIsLoading(state === State.Loading);
    }

    if (event.type === Event.PlaybackActiveTrackChanged) {
      if (event.track) {
        setCurrentTrack(normalizeTrack(event.track));
      }
    }
    
    if (event.type === Event.PlaybackError) {
      console.warn('Playback error:', event.message);
    }
  });

  const play = useCallback(
    async (track?: Track) => {
      if (Platform.OS === 'web' || !TrackPlayer) {
        if (track) setCurrentTrack(track);
        setIsPlaying(true);
        return;
      }

      if (!isPlayerReady) return;

      if (track) {
        const queue = await TrackPlayer.getQueue();
        const index = queue.findIndex((item: any) => item.id === track.id);

        if (index >= 0) {
          await TrackPlayer.skip(index);
        } else {
          // If not in queue, add it after the current track and skip
          const currentIndex = await TrackPlayer.getActiveTrackIndex() ?? 0;
          await TrackPlayer.add([track], currentIndex + 1);
          await TrackPlayer.skip(currentIndex + 1);
        }
      }

      await TrackPlayer.play();
    },
    [isPlayerReady]
  );

  const pause = useCallback(async () => {
    if (Platform.OS === 'web' || !TrackPlayer) {
      setIsPlaying(false);
      return;
    }
    await TrackPlayer.pause();
  }, []);

  const next = useCallback(async () => {
    if (!TrackPlayer || !isPlayerReady) return;
    try {
      await TrackPlayer.skipToNext();
    } catch {
      // If at end of queue and no repeat, maybe stop or loop back
    }
  }, [isPlayerReady]);

  const prev = useCallback(async () => {
    if (!TrackPlayer || !isPlayerReady) return;
    try {
      const { position } = await TrackPlayer.getProgress();
      if (position > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch {
      await TrackPlayer.seekTo(0);
    }
  }, [isPlayerReady]);

  const seek = useCallback(
    async (requestedProgress: number) => {
      if (!TrackPlayer || !isPlayerReady) return;
      const { duration } = await TrackPlayer.getProgress();
      await TrackPlayer.seekTo(requestedProgress * duration);
    },
    [isPlayerReady]
  );

  const setTrack = useCallback(
    async (track: Track) => {
      await play(track);
    },
    [play]
  );

  const toggleRepeat = useCallback(async () => {
    if (!TrackPlayer || !isPlayerReady) return;
    const modes = [RepeatMode.Off, RepeatMode.Track, RepeatMode.Queue];
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    await TrackPlayer.setRepeatMode(nextMode);
    setRepeatMode(nextMode);
  }, [isPlayerReady, repeatMode]);

  const toggleShuffle = useCallback(async () => {
    setIsShuffle((v) => !v);
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    if (TrackPlayer) {
      await TrackPlayer.setVolume(clamp(volume, 0, 1));
    }
  }, []);

  const playbackValue = useMemo<PlaybackStateContextType>(
    () => ({
      currentTrack,
      isPlaying,
      isBuffering,
      isLoading,
      repeatMode,
      isShuffle,
      isPlayerReady,
    }),
    [currentTrack, isPlayerReady, isPlaying, isBuffering, isLoading, isShuffle, repeatMode]
  );

  const progressValue = useMemo<MusicProgressContextType>(
    () => ({
      progress,
      elapsedSec: position,
      durationSec: activeDuration,
      bufferedSec: buffered,
    }),
    [activeDuration, buffered, position, progress]
  );

  const actionsValue = useMemo<MusicActionsContextType>(
    () => ({
      play,
      pause,
      next,
      prev,
      seek,
      setTrack,
      toggleRepeat,
      toggleShuffle,
      setVolume,
    }),
    [next, pause, play, prev, seek, setTrack, toggleRepeat, toggleShuffle, setVolume]
  );

  return (
    <PlaybackStateContext.Provider value={playbackValue}>
      <MusicActionsContext.Provider value={actionsValue}>
        <MusicProgressContext.Provider value={progressValue}>
          {children}
        </MusicProgressContext.Provider>
      </MusicActionsContext.Provider>
    </PlaybackStateContext.Provider>
  );
};

export function usePlaybackState() {
  const context = useContext(PlaybackStateContext);
  if (!context) throw new Error('usePlaybackState must be used within MusicProvider');
  return context;
}

export function useMusicProgress() {
  const context = useContext(MusicProgressContext);
  if (!context) throw new Error('useMusicProgress must be used within MusicProvider');
  return context;
}

export function useMusicActions() {
  const context = useContext(MusicActionsContext);
  if (!context) throw new Error('useMusicActions must be used within MusicProvider');
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
    [actions, playback.isPlayerReady, playback.isPlaying, playback.isBuffering, playback.isLoading, playback.isShuffle, playback.repeatMode]
  );
}

export function useMusic(): MusicContextType {
  return {
    ...usePlaybackState(),
    ...useMusicProgress(),
    ...useMusicActions(),
  };
}
