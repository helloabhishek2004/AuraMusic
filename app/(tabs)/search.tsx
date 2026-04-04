import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, styling } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';

export default function SearchScreen() {
  const { themeColors } = useTheme();

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: themeColors.background }]} 
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.headerTitle, { color: themeColors.on_surface }]}>Search</Text>

      <View style={[styles.searchBar, { backgroundColor: themeColors.surface_container_highest }]}>
        <Ionicons name="search" size={20} color={themeColors.on_surface_muted} />
        <TextInput 
          placeholder="Artists, songs, or podcasts" 
          placeholderTextColor={themeColors.on_surface_muted}
          style={[styles.searchInput, { color: themeColors.on_surface }]}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.on_surface }]}>Browse All</Text>
      <View style={styles.grid}>
        {['Podcasts', 'New Releases', 'Charts', 'Live Events'].map((cat) => (
          <View key={cat} style={[styles.categoryCard, { backgroundColor: themeColors.primary_container + '40' }]}>
            <Text style={[styles.categoryName, { color: themeColors.on_surface }]}>{cat}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 60, paddingBottom: 120 },
  headerTitle: { ...typography.displayLg, fontSize: 36, marginBottom: 24 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 32,
    gap: 12,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: typography.bodyFont },
  sectionTitle: { ...typography.titleSm, fontSize: 18, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  categoryCard: {
    width: '47%',
    height: 100,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'flex-end',
  },
  categoryName: { fontSize: 16, fontWeight: 'bold' }
});
