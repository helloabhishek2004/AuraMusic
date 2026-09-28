import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SpotifyAuthService } from '@/src/features/connected-libraries/services/spotify-auth.service';
import { useConnectedLibrariesStore } from '@/src/features/connected-libraries/store/connected-libraries.store';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function SpotifyAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();

  const [statusText, setStatusText] = useState('Completing Spotify login...');
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    async function processCallback() {
      try {
        if (params.error) {
          const errorMsg =
            params.error_description || params.error === 'access_denied'
              ? 'Spotify authorization was cancelled.'
              : params.error;
          setStatusText(errorMsg);
          setTimeout(() => {
            router.replace('/connected_apps' as any);
          }, 1200);
          return;
        }

        const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
        const rawState = Array.isArray(params.state) ? params.state[0] : params.state;

        if (rawCode) {
          if (await SpotifyAuthService.isAuthenticated()) {
            setStatusText('Connecting and syncing library...');
            await useConnectedLibrariesStore.getState().syncService('spotify');
            setTimeout(() => {
              router.replace('/connected_apps' as any);
            }, 500);
            return;
          }

          setStatusText('Verifying credentials...');
          const result = await SpotifyAuthService.handleAuthRedirect(
            rawCode,
            rawState
          );

          if (result.success || (await SpotifyAuthService.isAuthenticated())) {
            setStatusText('Connecting and syncing library...');
            // Refresh service store to mark connected and start sync
            await useConnectedLibrariesStore.getState().syncService('spotify');
            setTimeout(() => {
              router.replace('/connected_apps' as any);
            }, 500);
            return;
          } else {
            setStatusText(result.error || 'Authentication failed.');
            setTimeout(() => {
              router.replace('/connected_apps' as any);
            }, 1500);
            return;
          }
        }

        // If no code or error, return cleanly to connected apps
        router.replace('/connected_apps' as any);
      } catch (err: any) {
        console.error('[SpotifyAuthCallback] Unexpected error:', err);
        router.replace('/connected_apps' as any);
      }
    }

    processCallback();
  }, [params.code, params.state, params.error, params.error_description, router]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(29, 185, 84, 0.18)', '#0a0910', '#050407']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="musical-notes" size={32} color="#1DB954" />
        </View>
        <ActivityIndicator size="large" color="#1DB954" style={styles.spinner} />
        <Text style={styles.title}>Spotify Integration</Text>
        <Text style={styles.subtitle}>{statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0910',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
