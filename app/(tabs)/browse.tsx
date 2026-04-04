import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { typography, styling } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';

export default function BrowseScreen() {
  const genres = ['Electronic', 'Ambient', 'Synthwave', 'Classical'];
  const { themeColors } = useTheme();

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: themeColors.background }]} 
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.headerTitle, { color: themeColors.on_surface }]}>Browse</Text>
      
      <View style={styles.grid}>
        {genres.map((genre) => (
          <View key={genre} style={[styles.genreCard, { backgroundColor: themeColors.surface_container_highest }]}>
            <BlurView intensity={30} tint="dark" style={styles.glassCard}>
              <Text style={[styles.genreText, { color: themeColors.on_surface }]}>{genre}</Text>
            </BlurView>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
