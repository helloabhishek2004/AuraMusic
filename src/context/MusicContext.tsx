import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { clamp } from '@/src/utils/color';

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

type TrackPlayerTrack = any;

export interface Track {
  id: string;
  url: string;
  title: string;
  artist: string;
  art: string;
  artwork?: string;
  durationSec: number;
  duration?: number;
  dominantColors: string[];
}

type PlaybackStateContextType = {
  currentTrack: Track | null;
  isPlaying: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isPlayerReady: boolean;
};

type MusicProgressContextType = {
  progress: number;
  elapsedSec: number;
  durationSec: number;
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
};

export type MusicContextType = PlaybackStateContextType & MusicProgressContextType & MusicActionsContextType;

const MOCK_TRACKS: Track[] = [
  {
    id: 'nebula',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: 'Nebula Drift',
    artist: 'Lumina Synthetics',
    durationSec: 372,
    art: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDvPx_cacsyYoMUH_pNgGcRi4uEGEaZclAzYYTxP8ay88S1AGyEJzlo-cwY2a6vZpRxUqjOFJw8VVM6XorKQgOWTk9FbTnPrm8W8zvJtr_cDobTY0PBpm8a2VfZfcWgNzo9pkQ9KXfJUkwnW95tzuNJRV-0kfiHpAbzv1fgRb92yKUgDA_1wbr6etz41zwCt3BIh0_PCA8pdp3keJxQiVlohG_nAlmNZy3lBQc2e6uYRHW9W9sBR3js83IaO9EFfNUAYDjheUgRFE',
    artwork: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDvPx_cacsyYoMUH_pNgGcRi4uEGEaZclAzYYTxP8ay88S1AGyEJzlo-cwY2a6vZpRxUqjOFJw8VVM6XorKQgOWTk9FbTnPrm8W8zvJtr_cDobTY0PBpm8a2VfZfcWgNzo9pkQ9KXfJUkwnW95tzuNJRV-0kfiHpAbzv1fgRb92yKUgDA_1wbr6etz41zwCt3BIh0_PCA8pdp3keJxQiVlohG_nAlmNZy3lBQc2e6uYRHW9W9sBR3js83IaO9EFfNUAYDjheUgRFE',
    dominantColors: ['#bf5af2', '#7b2fbe'],
  },
  {
    id: 'neon',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    title: 'Neon Nights',
    artist: 'Synthwave Collective',
    durationSec: 425,
    art: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=320',
    artwork: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=320',
    dominantColors: ['#46f5e0', '#005950'],
  },
  {
    id: 'solar',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    title: 'Solar Flare',
    artist: 'Cosmic Echo',
    durationSec: 344,
    art: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=320',
    artwork: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=320',
    dominantColors: ['#ff7a8a', '#93000a'],
  },
];

const PlaybackStateContext = createContext<PlaybackStateContextType | undefined>(undefined);
const MusicProgressContext = createContext<MusicProgressContextType | undefined>(undefined);
const MusicActionsContext = createContext<MusicActionsContextType | undefined>(undefined);

function normalizeTrack(track: TrackPlayerTrack | Track | undefined | null): Track | null {
  if (!track) return null;
  const match = MOCK_TRACKS.find((item) => item.id === track.id);
  return {
    ...match,
    ...track,
    art: (track as Track).art ?? track.artwork ?? match?.art ?? '',
    artwork: track.artwork ?? (track as Track).art ?? match?.artwork,
    durationSec: (track as Track).durationSec ?? track.duration ?? match?.durationSec ?? 1,
    dominantColors: (track as Track).dominantColors ?? match?.dominantColors ?? ['#bf5af2', '#7b2fbe'],
  } as Track;
}

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(MOCK_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.Off);
  const [isShuffle, setIsShuffle] = useState(false);

  const { position, duration } = useProgress(500);
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
            minBuffer: 18,
            maxBuffer: 52,
            playBuffer: 1.4,
            backBuffer: 18,
            maxCacheSize: 1024 * 48,
            autoHandleInterruptions: true,
            autoUpdateMetadata: true,
            androidAudioContentType: AndroidAudioContentType.Music,
          });

          await TrackPlayer.updateOptions({
            android: {
              appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
              alwaysPauseOnInterruption: true,
              stopForegroundGracePeriod: 8,
            },
            capabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
              Capability.SeekTo,
              Capability.Stop,
            ],
            notificationCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
              Capability.SeekTo,
            ],
            compactCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
            ],
            progressUpdateEventInterval: 1,
          });

          await TrackPlayer.add(MOCK_TRACKS);
        }

        const index = await TrackPlayer.getActiveTrackIndex();
        if (typeof index === 'number') {
          const track = await TrackPlayer.getTrack(index);
          setCurrentTrack(normalizeTrack(track));
        } else {
          setCurrentTrack(MOCK_TRACKS[0]);
        }

        setRepeatMode(await TrackPlayer.getRepeatMode());
        setIsPlayerReady(true);
      } catch (error) {
        console.log('Error setting up player:', error);
        setCurrentTrack(MOCK_TRACKS[0]);
      }
    }

    setupPlayer();
  }, []);

  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackActiveTrackChanged], async (event) => {
    if (event.type === Event.PlaybackState) {
      setIsPlaying(event.state === State.Playing);
    }

    if (event.type === Event.PlaybackActiveTrackChanged) {
      setCurrentTrack(normalizeTrack(event.track));
    }
  });

  const play = useCallback(
    async (track?: Track) => {
      if (Platform.OS === 'web' || !TrackPlayer) {
        if (track) setCurrentTrack(track);
        setIsPlaying(true);
        setIsPlayerReady(true);
        return;
      }

      if (!isPlayerReady) return;

      if (track) {
        setCurrentTrack(track);
        const queue = await TrackPlayer.getQueue();
        const index = queue.findIndex((item) => item.id === track.id);

        if (index >= 0) {
          await TrackPlayer.skip(index);
        } else {
          await TrackPlayer.reset();
          await TrackPlayer.add([track, ...MOCK_TRACKS.filter((item) => item.id !== track.id)]);
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
    if (!isPlayerReady) return;
    await TrackPlayer.pause();
  }, [isPlayerReady]);

  const next = useCallback(async () => {
    if (Platform.OS === 'web' || !TrackPlayer) return;
    if (!isPlayerReady) return;

    try {
      if (isShuffle) {
        const queue = await TrackPlayer.getQueue();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        const nextIndex = queue.length <= 1
          ? 0
          : Math.floor(Math.random() * queue.length);
        await TrackPlayer.skip(nextIndex === activeIndex ? (nextIndex + 1) % queue.length : nextIndex);
      } else {
        await TrackPlayer.skipToNext();
      }
    } catch {
      await TrackPlayer.skip(0);
    }
  }, [isPlayerReady, isShuffle]);

  const prev = useCallback(async () => {
    if (Platform.OS === 'web' || !TrackPlayer) return;
    if (!isPlayerReady) return;

    try {
      await TrackPlayer.skipToPrevious();
    } catch {
      await TrackPlayer.seekTo(0);
    }
  }, [isPlayerReady]);

  const seek = useCallback(
    async (requestedProgress: number) => {
      const safeProgress = clamp(requestedProgress);
      if (Platform.OS === 'web' || !TrackPlayer) return;
      if (!isPlayerReady) return;

      const playerProgress = await TrackPlayer.getProgress();
      const durationSec = playerProgress.duration || currentTrack?.durationSec || 0;
      await TrackPlayer.seekTo(Math.floor(safeProgress * durationSec));
    },
    [currentTrack?.durationSec, isPlayerReady]
  );

  const setTrack = useCallback(
    async (track: Track) => {
      await play(track);
    },
    [play]
  );

  const toggleRepeat = useCallback(async () => {
    const nextMode =
      repeatMode === RepeatMode.Off
        ? RepeatMode.Track
        : repeatMode === RepeatMode.Track
          ? RepeatMode.Queue
          : RepeatMode.Off;

    setRepeatMode(nextMode);

    if (Platform.OS !== 'web' && isPlayerReady && TrackPlayer) {
      await TrackPlayer.setRepeatMode(nextMode);
    }
  }, [isPlayerReady, repeatMode]);

  const toggleShuffle = useCallback(async () => {
    setIsShuffle((value) => !value);
  }, []);

  const playbackValue = useMemo<PlaybackStateContextType>(
    () => ({
      currentTrack: currentTrack ?? MOCK_TRACKS[0],
      isPlaying,
      repeatMode,
      isShuffle,
      isPlayerReady,
    }),
    [currentTrack, isPlayerReady, isPlaying, isShuffle, repeatMode]
  );

  const progressValue = useMemo<MusicProgressContextType>(
    () => ({
      progress,
      elapsedSec: position,
      durationSec: activeDuration,
    }),
    [activeDuration, position, progress]
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
    }),
    [next, pause, play, prev, seek, setTrack, toggleRepeat, toggleShuffle]
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
      repeatMode: playback.repeatMode,
      isShuffle: playback.isShuffle,
      isPlayerReady: playback.isPlayerReady,
    }),
    [actions, playback.isPlayerReady, playback.isPlaying, playback.isShuffle, playback.repeatMode]
  );
}

export function useMusic(): MusicContextType {
  return {
    ...usePlaybackState(),
    ...useMusicProgress(),
    ...useMusicActions(),
  };
}
