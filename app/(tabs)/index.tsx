import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, typography, styling } from '../../src/styles/theme';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Good Evening</Text>
        <Text style={styles.titleText}>Discover New Sounds</Text>
      </View>
      
      {/* Featured Card */}
      <View style={styles.featuredContainer}>
        <BlurView intensity={20} tint="dark" style={styles.featuredGlass}>
          <Text style={styles.featuredLabel}>Featured Playlist</Text>
          <Text style={styles.featuredTitle}>Neon Nights</Text>
          <TouchableOpacity style={styles.pillButton} onPress={() => router.push('/now_playing')}>
            <Text style={styles.pillText}>Play Now</Text>
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Recommended Section */}
      <Text style={styles.sectionTitle}>For You</Text>
      <View style={styles.trackList}>
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.trackItem}>
            <View style={styles.trackArtPlaceholder} />
            <View>
              <Text style={styles.trackName}>Track {item}</Text>
              <Text style={styles.artistName}>Artist {item}</Text>
            </View>
          </View>
        ))}
      </View>
      
      {/* Extra space for floating nav */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60 },
  header: { marginBottom: 32 },
  welcomeText: { ...typography.bodyMd, color: colors.on_surface_muted, marginBottom: 8 },
  titleText: { ...typography.displayLg, fontSize: 36, color: colors.on_surface },
  
  featuredContainer: {
    height: 240,
    borderRadius: styling.radiusMd * 2,
    backgroundColor: colors.primary_container,
    marginBottom: 40,
    overflow: 'hidden',
  },
  featuredGlass: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
    backgroundColor: styling.glassBg,
    borderColor: styling.glassBorder,
    borderWidth: 1,
  },
  featuredLabel: { ...typography.bodyMd, color: colors.secondary },
  featuredTitle: { ...typography.displayLg, fontSize: 24, marginBottom: 16 },
  
  pillButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: styling.radiusFull,
    alignSelf: 'flex-start',
  },
  pillText: { ...typography.titleSm, color: colors.on_primary, fontWeight: 'bold' },

  sectionTitle: { ...typography.titleSm, fontSize: 20, marginBottom: 16, color: colors.on_surface },
  trackList: { gap: 16 },
  trackItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trackArtPlaceholder: { width: 56, height: 56, borderRadius: styling.radiusMd, backgroundColor: colors.surface_variant },
  trackName: { ...typography.titleSm, fontSize: 16, marginBottom: 4 },
  artistName: { ...typography.bodyMd, fontSize: 12 },
});
