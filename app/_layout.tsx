import React, { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider as NavigationThemeProvider, DarkTheme } from '@react-navigation/native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { MusicProvider, useNowPlayingTrack } from '../src/context/MusicContext';
import { palette } from '../src/design/tokens';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { Manrope_700Bold } from '@expo-google-fonts/manrope';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';

// Prevent the splash screen from auto-hiding before asset loading is complete.
enableFreeze(true);
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
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
