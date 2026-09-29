/**
 * AuraMusic — Music Taste Profile Editor (Settings)
 *
 * Allows users to edit their name, music languages, genres, and favorite artists,
 * or safely reset their profile at any time.
 * Includes a dedicated top-anchored Search Mode that prevents keyboard flickering,
 * keeps search results unobstructed, and offers contextual artist suggestions.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
  Keyboard,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { palette } from '../src/design/tokens';
import { LiquidGlass } from '../src/components/ui/liquid-glass';
import { AuraArtwork } from '../src/components/ui/aura-artwork';
import { MUSIC_LANGUAGES, MUSIC_GENRES, CURATED_DISCOVERY_ARTISTS } from '../src/data/music-taxonomy';
import { useTasteProfileStore } from '../src/features/taste-profile/store/taste-profile.store';
import { OnboardingArtist } from '../src/features/taste-profile/types/taste-profile';
import { musicService } from '../src/services/api/music';

const { width: SW } = Dimensions.get('window');

export default function MusicTasteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useTasteProfileStore();

  const [name, setName] = useState(profile.name);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(profile.songLanguages);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(profile.genres);
  const [favoriteArtists, setFavoriteArtists] = useState<OnboardingArtist[]>(profile.favoriteArtists);

  // Dedicated Search Mode state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OnboardingArtist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const searchInputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Handle hardware back button when Search Mode is open
  useEffect(() => {
    if (!isSearchActive) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      exitSearchMode();
      return true;
    });
    return () => backHandler.remove();
  }, [isSearchActive]);

  const enterSearchMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSearchActive(true);
  };

  const exitSearchMode = () => {
    Keyboard.dismiss();
    setIsSearchActive(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Debounced online artist search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await musicService.searchArtists(text);
        if (results && results.length > 0) {
          const mapped: OnboardingArtist[] = results.map(r => ({
            id: r.id,
            name: r.title || r.artist || 'Unknown Artist',
            artworkUrl: r.art || undefined,
            source: 'search',
          }));
          setSearchResults(mapped);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.warn('[MusicTaste] Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const toggleLanguage = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLanguages(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const toggleGenre = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenres(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const removeArtist = (id: string, artistName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFavoriteArtists(prev =>
      prev.filter(a => a.id !== id && a.name.toLowerCase() !== artistName.toLowerCase())
    );
  };

  const addArtist = (artist: OnboardingArtist) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavoriteArtists(prev => {
      if (prev.some(a => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase())) {
        return prev;
      }
      return [...prev, artist];
    });
  };

  // Contextual suggested artists for empty search query
  const suggestedArtists = useMemo(() => {
    const list = CURATED_DISCOVERY_ARTISTS.filter(artist => {
      const matchLang = artist.languages.some(l => selectedLanguages.includes(l));
      const matchGenre = artist.genres.some(g => selectedGenres.includes(g));
      return matchLang || matchGenre;
    });
    return (list.length > 0 ? list : CURATED_DISCOVERY_ARTISTS).slice(0, 18);
  }, [selectedLanguages, selectedGenres]);

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    try {
      await profile.updateProfile({
        name: name.trim() || 'Music Lover',
        songLanguages: selectedLanguages.length > 0 ? selectedLanguages : ['english'],
        genres: selectedGenres,
        favoriteArtists,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Your music taste profile and home discovery mixes have been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      console.warn('[MusicTaste] Save error:', e);
      Alert.alert('Error', 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Reset Music Taste Profile',
      'This will remove your customized taste profile and return you to the onboarding flow. Your playlists, downloads, and listening history will be safely preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Profile',
          style: 'destructive',
          onPress: async () => {
            try {
              await profile.resetProfile();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/onboarding');
            } catch (err) {
              console.warn('[MusicTaste] Reset error:', err);
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SEARCH MODE (Pinned to Top of Screen, Keyboard-Stable)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isSearchActive) {
    return (
      <View style={[s.container, { paddingTop: insets.top + 8 }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* Top-Anchored Search Header */}
        <View style={s.searchModeHeader}>
          <TouchableOpacity onPress={exitSearchMode} style={s.searchModeBackBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={s.searchModeInputWrapper}>
            <Ionicons name="search" size={18} color={palette.primary} style={{ marginRight: 8 }} />
            <TextInput
              ref={searchInputRef}
              style={s.searchModeTextInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Search artists worldwide..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoFocus={true}
              returnKeyType="search"
              autoCapitalize="words"
              autoCorrect={false}
            />
            {isSearching ? (
              <ActivityIndicator size="small" color={palette.primary} style={{ marginLeft: 6 }} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                hitSlop={8}
                style={{ marginLeft: 6 }}
              >
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity onPress={exitSearchMode} style={s.searchModeDoneBtn} hitSlop={8}>
            <Text style={s.searchModeDoneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Artists Banner if any are selected */}
        {favoriteArtists.length > 0 && (
          <View style={s.selectedSummaryBar}>
            <Text style={s.selectedSummaryText}>
              Selected: <Text style={{ color: '#FFF', fontWeight: '700' }}>{favoriteArtists.length} artists</Text>
            </Text>
          </View>
        )}

        {/* Search Results / Contextual Suggestions List */}
        <ScrollView
          style={s.searchModeScroll}
          contentContainerStyle={[
            s.searchModeScrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={true}
        >
          {searchQuery.trim().length > 0 ? (
            // LIVE SEARCH RESULTS
            <>
              <View style={s.resultsHeaderRow}>
                <Text style={s.resultsHeaderTitle}>
                  {isSearching ? 'Searching...' : `Results (${searchResults.length})`}
                </Text>
              </View>

              {searchResults.length > 0 ? (
                searchResults.map(artist => {
                  const isAdded = favoriteArtists.some(
                    a => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase()
                  );
                  return (
                    <TouchableOpacity
                      key={artist.id || artist.name}
                      onPress={() => (isAdded ? removeArtist(artist.id, artist.name) : addArtist(artist))}
                      style={[s.artistResultCard, isAdded && s.artistResultCardAdded]}
                      activeOpacity={0.7}
                    >
                      <AuraArtwork
                        source={artist.artworkUrl ? { uri: artist.artworkUrl } : undefined}
                        entityName={artist.name}
                        entityType="artist"
                        borderRadius={22}
                        style={{ width: 44, height: 44 }}
                        contentFit="cover"
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.artistResultName} numberOfLines={1}>
                          {artist.name}
                        </Text>
                        <Text style={s.artistResultCategory}>Artist</Text>
                      </View>
                      <View style={[s.addToggleBtn, isAdded && s.addToggleBtnAdded]}>
                        <Ionicons
                          name={isAdded ? 'checkmark' : 'add'}
                          size={18}
                          color={isAdded ? '#FFF' : palette.primary}
                        />
                        <Text style={[s.addToggleText, isAdded && s.addToggleTextAdded]}>
                          {isAdded ? 'Added' : 'Add'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : !isSearching ? (
                <View style={s.emptySearchState}>
                  <Ionicons name="search-outline" size={36} color="rgba(255,255,255,0.3)" />
                  <Text style={s.emptySearchTitle}>No artists found</Text>
                  <Text style={s.emptySearchSubtitle}>
                    Try searching with another spelling or artist name
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            // CONTEXTUAL SUGGESTIONS (when query is empty)
            <>
              <View style={s.resultsHeaderRow}>
                <Text style={s.resultsHeaderTitle}>Suggested for Your Taste</Text>
                <Text style={s.resultsHeaderHint}>Tap to add</Text>
              </View>

              {suggestedArtists.map(artist => {
                const isAdded = favoriteArtists.some(
                  a => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase()
                );
                return (
                  <TouchableOpacity
                    key={artist.id || artist.name}
                    onPress={() => (isAdded ? removeArtist(artist.id, artist.name) : addArtist(artist))}
                    style={[s.artistResultCard, isAdded && s.artistResultCardAdded]}
                    activeOpacity={0.7}
                  >
                    <AuraArtwork
                      source={artist.artworkUrl ? { uri: artist.artworkUrl } : undefined}
                      entityName={artist.name}
                      entityType="artist"
                      borderRadius={22}
                      style={{ width: 44, height: 44 }}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.artistResultName} numberOfLines={1}>
                        {artist.name}
                      </Text>
                      <Text style={s.artistResultCategory}>Suggested Artist</Text>
                    </View>
                    <View style={[s.addToggleBtn, isAdded && s.addToggleBtnAdded]}>
                      <Ionicons
                        name={isAdded ? 'checkmark' : 'add'}
                        size={18}
                        color={isAdded ? '#FFF' : palette.primary}
                      />
                      <Text style={[s.addToggleText, isAdded && s.addToggleTextAdded]}>
                        {isAdded ? 'Added' : 'Add'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NORMAL VIEW (Music Taste Profile Settings)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Main Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Music Taste</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving} style={s.saveBtn}>
          {isSaving ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Text style={s.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Display Name Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Display Name</Text>
          <LiquidGlass borderRadius={16} intensity={30} style={s.inputBox}>
            <TextInput
              style={s.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              maxLength={30}
            />
          </LiquidGlass>
        </View>

        {/* Music Languages Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Music Languages ({selectedLanguages.length})</Text>
          <View style={s.chipsRow}>
            {MUSIC_LANGUAGES.map(lang => {
              const active = selectedLanguages.includes(lang.id);
              return (
                <TouchableOpacity
                  key={lang.id}
                  onPress={() => toggleLanguage(lang.id)}
                  activeOpacity={0.7}
                  style={[s.chip, active && s.chipActive]}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{lang.name}</Text>
                  {active && <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Favorite Genres Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Favorite Genres ({selectedGenres.length})</Text>
          <View style={s.chipsRow}>
            {MUSIC_GENRES.map(genre => {
              const active = selectedGenres.includes(genre.id);
              return (
                <TouchableOpacity
                  key={genre.id}
                  onPress={() => toggleGenre(genre.id)}
                  activeOpacity={0.7}
                  style={[s.chip, active && s.chipActive]}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{genre.name}</Text>
                  {active && <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Favorite Artists Section */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionLabel}>Favorite Artists ({favoriteArtists.length})</Text>
          </View>

          {/* Search Trigger Pill (Tapping opens dedicated top Search Mode) */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={enterSearchMode}
            style={s.searchTriggerPill}
          >
            <View style={s.searchTriggerLeft}>
              <Ionicons name="search" size={18} color={palette.primary} style={{ marginRight: 10 }} />
              <Text style={s.searchTriggerPlaceholder}>Search & add favorite artists...</Text>
            </View>
            <View style={s.searchTriggerAddBadge}>
              <Ionicons name="add" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>

          {/* Current Favorite Artists Badges Grid */}
          {favoriteArtists.length > 0 ? (
            <View style={s.artistsGrid}>
              {favoriteArtists.map(artist => (
                <View key={artist.id || artist.name} style={s.artistBadge}>
                  <AuraArtwork
                    source={artist.artworkUrl ? { uri: artist.artworkUrl } : undefined}
                    entityName={artist.name}
                    entityType="artist"
                    borderRadius={14}
                    style={{ width: 28, height: 28 }}
                    contentFit="cover"
                  />
                  <Text style={s.artistBadgeName} numberOfLines={1}>{artist.name}</Text>
                  <TouchableOpacity
                    onPress={() => removeArtist(artist.id, artist.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.noArtistsHint}>
              No favorite artists added yet. Tap search above to add your favorites.
            </Text>
          )}
        </View>

        {/* Safe Reset Section */}
        <View style={[s.section, { marginTop: 24 }]}>
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7} style={s.resetBtn}>
            <Ionicons name="refresh-circle-outline" size={20} color="#FF453A" style={{ marginRight: 8 }} />
            <Text style={s.resetBtnText}>Reset Taste Profile</Text>
          </TouchableOpacity>
          <Text style={s.resetHint}>
            Clears your profile and restarts onboarding. Your playlists, downloads, and listening history remain intact.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090514',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(191,90,242,0.2)',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputBox: {
    paddingHorizontal: 16,
    height: 50,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 15,
    color: '#FFF',
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(191,90,242,0.25)',
    borderColor: palette.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Search Trigger Pill in Normal View
  searchTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.2,
    borderColor: 'rgba(191,90,242,0.3)',
  },
  searchTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchTriggerPlaceholder: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
  searchTriggerAddBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(191,90,242,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Artists Badges Grid
  artistsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  artistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  artistBadgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    maxWidth: 120,
  },
  noArtistsHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Safe Reset Section
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,69,58,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.2)',
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF453A',
  },
  resetHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
    paddingHorizontal: 16,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SEARCH MODE STYLES
  // ─────────────────────────────────────────────────────────────────────────────
  searchModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  searchModeBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  searchModeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: palette.primary,
  },
  searchModeTextInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
    includeFontPadding: false,
  },
  searchModeDoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(191,90,242,0.25)',
  },
  searchModeDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  selectedSummaryBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(191,90,242,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(191,90,242,0.15)',
  },
  selectedSummaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  searchModeScroll: {
    flex: 1,
  },
  searchModeScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 4,
  },
  resultsHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resultsHeaderHint: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '600',
  },
  artistResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  artistResultCardAdded: {
    backgroundColor: 'rgba(191,90,242,0.12)',
    borderColor: 'rgba(191,90,242,0.3)',
  },
  artistResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  artistResultCategory: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  addToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(191,90,242,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.35)',
  },
  addToggleBtnAdded: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  addToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  addToggleTextAdded: {
    color: '#FFF',
  },
  emptySearchState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  emptySearchSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    maxWidth: 240,
  },
});
