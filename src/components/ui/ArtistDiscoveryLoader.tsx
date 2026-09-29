/**
 * AuraMusic — Refined Artist Discovery Pill Loader
 *
 * Implements a sleek, floating glass pill container with subtle spinner
 * and rotating contextual sentences, without heavy square/orb shapes.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  Easing,
} from 'react-native-reanimated';
import { palette } from '@/src/design/tokens';
import { MUSIC_LANGUAGES, MUSIC_GENRES } from '@/src/data/music-taxonomy';

const { width: SW } = Dimensions.get('window');

const DISCOVERY_SENTENCES = [
  'Finding the best artists for you...',
  'Figuring out who is best for your taste...',
  'Tuning into your frequencies...',
  'Gathering top artists in your languages...',
  'Curating your personal lineup...',
];

interface ArtistDiscoveryLoaderProps {
  selectedLanguages: string[];
  selectedGenres: string[];
}

export const ArtistDiscoveryLoader = React.memo(({
  selectedLanguages,
  selectedGenres,
}: ArtistDiscoveryLoaderProps) => {
  const [sentenceIndex, setSentenceIndex] = useState(0);

  // Cycle sentences every 2200ms
  useEffect(() => {
    const timer = setInterval(() => {
      setSentenceIndex(prev => (prev + 1) % DISCOVERY_SENTENCES.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(250)}
      style={styles.container}
    >
      {/* Sleek Floating Glass Pill Container */}
      <View style={styles.pillContainer}>
        {/* Subtle Activity Spinner */}
        <ActivityIndicator size="small" color={palette.primary} style={styles.spinner} />

        {/* Animated Rotating Discovery Text */}
        <View style={styles.textTrack}>
          <Animated.Text
            key={sentenceIndex}
            entering={FadeInDown.duration(320).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutUp.duration(240).easing(Easing.in(Easing.cubic))}
            style={styles.sentenceText}
            numberOfLines={1}
          >
            {DISCOVERY_SENTENCES[sentenceIndex]}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
});

ArtistDiscoveryLoader.displayName = 'ArtistDiscoveryLoader';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(191, 90, 242, 0.35)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: SW * 0.9,
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  spinner: {
    marginRight: 10,
  },
  textTrack: {
    flexShrink: 1,
    height: 20,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sentenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
});
