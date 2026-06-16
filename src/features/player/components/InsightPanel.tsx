import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerTrack } from '../types/player';
import { getArtworkUrl } from "../../player/utils/track-identity";
import { resolveArtwork } from "../../player/utils/artwork-resolver";
import { AuraArtwork } from "@/src/components/ui/aura-artwork";
import { useArtistEnrichment } from "../../../hooks/use-artist-enrichment";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const SPRING_CONFIG = { damping: 20, stiffness: 150, mass: 1 };

interface InsightPanelProps {
  isVisible: boolean;
  onClose: () => void;
  track: PlayerTrack;
  accentColor: string;
}

export const InsightPanel = ({ isVisible, onClose, track, accentColor }: InsightPanelProps) => {
  const insets = useSafeAreaInsets();
  
  // 1. Fetch Enriched Artist Metadata
  const { enrichedArtist, isLoading, hasEnrichment } = useArtistEnrichment(track.artist);

  const panelStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withSpring(isVisible ? 0 : -SCREEN_HEIGHT, SPRING_CONFIG),
        },
      ],
    };
  });

  // Fallback Metadata
  const displayArt = hasEnrichment ? (enrichedArtist?.art || track.art) : track.art;
  const displayArtist = track.artist;
  const subscribers = hasEnrichment ? enrichedArtist?.subscribers : null;

  return (
    <Animated.View style={[styles.panel, panelStyle, { paddingTop: insets.top + 20 }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 10, 15, 0.96)' }]} />
      )}
      
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Song Insight</Text>
          <Text style={styles.headerSubtitle}>{track.title}</Text>
        </View>

        {/* Artist Card */}
        <View style={styles.artistCard}>
          <AuraArtwork
            source={resolveArtwork({ art: displayArt, artist: displayArtist, type: 'artist' }, 'album')}
            entityName={displayArtist}
            entityType="artist"
            style={styles.artistImage}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
          />
          <View style={styles.artistInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                    <Text style={styles.artistName}>{displayArtist}</Text>
                    <Text style={styles.artistGenre}>
                        {subscribers ? `${subscribers} Listeners` : 'Cinematic • Atmos'}
                    </Text>
                </View>
                {isLoading && <ActivityIndicator color="#FFF" size="small" />}
            </View>
          </View>
        </View>

        {/* Song Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credits & Details</Text>
          <View style={styles.creditsGrid}>
            <View style={styles.creditItem}>
              <Text style={styles.creditLabel}>Released</Text>
              <Text style={styles.creditValue}>{track.year || enrichedArtist?.year || '2024'}</Text>
            </View>
            <View style={styles.creditItem}>
              <Text style={styles.creditLabel}>Label</Text>
              <Text style={styles.creditValue}>Aura Records</Text>
            </View>
            {track.artist && (
                <View style={styles.creditItem}>
                    <Text style={styles.creditLabel}>Producer</Text>
                    <Text style={styles.creditValue}>{track.artist}</Text>
                </View>
            )}
            {hasEnrichment && enrichedArtist?.subscribers && (
                <View style={styles.creditItem}>
                    <Text style={styles.creditLabel}>Listeners</Text>
                    <Text style={styles.creditValue}>{enrichedArtist.subscribers}</Text>
                </View>
            )}
          </View>
        </View>

        {/* Storyline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The Storyline</Text>
          <Text style={styles.storyText}>
            This track "{track.title}" is part of {track.album || 'the current collection'}. 
            {hasEnrichment 
              ? ` Discover more from ${displayArtist} on Aura Music.`
              : ' Atmospheric stillness and refractive beauty of the Aura soundscape.'}
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: accentColor }]}>
            <Text style={styles.closeBtnText}>BACK TO PLAYER</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pull Up Indicator */}
      <View style={[styles.pullUpIndicator, { bottom: insets.bottom + 20 }]}>
        <Ionicons name="chevron-up" size={24} color="rgba(255,255,255,0.3)" />
        <Text style={styles.pullUpText}>Swipe up to dismiss</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    zIndex: 2000,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 28,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  artistCard: {
    height: SCREEN_WIDTH * 0.9,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  artistImage: {
    flex: 1,
  },
  artistInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  artistName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  artistGenre: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  creditsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  creditItem: {
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  creditLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  creditValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  storyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
  },
  footer: {
    marginTop: 10,
    alignItems: 'center',
  },
  closeBtn: {
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#000',
    fontWeight: '900',
    letterSpacing: 1,
  },
  pullUpIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  pullUpText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
