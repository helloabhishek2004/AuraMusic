const ReactNative = require("react-native");
const { NativeModules, Platform } = ReactNative;

// --- Safe Mock for TrackPlayer Native Module ---
// V5 Note: @rntp/player requires new architecture (TurboModules/JSI).
// This mock provides fallback behavior for dev environments.
if (Platform.OS !== "web") {
  if (!NativeModules.RNTPPlayer || NativeModules.RNTPPlayer === null) {
    const mock = {
      setupPlayer: async () => {},
      setMediaItems: async () => {},
      setMediaPlaybackOptions: async () => {},
      reset: async () => {},
      play: async () => {},
      pause: async () => {},
      stop: async () => {},
      seekTo: async () => {},
      setVolume: async () => {},
      getVolume: async () => 1,
      getDuration: () => 0,
      getPosition: () => 0,
      getBufferedPosition: () => 0,
      getPlaybackState: () => "idle",
      getQueue: () => [],
      getActiveMediaItem: () => null,
      getProgress: () => ({ position: 0, duration: 0, buffered: 0 }),
      setRepeatMode: async () => {},
      getRepeatMode: () => "off",
      skipToNext: async () => {},
      skipToPrevious: async () => {},
      // Capabilities
      Capability: {
        PLAY: 0x00000001,
        PAUSE: 0x00000002,
        STOP: 0x00000004,
        SKIP_TO_NEXT: 0x00000010,
        SKIP_TO_PREVIOUS: 0x00000020,
        SEEK_TO: 0x00000100,
      },
      AppKilledPlaybackBehavior: {
        StopPlaybackAndRemoveNotification: 0,
      },
    };

    // Inject into NativeModules
    try {
      Object.defineProperty(NativeModules, "RNTPPlayer", {
        value: mock,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (e) {
      // Fallback to direct assignment
      NativeModules.RNTPPlayer = mock;
    }
  }
}

const Constants = require("expo-constants").default;
const { registerRootComponent } = require("expo");
const { ExpoRoot } = require("expo-router");

console.log("[AuraMusic] Startup environment", {
  expoSdkVersion:
    Constants.expoConfig?.sdkVersion || Constants.manifest?.sdkVersion,
  platform: Platform.OS,
  hasRNTPPlayerNative: !!NativeModules.RNTPPlayer,
});

// Safely import TrackPlayer and PlaybackService
let TrackPlayer;
let PlaybackService;

try {
  if (Platform.OS !== "web") {
    // V5: Core methods are on the default export
    TrackPlayer = require("@rntp/player").default;
    PlaybackService = require("./service").PlaybackService;
  }
} catch (e) {
  console.warn("[AuraMusic] TrackPlayer could not be initialized:", e.message);
}

export function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);

// Only register service if TrackPlayer is available
if (TrackPlayer && PlaybackService) {
  try {
    // V5: registerPlaybackService is replaced by registerBackgroundEventHandler
    TrackPlayer.registerBackgroundEventHandler(() => PlaybackService);
  } catch (e) {
    console.error("Failed to register PlaybackService:", e);
  }
}
