import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, typography, styling } from '../../src/styles/theme';

export default function BrowseScreen() {
  const genres = ['Electronic', 'Ambient', 'Synthwave', 'Classical'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Browse</Text>
      
      <View style={styles.grid}>
        {genres.map((genre) => (
          <View key={genre} style={styles.genreCard}>
            <BlurView intensity={30} tint="dark" style={styles.glassCard}>
              <Text style={styles.genreText}>{genre}</Text>
            </BlurView>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60, paddingBottom: 120 },
  headerTitle: { ...typography.displayLg, fontSize: 36, marginBottom: 32 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  genreCard: {
    width: '47%',
    height: 120,
    borderRadius: styling.radiusMd,
    overflow: 'hidden',
    backgroundColor: colors.surface_container_highest,
  },
  glassCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: styling.glassBg,
    borderColor: styling.glassBorder,
    borderWidth: 1,
  },
  genreText: { ...typography.titleSm, fontSize: 16 }
});
