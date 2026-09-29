/**
 * AuraMusic — First-Run Onboarding Experience
 *
 * Implements "The Sonic Nebula" Liquid Glass design language.
 * 9-Screen Apple Music-grade flow:
 * SCREEN 01: AuraMusic Entry (Minimalist Reveal)
 * SCREEN 02: What AuraMusic Is
 * SCREEN 03: Welcome / Wish (Constellation Particles + Website Link)
 * SCREEN 04: Get Started / Look for Backups
 * SCREEN 05: Name (Curved Input Adaptation)
 * SCREEN 06: Song Languages
 * SCREEN 07: Genres
 * SCREEN 08: Artists (Curated + Search with Artwork Fallbacks)
 * SCREEN 09: Creating Your Space (Atmospheric Transition to Home)
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  BackHandler,
  KeyboardAvoidingView,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import { palette } from '@/src/design/tokens';
import { PressScale } from '@/src/components/ui/press-scale';
import { LiquidGlass } from '@/src/components/ui/liquid-glass';
import { AuraBlendAtmosphere } from '@/src/components/ui/AuraBlendAtmosphere';
import { AuraLogoSvg } from '@/src/components/ui/AuraLogoSvg';
import { ConstellationParticles } from '@/src/components/ui/ConstellationParticles';
import { CurvedNameInput } from '@/src/components/ui/CurvedNameInput';
import { OnboardingGlassButton } from '@/src/components/ui/OnboardingGlassButton';
import { ArtistAvatarCard } from '@/src/components/ui/ArtistAvatarCard';
import { getDeterministicGradient, getInitials } from '@/src/features/player/utils/artwork-resolver';
import { Image } from 'expo-image';

import {
  MUSIC_LANGUAGES,
  MUSIC_GENRES,
  getCuratedArtistSuggestions,
} from '@/src/data/music-taxonomy';
import { useTasteProfileStore } from '@/src/features/taste-profile/store/taste-profile.store';
import { OnboardingArtist } from '@/src/features/taste-profile/types/taste-profile';
import { musicService } from '@/src/services/api/music';
import { RestoreValidatorService } from '@/src/services/restore-validator.service';
import { ArtistDiscoveryLoader } from '@/src/components/ui/ArtistDiscoveryLoader';
import { WelcomeStrokeSvg } from '@/src/components/ui/WelcomeStrokeSvg';
import { DynamicArtistDiscoveryService } from '@/src/features/taste-profile/services/dynamic-artist-discovery.service';

const { width: SW, height: SH } = Dimensions.get('window');
const CANONICAL_WEBSITE_URL = 'https://listenwith-auramusic.vercel.app/';

type OnboardingStep =
  | 'ENTRY'       // SCREEN 01
  | 'ABOUT'       // SCREEN 02
  | 'WISH'        // SCREEN 03
  | 'CHOICE'      // SCREEN 04 (Get Started / Backups)
  | 'NAME'        // SCREEN 05
  | 'LANGUAGES'   // SCREEN 06
  | 'GENRES'      // SCREEN 07
  | 'ARTISTS'     // SCREEN 08
  | 'WELCOME'     // SCREEN 09 (Welcome Cursive SVG Stroke Animation)
  | 'CREATING';   // SCREEN 10 (Final Transition to Home)

const SPLIT_CHARS = 'AuraMusic'.split('');

const SplitTextLogo = React.memo(() => {
  return (
    <View style={styles.splitTextRow}>
      {SPLIT_CHARS.map((char, index) => (
        <Animated.Text
          key={index}
          entering={FadeInDown.delay(280 + index * 45).duration(500).easing(Easing.out(Easing.cubic))}
          style={styles.entryTitleChar}
        >
          {char}
        </Animated.Text>
      ))}
    </View>
  );
});

SplitTextLogo.displayName = 'SplitTextLogo';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Current onboarding step
  const [step, setStep] = useState<OnboardingStep>('ENTRY');

  // Form State
  const [draftName, setDraftName] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['english']);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['pop']);
  const [selectedArtists, setSelectedArtists] = useState<OnboardingArtist[]>([]);

  // Artist Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OnboardingArtist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchingOffline, setIsSearchingOffline] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Dynamic Artist Discovery State
  const [dynamicArtists, setDynamicArtists] = useState<OnboardingArtist[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState(false);
  const lastDiscoveryKeyRef = useRef<string>('');

  // Restore State
  const [isRestoring, setIsRestoring] = useState(false);

  // Hide native splash screen once onboarding has mounted
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // Hardware Back Button Handling
  useEffect(() => {
    const onBackPress = () => {
      if (step === 'ABOUT') {
        setStep('ENTRY');
        return true;
      }
      if (step === 'WISH') {
        setStep('ABOUT');
        return true;
      }
      if (step === 'CHOICE') {
        setStep('WISH');
        return true;
      }
      if (step === 'NAME') {
        setStep('CHOICE');
        return true;
      }
      if (step === 'LANGUAGES') {
        setStep('NAME');
        return true;
      }
      if (step === 'GENRES') {
        setStep('LANGUAGES');
        return true;
      }
      if (step === 'ARTISTS') {
        setStep('GENRES');
        return true;
      }
      if (step === 'WELCOME') {
        setStep('ARTISTS');
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [step]);

  // Debounced Artist Search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setIsSearchingOffline(false);
      return;
    }

    setIsSearching(true);
    setIsSearchingOffline(false);

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
          setIsSearchingOffline(false);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.warn('[Onboarding] Artist search error:', err);
        setIsSearchingOffline(true);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 320);
  };

  // Curated artist suggestions based on active language/genre choices
  const curatedSuggestions = useMemo(() => {
    return getCuratedArtistSuggestions(selectedLanguages, selectedGenres);
  }, [selectedLanguages, selectedGenres]);

  // Dynamic artist discovery effect when reaching the ARTISTS step
  useEffect(() => {
    if (step !== 'ARTISTS') return;

    const key = `${[...selectedLanguages].sort().join(',')}_${[...selectedGenres].sort().join(',')}`;
    if (lastDiscoveryKeyRef.current === key && dynamicArtists.length > 0) {
      return;
    }

    let isMounted = true;
    setIsDiscovering(true);
    setDiscoveryError(false);
    const startTime = Date.now();

    (async () => {
      try {
        const results = await DynamicArtistDiscoveryService.discoverArtists(
          selectedLanguages,
          selectedGenres
        );

        // Keep the loading animation visible for at least 1600ms so the user sees the rotating personalized sentences
        const elapsed = Date.now() - startTime;
        const minWait = 1600;
        if (elapsed < minWait) {
          await new Promise(r => setTimeout(r, minWait - elapsed));
        }

        if (isMounted) {
          lastDiscoveryKeyRef.current = key;
          setDynamicArtists(results && results.length > 0 ? results : curatedSuggestions);
          setIsDiscovering(false);
        }
      } catch (err) {
        console.warn('[Onboarding] Dynamic artist discovery failed, falling back to curated:', err);
        const elapsed = Date.now() - startTime;
        if (elapsed < 1200) {
          await new Promise(r => setTimeout(r, 1200 - elapsed));
        }
        if (isMounted) {
          lastDiscoveryKeyRef.current = key;
          setDynamicArtists(curatedSuggestions);
          setDiscoveryError(true);
          setIsDiscovering(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [step, selectedLanguages, selectedGenres, curatedSuggestions, dynamicArtists.length]);

  // Toggle Language
  const toggleLanguage = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLanguages(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  // Toggle Genre
  const toggleGenre = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenres(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  // Toggle Artist
  const toggleArtist = (artist: OnboardingArtist) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedArtists(prev => {
      const exists = prev.some(
        a => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase()
      );
      if (exists) {
        return prev.filter(
          a => a.id !== artist.id && a.name.toLowerCase() !== artist.name.toLowerCase()
        );
      }
      if (prev.length >= 15) {
        Alert.alert(
          'Selection Limit',
          'You have selected 15 artists! That is plenty for tuning your initial taste.'
        );
        return prev;
      }
      return [...prev, artist];
    });
  };

  // Handle "Look for Backups"
  const handleLookForBackups = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRestoring(true);

    try {
      const result = await RestoreValidatorService.triggerManualRestore();
      console.info('[Onboarding] Manual restore probe result:', result);

      const tasteStore = useTasteProfileStore.getState();
      const hasRestoredProfile =
        tasteStore.favoriteArtists.length > 0 || tasteStore.songLanguages.length > 0;
      const hasLibraryData =
        (result.dbBytes && result.dbBytes > 0) || (result.repairedCount && result.repairedCount > 0);

      if (hasRestoredProfile || hasLibraryData) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await tasteStore.markCompletedFromRestore();
        setStep('CREATING');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1200);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'No Backup Found',
          'No previous cloud or local backup was found for AuraMusic on this device. Would you like to get started fresh?',
          [
            { text: 'Start Fresh', onPress: () => setStep('NAME') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } catch (e: any) {
      console.warn('[Onboarding] Restore error:', e);
      Alert.alert(
        'Restore Notice',
        'Unable to check for backups. Please check your network connection or start fresh.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  // Final Commit & Transition to Home
  const handleFinalCommit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStep('CREATING');

    try {
      await useTasteProfileStore.getState().commitProfile({
        name: draftName.trim() || 'Music Lover',
        songLanguages: selectedLanguages.length > 0 ? selectedLanguages : ['english'],
        genres: selectedGenres.length > 0 ? selectedGenres : ['pop'],
        favoriteArtists: selectedArtists,
      });

      // Atmospheric transition pause (800-1200ms)
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1100);
    } catch (e) {
      console.error('[Onboarding] Commit error:', e);
      router.replace('/(tabs)');
    }
  };

  // Safe Website Opener
  const handleOpenWebsite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(CANONICAL_WEBSITE_URL).catch(() => {
      Alert.alert('Notice', `Visit our website at: ${CANONICAL_WEBSITE_URL}`);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 01 — AURAMUSIC ENTRY (SplitText Reveal)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'ENTRY') {
    return (
      <AuraBlendAtmosphere blurLevel="none" dimLevel={0}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Animated.View
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(200)}
          style={[styles.screenContainer, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
        >
          {/* Center Logo & Title Reveal */}
          <View style={styles.centerRevealBox}>
            <Animated.View
              entering={FadeIn.duration(800).easing(Easing.out(Easing.quad))}
              exiting={FadeOut.duration(200)}
              style={styles.logoBox}
            >
              <AuraLogoSvg size={92} color="#FFFFFF" />
            </Animated.View>

            <View style={{ alignItems: 'center' }}>
              <SplitTextLogo />
              <Animated.Text
                entering={FadeInDown.delay(720).duration(550).easing(Easing.out(Easing.quad))}
                style={styles.entryTagline}
              >
                Cinematic listening space
              </Animated.Text>
            </View>
          </View>

          {/* Bottom Floating Glass Action */}
          <Animated.View
            entering={FadeInUp.delay(650).duration(500)}
            exiting={FadeOut.duration(200)}
            style={styles.bottomActionBox}
          >
            <OnboardingGlassButton
              variant="circleArrow"
              onPress={() => setStep('ABOUT')}
              accessibilityLabel="Continue to about AuraMusic"
            />
          </Animated.View>
        </Animated.View>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 02 — WHAT IS AURAMUSIC?
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'ABOUT') {
    const features = [
      { icon: 'musical-notes', text: 'Free & completely ad-free' },
      { icon: 'download-outline', text: 'Offline background downloads' },
      { icon: 'folder-open-outline', text: 'Local audio library playback' },
      { icon: 'sparkles-outline', text: 'Personalized recommendation engine' },
      { icon: 'shield-checkmark-outline', text: 'Privacy-first, local-first design' },
    ];

    return (
      <AuraBlendAtmosphere blurLevel="subtle" dimLevel={0.08}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Animated.View
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(200)}
          style={[styles.screenContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrowText}>YOUR MUSIC. YOUR WAY.</Text>
            <Text style={styles.headingTitle}>Music without the noise.</Text>
            <Text style={styles.headingSub}>
              AuraMusic is a modern, serverless music player built around your music, your library, and your listening habits.
            </Text>
          </View>

          {/* Progressive Staggered Asymmetric Feature List with 50% More Opaque Frosted Glass */}
          <View style={styles.featuresList}>
            {features.map((item, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <Animated.View
                  key={item.text}
                  entering={FadeInDown.delay(180 + idx * 80).duration(420)}
                  exiting={FadeOut.duration(180)}
                  style={[
                    styles.featureItemRow,
                    isEven ? styles.featureRowLeft : styles.featureRowRight,
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(34, 25, 52, 0.82)', 'rgba(18, 14, 30, 0.92)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.featureItemBorder} />
                  <View style={styles.featureIconBadge}>
                    <Ionicons name={item.icon as any} size={18} color="#DAB9FF" />
                  </View>
                  <Text style={styles.featureText}>{item.text}</Text>
                </Animated.View>
              );
            })}
          </View>

          {/* Bottom Floating Continue Control */}
          <View style={styles.bottomActionBox}>
            <OnboardingGlassButton
              variant="circleArrow"
              onPress={() => setStep('WISH')}
              accessibilityLabel="Continue to welcome message"
            />
          </View>
        </Animated.View>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 03 — WISH / WELCOME (Constellation + Website Link)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'WISH') {
    return (
      <AuraBlendAtmosphere blurLevel="medium" dimLevel={0.16}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Animated.View
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(200)}
          style={[styles.screenContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrowText}>THE SONIC NEBULA</Text>
            <Text style={styles.headingTitle}>Here's to better listening.</Text>
            <Text style={styles.headingSub}>
              Tell us a little about what you love, and we'll shape AuraMusic around your personal taste.
            </Text>
          </View>

          {/* Constellation Particle Visual */}
          <View style={styles.constellationCenterBox}>
            <ConstellationParticles />
            <Text style={styles.constellationCaption}>
              Explore the app, discover something new, and make it yours.
            </Text>
          </View>

          {/* Subtle Secondary Website Link */}
          <TouchableOpacity
            onPress={handleOpenWebsite}
            activeOpacity={0.7}
            style={styles.websiteActionRow}
          >
            <Ionicons name="globe-outline" size={15} color="rgba(255, 255, 255, 0.45)" style={{ marginRight: 6 }} />
            <Text style={styles.websiteActionText}>Visit the website to explore releases & news</Text>
            <Ionicons name="open-outline" size={13} color="rgba(255, 255, 255, 0.35)" style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          {/* Bottom Floating Continue Control */}
          <View style={styles.bottomActionBox}>
            <OnboardingGlassButton
              variant="circleArrow"
              onPress={() => setStep('CHOICE')}
              accessibilityLabel="Continue to options"
            />
          </View>
        </Animated.View>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 04 — GET STARTED / LOOK FOR BACKUPS
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'CHOICE') {
    return (
      <AuraBlendAtmosphere blurLevel="strong" dimLevel={0.35}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Animated.View
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(200)}
          style={[styles.screenContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrowText}>YOUR JOURNEY</Text>
            <Text style={styles.headingTitle}>Begin your experience.</Text>
            <Text style={styles.headingSub}>
              Start with a clean slate or restore your previous library and preferences from Google Cloud.
            </Text>
          </View>

          {/* Dual Action Banners with iOS Hierarchy */}
          <View style={styles.choiceCardsContainer}>
            {/* Primary Hero Banner: Get Started */}
            <Animated.View entering={FadeInDown.delay(120).duration(450)}>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep('NAME');
                }}
                style={styles.heroCardWrapper}
              >
                <LinearGradient
                  colors={['rgba(191, 90, 242, 0.35)', 'rgba(123, 66, 246, 0.18)', 'rgba(26, 18, 42, 0.90)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCardGradient}
                >
                  {/* Top Specular Edge Highlight */}
                  <View style={styles.heroCardTopHighlight} />

                  {/* Left Vivid Squircle Icon */}
                  <View style={styles.heroIconSquircle}>
                    <LinearGradient
                      colors={['#BF5AF2', '#7B42F6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                  </View>

                  {/* Center Text Block */}
                  <View style={styles.heroTextCol}>
                    <Text style={styles.heroTitle}>Get Started</Text>
                    <Text style={styles.heroSubtitle}>
                      Start fresh and build your personal taste profile
                    </Text>
                  </View>

                  {/* Right Action Button */}
                  <View style={styles.heroArrowBtn}>
                    <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Subtle Divider */}
            <View style={styles.choiceDividerBox}>
              <View style={styles.choiceDividerLine} />
              <Text style={styles.choiceDividerText}>OR</Text>
              <View style={styles.choiceDividerLine} />
            </View>

            {/* Secondary Low-Importance Banner: Restore Backup */}
            <Animated.View entering={FadeInDown.delay(220).duration(450)}>
              <TouchableOpacity
                activeOpacity={0.72}
                disabled={isRestoring}
                onPress={handleLookForBackups}
                style={styles.secondaryBackupCard}
              >
                <View style={styles.secondaryBackupContent}>
                  <View style={styles.secondaryBackupIconBox}>
                    <Ionicons
                      name="cloud-download-outline"
                      size={16}
                      color="rgba(255, 255, 255, 0.65)"
                    />
                  </View>
                  <View style={styles.secondaryBackupTextCol}>
                    <Text style={styles.secondaryBackupTitle}>
                      {isRestoring ? 'Inspecting Google Cloud backup...' : 'Restore from Cloud Backup'}
                    </Text>
                    <Text style={styles.secondaryBackupSubtitle}>
                      {isRestoring ? 'Please wait a moment' : 'Have a previous library? Bring back playlists & history'}
                    </Text>
                  </View>
                  {isRestoring ? (
                    <ActivityIndicator size="small" color="#BF5AF2" />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="rgba(255, 255, 255, 0.35)"
                    />
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Subtle back navigation */}
          <TouchableOpacity
            onPress={() => setStep('WISH')}
            activeOpacity={0.7}
            style={styles.quietBackLink}
          >
            <Ionicons name="arrow-back" size={15} color="rgba(255,255,255,0.4)" style={{ marginRight: 6 }} />
            <Text style={styles.quietBackText}>Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 05 — NAME (Curved Input Adaptation)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'NAME') {
    return (
      <AuraBlendAtmosphere blurLevel="strong" dimLevel={0.42}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Animated.View
            entering={FadeIn.duration(350)}
            exiting={FadeOut.duration(200)}
            style={[styles.screenContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          >
            {/* Header with Back Chevron */}
            <View style={styles.headerBlock}>
              <TouchableOpacity
                onPress={() => setStep('CHOICE')}
                style={styles.topBackChevron}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.eyebrowText}>WELCOME TO AURA</Text>
              <Text style={styles.headingTitle}>What should we call you?</Text>
              <Text style={styles.headingSub}>
                We'll use this for your personalized greetings and home listening space.
              </Text>
            </View>

            {/* Curved Name Input */}
            <View style={styles.curvedInputWrapper}>
              <CurvedNameInput
                value={draftName}
                onChangeText={setDraftName}
                onSubmit={() => setStep('LANGUAGES')}
              />
            </View>

            {/* Optional Skip Note */}
            <TouchableOpacity
              onPress={() => setStep('LANGUAGES')}
              activeOpacity={0.7}
              style={styles.quietBackLink}
            >
              <Text style={styles.quietBackText}>You can skip this and continue as Music Lover</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 06 — SONG LANGUAGES
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'LANGUAGES') {
    return (
      <AuraBlendAtmosphere blurLevel="strong" dimLevel={0.48}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Animated.View
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(200)}
          style={[styles.screenContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <TouchableOpacity
              onPress={() => setStep('NAME')}
              style={styles.topBackChevron}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.eyebrowText}>MUSIC PREFERENCES</Text>
            <Text style={styles.headingTitle}>What languages do you listen to?</Text>
            <Text style={styles.headingSub}>
              Select the languages you love songs in. We'll tune your discovery mixes.
            </Text>
          </View>

          {/* Languages Chips Grid */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.chipsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.chipsWrap}>
              {MUSIC_LANGUAGES.map(lang => {
                const isSelected = selectedLanguages.includes(lang.id);
                return (
                  <TouchableOpacity
                    key={lang.id}
                    onPress={() => toggleLanguage(lang.id)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    style={[
                      styles.langChip,
                      isSelected && styles.langChipSelected,
                    ]}
                  >
                    <View style={styles.langTextCol}>
                      <Text style={[styles.langNative, isSelected && styles.langTextSelected]}>
                        {lang.nativeName}
                      </Text>
                      <Text style={[styles.langName, isSelected && styles.langSubSelected]}>
                        {lang.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={17} color="#BF5AF2" style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Bottom Floating Continue */}
          <View style={styles.bottomPillContainer}>
            <OnboardingGlassButton
              variant="pill"
              title="Continue"
              onPress={() => setStep('GENRES')}
            />
          </View>
        </Animated.View>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 07 — GENRES
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'GENRES') {
    return (
      <AuraBlendAtmosphere blurLevel="strong" dimLevel={0.50}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Animated.View
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(200)}
          style={[styles.screenContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <TouchableOpacity
              onPress={() => setStep('LANGUAGES')}
              style={styles.topBackChevron}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.eyebrowText}>GENRES & VIBES</Text>
            <Text style={styles.headingTitle}>What genres move you?</Text>
            <Text style={styles.headingSub}>
              Select a few styles you enjoy (2+ recommended).
            </Text>
          </View>

          {/* Genres Grid */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.genresScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.genresGrid}>
              {MUSIC_GENRES.map(genre => {
                const isSelected = selectedGenres.includes(genre.id);
                return (
                  <TouchableOpacity
                    key={genre.id}
                    onPress={() => toggleGenre(genre.id)}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    style={[
                      styles.genreCard,
                      isSelected && styles.genreCardSelected,
                    ]}
                  >
                    {/* Ambient Gradient Rim when Selected */}
                    {isSelected && (
                      <LinearGradient
                        colors={[genre.gradient[0], genre.gradient[1]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <View style={[styles.genreCardInner, isSelected && styles.genreCardInnerSelected]}>
                      <Ionicons
                        name={genre.icon as any}
                        size={22}
                        color={isSelected ? '#FFFFFF' : '#DAB9FF'}
                        style={{ marginBottom: 6 }}
                      />
                      <Text style={[styles.genreName, isSelected && styles.genreNameSelected]}>
                        {genre.name}
                      </Text>
                      {isSelected && (
                        <View style={styles.genreCheckBadge}>
                          <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Bottom Floating Continue */}
          <View style={styles.bottomPillContainer}>
            <OnboardingGlassButton
              variant="pill"
              title="Continue"
              onPress={() => {
                DynamicArtistDiscoveryService.discoverArtists(selectedLanguages, selectedGenres).catch(() => {});
                setStep('ARTISTS');
              }}
            />
          </View>
        </Animated.View>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 08 — ARTISTS (Dynamic Discovery + Curated + Live Search)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'ARTISTS') {
    const isSearchActive = searchQuery.trim().length > 0;
    const baseArtists = dynamicArtists.length > 0 ? dynamicArtists : curatedSuggestions;
    const displayedArtists = isSearchActive ? searchResults : baseArtists;

    return (
      <AuraBlendAtmosphere blurLevel="strong" dimLevel={0.54}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Animated.View
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(200)}
          style={[styles.screenContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <TouchableOpacity
              onPress={() => setStep('GENRES')}
              style={styles.topBackChevron}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.eyebrowText}>FAVORITE ARTISTS</Text>
            <Text style={styles.headingTitle}>Pick your favorite artists</Text>
            <Text style={styles.headingSub}>
              Browse suggestions or search worldwide (3+ recommended).
            </Text>
          </View>

          {/* Glass Search Bar */}
          <View style={styles.searchBarGlass}>
            <Ionicons name="search" size={17} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search artists..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
            />
            {isSearching && (
              <ActivityIndicator size="small" color="#BF5AF2" style={{ marginRight: 6 }} />
            )}
            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          {isSearchingOffline && (
            <Text style={styles.offlineNotice}>
              You're offline. Browse suggestions below or continue.
            </Text>
          )}

          {/* Main Content: Dynamic Discovery Loader Pill + Artist Grid */}
          {isDiscovering && !isSearchActive && (
            <ArtistDiscoveryLoader
              selectedLanguages={selectedLanguages}
              selectedGenres={selectedGenres}
            />
          )}

          <ScrollView
            style={{ flex: 1, marginVertical: 6 }}
            contentContainerStyle={styles.artistsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionHeading}>
              {isSearchActive
                ? `Search Results (${displayedArtists.length})`
                : discoveryError
                ? 'Suggested for You'
                : 'Curated for Your Taste'}
            </Text>

            <View style={styles.artistsGrid}>
              {displayedArtists.map(artist => {
                const isSelected = selectedArtists.some(
                  a => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase()
                );
                return (
                  <ArtistAvatarCard
                    key={artist.id || artist.name}
                    artist={artist}
                    isSelected={isSelected}
                    onToggle={toggleArtist}
                  />
                );
              })}
            </View>

            {isSearchActive && displayedArtists.length === 0 && !isSearching && (
              <View style={styles.emptySearchBox}>
                <Ionicons name="musical-notes-outline" size={28} color="rgba(255,255,255,0.25)" />
                <Text style={styles.emptySearchText}>No artists found for "{searchQuery}"</Text>
              </View>
            )}
          </ScrollView>

          {/* Floating Selected Tray (if any selected) */}
          {selectedArtists.length > 0 && (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.selectedTray}>
              <View style={styles.selectedTrayInner}>
                <View style={styles.trayHeaderRow}>
                  <Text style={styles.trayCount}>
                    {selectedArtists.length} {selectedArtists.length === 1 ? 'artist' : 'artists'} selected
                  </Text>
                  <Text style={styles.trayHint}>Tap an artist to remove</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayScroll}>
                  {selectedArtists.map(artist => (
                    <TouchableOpacity
                      key={artist.id || artist.name}
                      onPress={() => toggleArtist(artist)}
                      activeOpacity={0.7}
                      style={styles.trayItem}
                    >
                      {artist.artworkUrl ? (
                        <Image
                          source={{ uri: artist.artworkUrl }}
                          style={styles.trayAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <LinearGradient
                          colors={getDeterministicGradient(artist.name)}
                          style={[styles.trayAvatar, styles.trayFallback]}
                        >
                          <Text style={styles.trayInitials}>{getInitials(artist.name)}</Text>
                        </LinearGradient>
                      )}
                      <View style={styles.trayRemoveBadge}>
                        <Ionicons name="close" size={10} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </Animated.View>
          )}

          {/* Bottom Floating Commit Button */}
          {(!isDiscovering || isSearchActive || selectedArtists.length > 0) && (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.bottomPillContainer}>
              <OnboardingGlassButton
                variant="pill"
                title={selectedArtists.length > 0 ? 'Create Your Space' : 'Continue'}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep('WELCOME');
                }}
              />
            </Animated.View>
          )}
        </Animated.View>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 09 — WELCOME (Handwriting Cursive Stroke Animation)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'WELCOME') {
    return (
      <AuraBlendAtmosphere blurLevel="medium" dimLevel={0.22}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Animated.View
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(200)}
          style={[styles.screenContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrowText}>THE SONIC NEBULA</Text>
            <Text style={styles.headingTitle}>Your universe is ready.</Text>
            <Text style={styles.headingSub}>
              Curated for {draftName.trim() || 'you'}, tuned to your frequency.
            </Text>
          </View>

          {/* Central Handwriting "Welcome" SVG Stroke Animation */}
          <View style={styles.welcomeSvgWrapper}>
            <WelcomeStrokeSvg duration={3200} />
            <Animated.Text
              entering={FadeInDown.delay(1000).duration(600)}
              style={styles.welcomeSubtitle}
            >
              Step into cinematic sound
            </Animated.Text>
          </View>

          {/* Bottom Floating Commit Button */}
          <Animated.View
            entering={FadeInUp.delay(1200).duration(500)}
            style={styles.bottomPillContainer}
          >
            <OnboardingGlassButton
              variant="pill"
              title="Enter AuraMusic"
              onPress={handleFinalCommit}
            />
          </Animated.View>
        </Animated.View>
      </AuraBlendAtmosphere>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SCREEN 10 — CREATING YOUR SPACE (Atmospheric Transition to Home)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <AuraBlendAtmosphere blurLevel="medium" dimmed={true} dimLevel={0.65}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Animated.View
        entering={FadeIn.duration(600)}
        style={[styles.screenContainer, styles.creatingContainer]}
      >
        <View style={styles.creatingContent}>
          {/* Animated Logo Breathing */}
          <View style={styles.creatingLogoBox}>
            <AuraLogoSvg size={84} color="#FFFFFF" />
          </View>

          <Text style={styles.creatingHeading}>Your taste</Text>
          <Text style={styles.creatingSub}>is becoming your Aura...</Text>

          {/* Dynamic Ambient Ring */}
          <ActivityIndicator size="small" color="#BF5AF2" style={{ marginTop: 24 }} />
        </View>
      </Animated.View>
    </AuraBlendAtmosphere>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  // ── Screen 01: Entry ──
  centerRevealBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBox: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  splitTextRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryTitleChar: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  entryTagline: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginTop: 6,
  },
  bottomActionBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
  },

  // ── Screen 02 & 03: Common Headers ──
  headerBlock: {
    marginTop: 8,
    marginBottom: 16,
  },
  topBackChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DAB9FF',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headingTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  headingSub: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: -0.2,
    lineHeight: 20,
    marginTop: 8,
  },

  // ── Screen 02: Features List ──
  featuresList: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  featureRowLeft: {
    marginRight: 16,
    alignSelf: 'flex-start',
    width: '94%',
  },
  featureRowRight: {
    marginLeft: 16,
    alignSelf: 'flex-end',
    width: '94%',
  },
  featureItemBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(191, 90, 242, 0.28)',
    pointerEvents: 'none',
  },
  featureIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(191, 90, 242, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(191, 90, 242, 0.35)',
  },
  featureText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  // ── Screen 03: Constellation ──
  constellationCenterBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  constellationCaption: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  websiteActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  websiteActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.55)',
    textDecorationLine: 'underline',
  },

  // ── Screen 04: Polished iOS Action Banners ──
  choiceCardsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  heroCardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(191, 90, 242, 0.42)',
    backgroundColor: 'rgba(26, 18, 42, 0.65)',
  },
  heroCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  heroCardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  heroIconSquircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.68)',
    marginTop: 3,
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  heroArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Divider
  choiceDividerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 12,
  },
  choiceDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  choiceDividerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255, 255, 255, 0.32)',
    marginHorizontal: 14,
  },

  // Secondary Backup Card (Subtle & Lower Importance)
  secondaryBackupCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  secondaryBackupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryBackupIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  secondaryBackupTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  secondaryBackupTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.78)',
    letterSpacing: -0.1,
  },
  secondaryBackupSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.40)',
    marginTop: 2,
    lineHeight: 15,
  },
  restoringIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 8,
  },
  restoringText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  quietBackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  quietBackText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.45)',
  },

  // ── Screen 05: Name ──
  curvedInputWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Screen 06: Languages Chips ──
  chipsScrollContent: {
    paddingVertical: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: (SW - 48 - 10) / 2,
  },
  langChipSelected: {
    backgroundColor: 'rgba(191, 90, 242, 0.18)',
    borderColor: 'rgba(191, 90, 242, 0.55)',
  },
  langTextCol: {
    flex: 1,
  },
  langNative: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  langName: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },
  langTextSelected: {
    color: '#FFFFFF',
  },
  langSubSelected: {
    color: '#DAB9FF',
  },

  // ── Screen 07: Genres Grid ──
  genresScrollContent: {
    paddingVertical: 10,
  },
  genresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  genreCard: {
    width: (SW - 48 - 12) / 2,
    height: 96,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  genreCardSelected: {
    borderColor: 'transparent',
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  genreCardInner: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
    backgroundColor: 'rgba(19, 19, 24, 0.6)',
  },
  genreCardInnerSelected: {
    backgroundColor: 'rgba(19, 19, 24, 0.4)',
  },
  genreName: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: -0.2,
  },
  genreNameSelected: {
    color: '#FFFFFF',
  },
  genreCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#BF5AF2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Screen 08: Artists Grid ──
  searchBarGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  offlineNotice: {
    fontSize: 11,
    color: 'rgba(255, 214, 10, 0.85)',
    marginBottom: 6,
  },
  artistsScrollContent: {
    paddingBottom: 90,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  artistsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  emptySearchBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptySearchText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 8,
  },
  selectedTray: {
    position: 'absolute',
    bottom: 84,
    left: 24,
    right: 24,
  },
  selectedTrayInner: {
    backgroundColor: 'rgba(19, 19, 24, 0.85)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  trayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trayCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DAB9FF',
  },
  trayHint: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  trayScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  trayItem: {
    position: 'relative',
  },
  trayAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1A29',
    overflow: 'hidden',
  },
  trayFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trayInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  trayRemoveBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#BF5AF2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Screen 09: Creating Your Space ──
  creatingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatingContent: {
    alignItems: 'center',
  },
  creatingLogoBox: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  creatingHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  creatingSub: {
    fontSize: 18,
    fontWeight: '400',
    color: '#DAB9FF',
    marginTop: 6,
    letterSpacing: -0.3,
  },

  // Common Bottom Pill
  bottomPillContainer: {
    paddingTop: 8,
  },

  // Screen 09: Welcome
  welcomeSvgWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.72)',
    letterSpacing: 0.2,
    marginTop: 20,
    textAlign: 'center',
  },
});
