import React, { useEffect, useMemo } from 'react';
import { BackPriorityProvider, useNavigationBack } from '../src/navigation/back';
import { Stack, useRouter } from 'expo-router';
import { ThemeProvider as NavigationThemeProvider, DarkTheme } from '@react-navigation/native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { MusicProvider, useNowPlayingTrack } from '../src/context/MusicContext';
import { palette } from '../src/design/tokens';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  TouchableOpacity,
  InteractionManager,
  PermissionsAndroid,
  Dimensions,
} from 'react-native';

const SW = Dimensions.get('window').width;
import Animated, { useSharedValue, useAnimatedStyle, interpolate, Extrapolate, withSpring, withTiming, runOnJS, useFrameCallback } from 'react-native-reanimated';
import { RenderDiagnostics } from '../src/utils/render-diagnostics';

import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { Manrope_700Bold } from '@expo-google-fonts/manrope';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';


import { PlaybackService } from '../src/features/player/services/playback.service';
import { PlaybackController } from '../src/features/player/services/playback.controller';


// Prevent the splash screen from auto-hiding before asset loading is complete.
enableFreeze(true);
SplashScreen.preventAutoHideAsync().catch(() => undefined);

import PlayerOverlay from '../src/components/PlayerOverlay';
import { RestoreBanner } from '../src/components/RestoreBanner';


import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { requestIdleTask } from '../src/utils/idle-task';
import * as Haptics from 'expo-haptics';



function StartupOnboardingGate({ initialRoute, isGateReady }: { initialRoute: string; isGateReady: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (isGateReady && initialRoute === 'onboarding') {
      router.replace('/onboarding');
    }
  }, [isGateReady, initialRoute, router]);
  return null;
}

export default function RootLayout() {
  const rootRenderCount = React.useRef(0);
  rootRenderCount.current += 1;
  console.info(`[RootLayout] Rendered: count = ${rootRenderCount.current}`);

  useEffect(() => {
    // Initialize audio engine and bridge
    PlaybackService.setupPlayer();
    PlaybackController.initialize();
    
    // Run deterministic startup restore validation & reconciliation pipeline
    import('../src/services/restore-validator.service').then(({ RestoreValidatorService }) => {
      RestoreValidatorService.runStartupValidation();
    });

    // Initialize Global Network Authority
    import('../src/features/network/services/network-connectivity.service').then(({ networkConnectivityService }) => {
      networkConnectivityService.initialize();
    });

    // Initialize Device & Hardware State Authority
    import('../src/features/device/services/device-state.service').then(({ deviceStateService }) => {
      deviceStateService.initialize();
    });
    import('../src/features/device/services/audio-route-monitor.service').then(({ audioRouteMonitor }) => {
      audioRouteMonitor.startMonitoring();
    });

    // Initialize Download System
    import('../src/features/download/services/download.manager').then(({ DownloadManager }) => {
      DownloadManager.initialize();
    });

    // Initialize Settings & Audio Quality Sync Authority
    import('../src/features/settings/services/settings-sync.service').then(({ SettingsSyncService }) => {
      SettingsSyncService.initialize();
    });

    // Initialize Library Health Center (Startup Fast Scan with 8s Delay)
    import('../src/services/library-health.service').then(({ LibraryHealthService }) => {
      LibraryHealthService.scheduleStartupScan();
    });

    // Deferred heavy store hydration to preserve startup frame budget
    requestIdleTask(async () => {
      const { usePlaylistStore } = await import('../src/features/playlist/store/playlist.store');
      await usePlaylistStore.getState().initialize();
      const { useAnalyticsStore } = await import('../src/features/analytics/store/analytics.store');
      await useAnalyticsStore.getState().initialize();

      // Ensure taste profile preference priors are hydrated into recommendation engine
      try {
        const { useTasteProfileStore } = await import('../src/features/taste-profile/store/taste-profile.store');
        if (useTasteProfileStore.getState().onboardingCompleted) {
          const { syncPreferencePriorsToEngine } = await import('../src/features/taste-profile/services/preference-prior.service');
          await syncPreferencePriorsToEngine();
        }
      } catch (e) {
        console.warn('[RootLayout] Error syncing preference priors on startup:', e);
      }

      const { useRecommendationsStore } = await import('../src/features/recommendations/store/recommendations.store');
      useRecommendationsStore.getState().startPeriodicPreload();
    });

    // Start diagnostics monitoring loop
    if (__DEV__) {
      RenderDiagnostics.startMonitoring();
    }

    return () => {
      RenderDiagnostics.stopMonitoring();
    };
  }, []);

  useFrameCallback((frameInfo) => {
    'worklet';
    if (frameInfo.timeSincePreviousFrame !== null && frameInfo.timeSincePreviousFrame !== undefined) {
      RenderDiagnostics.recordUIFrame(frameInfo.timeSincePreviousFrame, frameInfo.timestamp);
    }
  });

  const [fontsLoaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Manrope_700Bold,
  });

  const [isGateReady, setIsGateReady] = React.useState(false);
  const [initialRoute, setInitialRoute] = React.useState<'onboarding' | '(tabs)'>('onboarding');

  useEffect(() => {
    let isCancelled = false;

    async function checkFirstRun() {
      try {
        const { ensureTasteProfileHydrated, useTasteProfileStore } = await import('../src/features/taste-profile/store/taste-profile.store');
        await ensureTasteProfileHydrated();

        if (isCancelled) return;

        const profile = useTasteProfileStore.getState();

        // 1. Probe Native Installation Lifecycle State
        const { AuraRestore, isNativeCoreAvailable } = await import('../src/services/native-core');
        let markerExists = false;
        let isNative = false;

        if (isNativeCoreAvailable() && AuraRestore && typeof AuraRestore.isRestoredInstall === 'function') {
          try {
            isNative = true;
            const status = await AuraRestore.isRestoredInstall();
            markerExists = !!status.markerExists;
            console.info('[StartupGate] Native installation status:', status);
          } catch (e) {
            console.warn('[StartupGate] Restore probe error:', e);
          }
        }

        if (isCancelled) return;

        // Authoritative Gate Rule:
        // Case A: Fresh installation (!markerExists on native device) -> strictly Onboarding
        if (isNative && !markerExists) {
          console.info('[StartupGate] Fresh installation detected (markerExists=false), initialRoute=onboarding');
          if (profile.onboardingCompleted) {
            useTasteProfileStore.setState({ onboardingCompleted: false });
          }
          setInitialRoute('onboarding');
          setIsGateReady(true);
          return;
        }

        // Case B: Completed install on native device
        if (isNative && markerExists && profile.onboardingCompleted) {
          console.info('[StartupGate] Verified completed installation on device, initialRoute=(tabs)');
          setInitialRoute('(tabs)');
          setIsGateReady(true);
          return;
        }

        // Case C: Non-native / fallback completed profile
        if (profile.onboardingCompleted) {
          console.info('[StartupGate] Non-native completed profile, initialRoute=(tabs)');
          setInitialRoute('(tabs)');
          setIsGateReady(true);
          return;
        }

        // Default: Onboarding
        console.info('[StartupGate] Default fresh install, initialRoute=onboarding');
        setInitialRoute('onboarding');
        setIsGateReady(true);
      } catch (err) {
        console.warn('[StartupGate] Gate error:', err);
        setInitialRoute('onboarding');
        setIsGateReady(true);
      }
    }

    checkFirstRun();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && isGateReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, isGateReady]);

  const navigationTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: palette.background,
        card: 'transparent',
        border: 'transparent',
        primary: palette.primary,
        text: palette.ink,
      },
    }),
    []
  );

  const expandProgress = useSharedValue(0);

  const stackStyle = useAnimatedStyle(() => {
    const p = expandProgress.value;
    const scale = interpolate(p, [0, 1], [1, 0.96], Extrapolate.CLAMP);
    const opacity = interpolate(p, [0, 1], [1, 0.85], Extrapolate.CLAMP);
    const borderRadius = interpolate(p, [0, 1], [0, 24], Extrapolate.CLAMP);

    return {
      transform: [{ scale }],
      opacity,
      borderRadius,
      overflow: borderRadius > 0.1 ? 'hidden' : 'visible',
      backgroundColor: palette.background,
      flex: 1,
    };
  });

  if (!fontsLoaded || !isGateReady) {
    return null;
  }

  return (
    <ThemeProvider>
      <NavigationThemeProvider value={navigationTheme}>
        <MusicProvider>
          <GestureHandlerRootView style={styles.root}>
            <BackPriorityProvider>
            <StartupOnboardingGate initialRoute={initialRoute} isGateReady={isGateReady} />
            <RootNavigationBack />
            <DynamicTrackTheme />
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <Animated.View style={stackStyle}>
              <Stack
                initialRouteName={initialRoute}
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                  animation: 'slide_from_right',
                  animationDuration: 260, // Optimized for premium ease-out decay (Apple Music style)
                  gestureEnabled: true,
                }}
              >
                <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="music_taste" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="artist/[id]" />
                <Stack.Screen name="album/[id]" />
                <Stack.Screen name="playlist/[id]" />
                <Stack.Screen 
                  name="create_playlist" 
                  options={{ 
                    animation: 'slide_from_bottom',
                    animationDuration: 280 
                  }} 
                />
                <Stack.Screen name="downloads" />
                <Stack.Screen name="download-queue" />
                <Stack.Screen name="local_library" />
                <Stack.Screen name="connected_apps" />
                <Stack.Screen 
                  name="auth/spotify" 
                  options={{ 
                    animation: 'fade',
                    headerShown: false 
                  }} 
                />
                <Stack.Screen name="library-health" />
                <Stack.Screen name="privacy_policy" />
                <Stack.Screen name="faq" />
                <Stack.Screen name="about_creator" />
                <Stack.Screen name="software_update" />
              </Stack>
            </Animated.View>
            <PlayerOverlay expandProgress={expandProgress} />
            <RestoreBanner />
            </BackPriorityProvider>
          </GestureHandlerRootView>
        </MusicProvider>
      </NavigationThemeProvider>
    </ThemeProvider>
  );
}

function RootNavigationBack() {
  useNavigationBack();
  return null;
}

function DynamicTrackTheme() {
  const track = useNowPlayingTrack();
  const { setAlbumAccent } = useTheme();

  useEffect(() => {
    if (track?.dominantColors?.length) {
      setAlbumAccent(track.dominantColors);
    }
  }, [setAlbumAccent, track?.dominantColors, track?.id]);

  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000', // Pure black backplate behind stack card layout
  }
});


