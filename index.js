import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import { Platform, NativeModules } from 'react-native';

// --- Safe Mock for TrackPlayer Native Module ---
if (Platform.OS !== 'web' && !NativeModules.TrackPlayerModule) {
  NativeModules.TrackPlayerModule = {
    setupPlayer: async () => {},
    updateOptions: async () => {},
    add: async () => {},
    remove: async () => {},
    skip: async () => {},
    skipToNext: async () => {},
    skipToPrevious: async () => {},
    reset: async () => {},
    play: async () => {},
    pause: async () => {},
    stop: async () => {},
    seekTo: async () => {},
    setVolume: async () => {},
    getVolume: async () => 1,
    getDuration: async () => 0,
    getPosition: async () => 0,
    getBufferedPosition: async () => 0,
    getState: async () => 0,
    getQueue: async () => [],
    getActiveTrackIndex: async () => null,
    getTrack: async () => null,
    setRepeatMode: async () => {},
    getRepeatMode: async () => 0,
    // Add missing constants to prevent 'Cannot read property of null'
    CAPABILITY_PLAY: 1,
    CAPABILITY_PAUSE: 2,
    CAPABILITY_STOP: 4,
    CAPABILITY_SKIP_TO_NEXT: 16,
    CAPABILITY_SKIP_TO_PREVIOUS: 32,
    CAPABILITY_SEEK_TO: 256,
  };
}

// Safely import TrackPlayer and PlaybackService
let TrackPlayer;
let PlaybackService;

try {
  if (Platform.OS !== 'web') {
    TrackPlayer = require('react-native-track-player').default;
    PlaybackService = require('./service').PlaybackService;
  }
} catch (e) {
  console.warn('TrackPlayer could not be initialized:', e.message);
}

export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);

// Only register service if TrackPlayer is available
if (TrackPlayer && PlaybackService) {
  try {
    TrackPlayer.registerPlaybackService(() => PlaybackService);
  } catch (e) {
    console.error('Failed to register PlaybackService:', e);
  }
}
