import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { typography, styling } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: themeColors.background }]} 
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.welcomeText, { color: themeColors.on_surface_muted }]}>Good Evening</Text>
        <Text style={[styles.titleText, { color: themeColors.on_surface }]}>Discover New Sounds</Text>
      </View>
      
      {/* Featured Card */}
      <View style={[styles.featuredContainer, { backgroundColor: themeColors.primary_container }]}>
        <BlurView intensity={20} tint="dark" style={styles.featuredGlass}>
          <Text style={[styles.featuredLabel, { color: themeColors.secondary }]}>Featured Playlist</Text>
          <Text style={[styles.featuredTitle, { color: themeColors.on_surface }]}>Neon Nights</Text>
          <TouchableOpacity 
            style={[styles.pillButton, { backgroundColor: themeColors.primary }]} 
            onPress={() => router.push('/now_playing')}
          >
            <Text style={[styles.pillText, { color: themeColors.on_primary }]}>Play Now</Text>
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Recommended Section */}
      <Text style={[styles.sectionTitle, { color: themeColors.on_surface }]}>For You</Text>
      <View style={styles.trackList}>
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.trackItem}>
            <View style={styles.trackArtPlaceholder} />
            <View>
              <Text style={[styles.trackName, { color: themeColors.on_surface }]}>Track {item}</Text>
              <Text style={[styles.artistName, { color: themeColors.on_surface_muted }]}>Artist {item}</Text>
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
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60 },
  header: { marginBottom: 32 },
  welcomeText: { ...typography.bodyMd, marginBottom: 8 },
  titleText: { ...typography.displayLg, fontSize: 36 },
  
  featuredContainer: {
    height: 240,
    borderRadius: styling.radiusMd * 2,
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
  featuredLabel: { ...typography.bodyMd },
  featuredTitle: { ...typography.displayLg, fontSize: 24, marginBottom: 16 },
  
  pillButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: styling.radiusFull,
    alignSelf: 'flex-start',
  },
  pillText: { ...typography.titleSm, fontWeight: 'bold' },

  sectionTitle: { ...typography.titleSm, fontSize: 20, marginBottom: 16 },
  trackList: { gap: 16 },
  trackItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trackArtPlaceholder: { 
    width: 56, 
    height: 56, 
    borderRadius: styling.radiusMd, 
    backgroundColor: 'rgba(255,255,255,0.05)' 
  },
  trackName: { ...typography.titleSm, fontSize: 16, marginBottom: 4 },
  artistName: { ...typography.bodyMd, fontSize: 12 },
});
