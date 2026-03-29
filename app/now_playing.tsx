import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, styling } from '../src/styles/theme';
import { useRouter } from 'expo-router';

export default function NowPlayingScreen() {
  const router = useRouter();

  return (
    <LinearGradient 
      colors={['#131318', colors.primary_container]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
             <Text style={styles.backText}>&lt; Back</Text>
          </TouchableOpacity>
        </View>

        {/* Album Art Container Liquid Feel */}
        <View style={styles.albumArtContainer}>
          <View style={styles.albumArtPlaceholder} />
        </View>

        {/* Now Playing Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.trackTitle}>Neon Nights</Text>
          <Text style={styles.artistName}>Synthwave Collective</Text>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
           <View style={styles.playButton}>
             <Text style={styles.playText}>Pause</Text>
           </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, flexGrow: 1, justifyContent: 'space-between' },
  header: { marginBottom: 32 },
  backButton: { padding: 8, alignSelf: 'flex-start' },
  backText: { ...typography.titleSm, color: colors.on_surface_muted },
  
  albumArtContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  albumArtPlaceholder: {
    width: 300,
    height: 300,
    borderRadius: styling.radiusMd * 2, // 'xl' 3rem liquid feel
    backgroundColor: colors.surface_container_highest,
    ...styling.ambientShadow
  },

  infoContainer: { alignItems: 'center', marginBottom: 48 },
  trackTitle: { ...typography.displayLg, fontSize: 32, marginBottom: 8, textAlign: 'center' },
  artistName: { ...typography.bodyMd, fontSize: 18, color: colors.secondary, textAlign: 'center' },

  controlsContainer: { alignItems: 'center', paddingBottom: 48 },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: styling.radiusFull,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...styling.ambientShadow
  },
  playText: { ...typography.titleSm, color: colors.on_primary, fontWeight: 'bold' }
});
