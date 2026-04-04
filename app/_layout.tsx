import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider as NavigationThemeProvider, DarkTheme } from '@react-navigation/native';
import { ThemeProvider } from '../src/context/ThemeContext';
import { colors } from '../src/styles/theme';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { Manrope_700Bold } from '@expo-google-fonts/manrope';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || error) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <ThemeProvider>
      <NavigationThemeProvider value={DarkTheme}>
        <View style={styles.root}>
           <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
             <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
             <Stack.Screen 
               name="lyrics" 
               options={{ 
                 presentation: 'modal',
                 animation: 'slide_from_bottom'
               }} 
             />
           </Stack>
        </View>
      </NavigationThemeProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  }
});
