import React, { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider as NavigationThemeProvider, DarkTheme } from '@react-navigation/native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { MusicProvider, useNowPlayingTrack } from '../src/context/MusicContext';
import { palette } from '../src/design/tokens';
import { StyleSheet } from 'react-native';
import { usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { Manrope_700Bold } from '@expo-google-fonts/manrope';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';

import MiniPlayer from '../src/components/MiniPlayer';
import { PlaybackService } from '../src/features/player/services/playback.service';
import { PlaybackController } from '../src/features/player/services/playback.controller';
import { useSmartBackNavigation } from '../src/hooks/use-navigation-history';

// Prevent the splash screen from auto-hiding before asset loading is complete.
enableFreeze(true);
SplashScreen.preventAutoHideAsync().catch(() => undefined);

import PlayerOverlay from '../src/components/PlayerOverlay';


import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TouchableOpacity, PermissionsAndroid, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDownloadStore } from '../src/features/download/store/download.store';
import { DownloadManager } from '../src/features/download/services/download.manager';
import { LiquidGlass } from '../src/components/ui/liquid-glass';
import * as Haptics from 'expo-haptics';

function GlobalDownloadNotification() {
  const notification = useDownloadStore(s => s.notification);
  const activeTasks = useDownloadStore(s => s.activeTasks);
  const insets = useSafeAreaInsets();

  const downloadingTrackId = React.useMemo(() => {
    return Object.keys(activeTasks).find(
      id => activeTasks[id]?.status === 'downloading'
    );
  }, [activeTasks]);

  const handleCancel = () => {
    if (downloadingTrackId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      DownloadManager.cancelDownload(downloadingTrackId);
    }
  };

  if (!notification || !notification.isVisible) return null;

  return (
    <View style={[notiStyles.container, { top: insets.top + 10 }]}>
      <LiquidGlass borderRadius={20} intensity={30} style={notiStyles.glass}>
        <LinearGradient
          colors={['rgba(26, 20, 38, 0.95)', 'rgba(12, 8, 20, 0.98)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={notiStyles.specular} pointerEvents="none" />

        <View style={notiStyles.content}>
          <Ionicons 
            name={notification.isComplete ? "checkmark-circle" : "cloud-download"} 
            size={22} 
            color={notification.isComplete ? "#30D158" : "#BF5AF2"} 
          />
          <View style={notiStyles.textWrap}>
            <Text style={notiStyles.title} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={notiStyles.subtitle}>
              {notification.isComplete 
                ? "Aura Music · Finished" 
                : `Aura Music · ${notification.progress}% · ${notification.remaining} remaining`}
            </Text>
          </View>
          
          {!notification.isComplete && (
            <TouchableOpacity style={notiStyles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
              <Text style={notiStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Bar Line */}
        {!notification.isComplete && (
          <View style={notiStyles.progressTrack}>
            <View style={[notiStyles.progressBar, { width: `${notification.progress}%` }]} />
          </View>
        )}
      </LiquidGlass>
    </View>
  );
}

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

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize audio engine and bridge
    PlaybackService.setupPlayer();
    PlaybackController.initialize();
    
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
  }, []);

  const [fontsLoaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || error) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, error]);

  useSmartBackNavigation();

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

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <ThemeProvider>
      <NavigationThemeProvider value={navigationTheme}>
        <MusicProvider>
          <GestureHandlerRootView style={styles.root}>
            <DynamicTrackTheme />
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'slide_from_right',
                animationDuration: 220,
                gestureEnabled: true,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="artist/[id]"
                options={{
                  animation: 'slide_from_right',
                  animationDuration: 200,
                }}
              />
              <Stack.Screen
                name="album/[id]"
                options={{
                  animation: 'slide_from_right',
                  animationDuration: 200,
                }}
              />
              <Stack.Screen
                name="playlist/[id]"
                options={{
                  animation: 'slide_from_right',
                  animationDuration: 200,
                }}
              />
              <Stack.Screen name="create_playlist" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="downloads" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="local_library" options={{ animation: 'slide_from_right' }} />
            </Stack>
            <PlayerOverlay />
          </GestureHandlerRootView>
        </MusicProvider>
      </NavigationThemeProvider>
    </ThemeProvider>
  );
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
    backgroundColor: palette.background,
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

const notiStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 999999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  glass: {
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cancelText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#BF5AF2',
  },
});
