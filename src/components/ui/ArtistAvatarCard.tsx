import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getDeterministicGradient, getInitials } from '@/src/features/player/utils/artwork-resolver';
import { palette } from '@/src/design/tokens';
import { OnboardingArtist } from '@/src/features/taste-profile/types/taste-profile';

const { width: SW } = Dimensions.get('window');
const CARD_WIDTH = Math.floor((SW - 48 - 24) / 3);
const AVATAR_SIZE = Math.min(74, Math.floor(CARD_WIDTH * 0.74));

interface ArtistAvatarCardProps {
  artist: OnboardingArtist;
  isSelected: boolean;
  onToggle: (artist: OnboardingArtist) => void;
}

export const ArtistAvatarCard = React.memo(({
  artist,
  isSelected,
  onToggle,
}: ArtistAvatarCardProps) => {
  const [loadFailed, setLoadFailed] = useState(false);

  // Reset failure if artwork URL changes
  useEffect(() => {
    setLoadFailed(false);
  }, [artist.artworkUrl]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(artist);
  };

  const hasValidUrl = !!artist.artworkUrl && !loadFailed;
  const gradientColors = getDeterministicGradient(artist.name);
  const initials = getInitials(artist.name);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`Artist: ${artist.name}`}
      style={styles.card}
    >
      <View style={[styles.avatarBox, isSelected && styles.avatarBoxSelected]}>
        {hasValidUrl ? (
          <Image
            source={{ uri: artist.artworkUrl }}
            style={styles.avatarImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            onError={() => {
              setLoadFailed(true);
            }}
          />
        ) : (
          /* High-Fidelity Initials Fallback on Deterministic Gradient */
          <View style={styles.fallbackBox}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.initialsText}>{initials}</Text>
            <View style={styles.fallbackOverlay} pointerEvents="none" />
          </View>
        )}

        {/* Selected Glowing Accent Ring */}
        {isSelected && (
          <View style={styles.selectedRing} pointerEvents="none">
            <LinearGradient
              colors={['#BF5AF2', '#DAB9FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ringGradient}
            />
          </View>
        )}

        {/* Floating Checkmark Badge */}
        {isSelected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Artist Name */}
      <Text
        style={[styles.artistName, isSelected && styles.artistNameSelected]}
        numberOfLines={2}
      >
        {artist.name}
      </Text>
    </TouchableOpacity>
  );
});

ArtistAvatarCard.displayName = 'ArtistAvatarCard';

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarBox: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarBoxSelected: {
    transform: [{ scale: 1.04 }],
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#1E1A29',
  },
  fallbackBox: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#1E1A29',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontStyle: 'italic',
  },
  fallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  selectedRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: (AVATAR_SIZE + 10) / 2,
    padding: 2,
  },
  ringGradient: {
    flex: 1,
    borderRadius: (AVATAR_SIZE + 10) / 2,
    opacity: 0.9,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#BF5AF2',
    borderWidth: 2,
    borderColor: '#131318',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  artistName: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.72)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
    width: '100%',
    paddingHorizontal: 2,
  },
  artistNameSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
