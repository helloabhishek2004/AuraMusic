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

function GlobalPlayer() {
  const pathname = usePathname();
  const segments = useSegments();
  
  const isNowPlaying = pathname === '/now_playing';
  const isLyrics = pathname === '/lyrics';
  
  if (isNowPlaying || isLyrics) return null;

  // If we are in a tab, we need to lift the mini player above the tab bar
  const isTab = segments[0] === '(tabs)';
  const offset = isTab ? 84 : 0; // 72 (bar) + 12 (padding)
  
  return <MiniPlayer offset={offset} />;
}


export default function RootLayout() {
  useEffect(() => {
    // Initialize audio engine and bridge
    PlaybackService.setupPlayer();
    PlaybackController.initialize();
    
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
                name="now_playing"
                options={{
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
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
              <Stack.Screen
                name="lyrics"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen name="create_playlist" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="downloads" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="local_library" options={{ animation: 'slide_from_right' }} />
            </Stack>
            <GlobalPlayer />
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
