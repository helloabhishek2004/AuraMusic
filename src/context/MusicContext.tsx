import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import TrackPlayer, { 
  Capability, 
  State, 
  Event, 
  useTrackPlayerEvents,
  useProgress,
  RepeatMode,
  Track as TPTrack
} from 'react-native-track-player';
import { Platform } from 'react-native';

export interface Track {
  id: string;
  url: string; // Local req or string url
  title: string;
  artist: string;
  art: string; // Used for UI
  artwork?: string; // Used for Lockscreen
  durationSec: number;
  duration?: number;
  dominantColors: string[];
}

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0 to 1
  elapsedSec: number;
  play: (track?: Track) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (progress: number) => Promise<void>;
  setTrack: (track: Track) => Promise<void>;
  toggleRepeat: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isPlayerReady: boolean;
}

const MOCK_TRACKS: Track[] = [
  {
    id: 'nebula',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: 'Nebula Drift',
    artist: 'Lumina Synthetics',
    durationSec: 372, // Actually song 1 is around ~6 mins
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
    dominantColors: ['#ffb4ab', '#93000a'],
  },
];

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.Off);
  const [isShuffle, setIsShuffle] = useState(false);

  const { position, duration } = useProgress(250); 
  // If trackplayer hasn't loaded duration yet, fallback to track.durationSec, else default to 1 to avoid NaN
  const activeDuration = duration > 0 ? duration : (currentTrack?.durationSec || 1);
  const progress = position / activeDuration;
  
  useEffect(() => {
    async function setupPlayer() {
      try {
        if (Platform.OS === 'web') return;
        let isSetup = false;
        try {
          const state = await TrackPlayer.getPlaybackState();
          isSetup = state.state !== State.None;
        } catch {
          isSetup = false;
        }
        
        if (!isSetup) {
          await TrackPlayer.setupPlayer({
            maxCacheSize: 1024 * 10, // 10 mb cache
            autoHandleInterruptions: true,
          });
          
          await TrackPlayer.updateOptions({
            // Defines the capabilities that are available to the user from the lock screen or notification
            capabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
              Capability.SkipToPrevious,
              Capability.SeekTo,
              Capability.Stop,
            ],
            // Defines the capabilities that will be visible in the compact notification
            compactCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.SkipToNext,
            ],
            progressUpdateEventInterval: 2,
          });

          await TrackPlayer.add(MOCK_TRACKS as any); // pre-load queue
          const track = MOCK_TRACKS[0];
          setCurrentTrack(track); // Initialize the context state
        }
        setIsPlayerReady(true);
      } catch (e) {
        console.log('Error setting up player:', e);
      }
    }
    setupPlayer();
  }, []);

  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackActiveTrackChanged], async (event) => {
    if (event.type === Event.PlaybackState) {
      setIsPlaying(event.state === State.Playing);
    }
    if (event.type === Event.PlaybackActiveTrackChanged) {
      if (event.track !== undefined && event.track !== null) {
        // use getTrack to get fully populated track details including our custom ones
        const trackProps = await TrackPlayer.getTrack(event.lastPosition === undefined ? event.index! : event.index!);
        setCurrentTrack((trackProps || event.track) as Track);
      } else {
        setCurrentTrack(null);
      }
    }
  });

  const play = useCallback(async (track?: Track) => {
    if (!isPlayerReady) return;
    if (track) {
      // Find track in queue
      const queue = await TrackPlayer.getQueue();
      const idx = queue.findIndex(t => t.id === track.id);
      if (idx !== -1) {
        await TrackPlayer.skip(idx);
      } else {
        // If not in queue, reset and add
        await TrackPlayer.reset();
        await TrackPlayer.add([track, ...MOCK_TRACKS.filter(t => t.id !== track.id)] as any);
      }
    }
    await TrackPlayer.play();
  }, [isPlayerReady]);

  const pause = useCallback(async () => {
    if (!isPlayerReady) return;
    await TrackPlayer.pause();
  }, [isPlayerReady]);

  const next = useCallback(async () => {
    if (!isPlayerReady) return;
    await TrackPlayer.skipToNext();
  }, [isPlayerReady]);

  const prev = useCallback(async () => {
    if (!isPlayerReady) return;
    await TrackPlayer.skipToPrevious();
  }, [isPlayerReady]);

  const seek = useCallback(async (p: number) => {
    if (!isPlayerReady) return;
    const dur = (await TrackPlayer.getProgress()).duration || (currentTrack?.durationSec ?? 0);
    const sec = Math.floor(p * dur);
    await TrackPlayer.seekTo(sec);
  }, [isPlayerReady, currentTrack]);

  const setTrack = useCallback(async (track: Track) => {
    if (!isPlayerReady) return;
    await play(track);
  }, [play, isPlayerReady]);

  const toggleRepeat = useCallback(async () => {
    if (!isPlayerReady) return;
    const nextMode = repeatMode === RepeatMode.Off ? RepeatMode.Track : 
                     repeatMode === RepeatMode.Track ? RepeatMode.Queue : RepeatMode.Off;
    await TrackPlayer.setRepeatMode(nextMode);
    setRepeatMode(nextMode);
  }, [repeatMode, isPlayerReady]);

  const toggleShuffle = useCallback(async () => {
    if (!isPlayerReady) return;
    setIsShuffle(prev => !prev);
  }, [isPlayerReady]);

  return (
    <MusicContext.Provider
      value={{
        currentTrack: currentTrack || MOCK_TRACKS[0],
        isPlaying,
        progress: Number.isFinite(progress) ? progress : 0,
        elapsedSec: position,
        play,
        pause,
        next,
        prev,
        seek,
        setTrack,
        toggleRepeat,
        toggleShuffle,
        repeatMode,
        isShuffle,
        isPlayerReady,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};
