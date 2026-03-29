import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, typography, styling } from '../../src/styles/theme';

export default function LibraryScreen() {
  const playlists = ['Liked Songs', 'Focus Flow', 'Late Night Drive', 'Workout Beats'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Your Library</Text>

      <View style={styles.list}>
        {playlists.map((playlist) => (
          <View key={playlist} style={styles.listItem}>
            <View style={styles.avatarShape} />
            <View>
              <Text style={styles.playlistName}>{playlist}</Text>
              <Text style={styles.playlistMeta}>Playlist</Text>
            </View>
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
  list: { gap: 24 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarShape: {
    width: 64,
    height: 64,
    borderRadius: styling.radiusMd,
    backgroundColor: colors.surface_container_high,
  },
  playlistName: { ...typography.titleSm, fontSize: 18, marginBottom: 4 },
  playlistMeta: { ...typography.bodyMd, fontSize: 14 }
});
