import React, { useEffect, useMemo } from 'react';
import { BackPriorityProvider, useNavigationBack } from '../src/navigation/back';
import { Stack } from 'expo-router';
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

function StartupPermissionGuard({ children }: { children: React.ReactNode }) {
  const [needsPermission, setNeedsPermission] = React.useState<boolean | null>(null);

  useEffect(() => {
    async function checkFirstTime() {
      try {
        const done = await AsyncStorage.getItem('@aura_startup_permissions_done');
        if (done === 'true') {
          setNeedsPermission(false);
        } else {
          setNeedsPermission(true);
        }
      } catch {
        setNeedsPermission(false);
      }
    }
    checkFirstTime();
  }, []);

  const handleRequestAll = async () => {
    try {
      if (Platform.OS === 'android') {
        const grants: any[] = [];
        if (Platform.Version >= 33) {
          grants.push(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
            'android.permission.POST_NOTIFICATIONS' as any
          );
        } else {
          grants.push(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
          );
        }
        await PermissionsAndroid.requestMultiple(grants);
      }
    } catch (e) {
      console.warn("Permission request error:", e);
    } finally {
      await AsyncStorage.setItem('@aura_startup_permissions_done', 'true');
      setNeedsPermission(false);
    }
  };

  if (needsPermission === null) return null;

  if (needsPermission) {
    return (
      <View style={guardStyles.root}>
        <LinearGradient
          colors={['#120f26', '#090514']}
          style={StyleSheet.absoluteFill}
        />
        {/* Glow Effects */}
        <View style={guardStyles.glow} />
        
        <View style={guardStyles.content}>
          <View style={guardStyles.iconContainer}>
            <LinearGradient
              colors={['#BF5AF2', '#7B42F6']}
              style={guardStyles.iconBg}
            />
            <Ionicons name="shield-checkmark" size={54} color="#FFF" style={{ zIndex: 2 }} />
          </View>
          
          <Text style={guardStyles.title}>Aura Music</Text>
          <Text style={guardStyles.subtitle}>
            To deliver an emotional, premium, and seamless cinematic experience, Aura requires access to your device's features.
          </Text>

          <View style={guardStyles.box}>
            <View style={guardStyles.row}>
              <Ionicons name="musical-notes" size={24} color="#BF5AF2" />
              <View style={guardStyles.rowText}>
                <Text style={guardStyles.rowTitle}>Music & Audio</Text>
                <Text style={guardStyles.rowSub}>To index, scan, and play your local offline music universe.</Text>
              </View>
            </View>

            <View style={guardStyles.row}>
              <Ionicons name="notifications" size={24} color="#46f5e0" />
              <View style={guardStyles.rowText}>
                <Text style={guardStyles.rowTitle}>Notifications</Text>
                <Text style={guardStyles.rowSub}>For background playback controls, active downloads, and smart alerts.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={guardStyles.btn} onPress={handleRequestAll} activeOpacity={0.8}>
            <LinearGradient
              colors={['#BF5AF2', '#7B42F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={guardStyles.btnText}>Grant & Enter App</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

  useEffect(() => {
    console.info('[RootLayout] Dismissing native splash screen');
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

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

  return (
    <ThemeProvider>
      <NavigationThemeProvider value={navigationTheme}>
        <MusicProvider>
          <GestureHandlerRootView style={styles.root}>
            <BackPriorityProvider>
            <RootNavigationBack />
            <DynamicTrackTheme />
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <Animated.View style={stackStyle}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                  animation: 'slide_from_right',
                  animationDuration: 260, // Optimized for premium ease-out decay (Apple Music style)
                  gestureEnabled: true,
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
                <Stack.Screen name="library-health" />
                <Stack.Screen name="privacy_policy" />
                <Stack.Screen name="faq" />
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

const guardStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(191,90,242,0.12)',
    top: '20%',
  },
  content: {
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 8,
  },
  iconBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  box: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    borderWidth: 0.7,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    width: '100%',
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  rowSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 15,
  },
  btn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 20,
    elevation: 4,
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});


