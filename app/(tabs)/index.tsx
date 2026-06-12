import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
  StatusBar,
  Share,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlaybackInsets } from '@/src/hooks/use-playback-insets';
import * as Haptics from 'expo-haptics';
import { useMusic } from '@/src/context/MusicContext';
import { usePlayerStore } from '@/src/features/player/store/player.store';
import { useMusicNavigation } from '@/src/navigation/music-navigation';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import { useLikesStore } from '@/src/features/likes/store/likes.store';
import { DownloadManager } from '@/src/features/download/services/download.manager';
import { useAnalyticsStore, getContinueListeningCandidates, getRecentlyPlayedCandidates, getTopArtists, getTopAlbums, getRecentHistory, splitArtistNames } from '@/src/features/analytics/store/analytics.store';
import { useRecommendationsStore } from '@/src/features/recommendations/store/recommendations.store';
import { useLibraryHealthStore } from '@/src/features/library-health/store/library-health.store';
import { hydrateRecommendationSeed } from '@/src/features/recommendations/services/recommendation-hydrator';
import { getCanonicalTrackId } from '@/src/features/player/utils/track-identity';
import { useScrollToTopOnTabPress } from '@/src/hooks/use-scroll-to-top';
import { FlashList } from '@shopify/flash-list';

const { width: SW, height: SH } = Dimensions.get('window');
const PAD = 24;

// ── ROTATION HELPERS ────────────────────────────────────────────────────────
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function getStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  primary: '#BF5AF2',
  primaryMid: '#9B38DA',
  primaryDeep: '#7B2FBE',
  accent: '#46f5e0',
  accentAlt: '#00D4FF',
  amber: '#FFD700',
  bg: '#131318',
  surface: 'rgba(28,28,32,0.6)',
  surfaceDeep: 'rgba(20,20,24,0.8)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
  text: '#FFFFFF',
  textMuted: '#8B8795',
  textSecondary: '#CBC3D9',
};

const SP = { tension: 65, friction: 10 }; // Spring physics

// ── UTILITIES ──────────────────────────────────────────────────────────────
const h2r = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── ANIMATED GRADIENT BACKGROUND ───────────────────────────────────────────
const AnimatedGradientBackground = () => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const color1 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(42, 0, 83, 0.35)', 'rgba(70, 50, 120, 0.3)', 'rgba(42, 0, 83, 0.35)'],
  });

  const color2 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(26, 35, 126, 0.25)', 'rgba(26, 100, 150, 0.2)', 'rgba(26, 35, 126, 0.25)'],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
      <Animated.View
        style={[
          s.blob,
          {
            width: 400,
            height: 400,
            transform: [
              { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [-100, -50] }) },
              { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [-100, -120] }) }
            ],
            backgroundColor: 'rgba(42, 0, 83, 0.35)', // Static color for native performance
            opacity: animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.45, 0.35] })
          },
        ]}
      />
      <Animated.View
        style={[
          s.blob,
          {
            width: 300,
            height: 300,
            transform: [
              { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [SW * 0.7, SW * 0.8] }) },
              { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [100, 150] }) }
            ],
            backgroundColor: 'rgba(26, 35, 126, 0.25)',
            opacity: animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 0.35, 0.25] })
          },
        ]}
      />
      <View
        style={[
          s.blob,
          {
            width: 250,
            height: 250,
            bottom: -50,
            left: '50%',
            backgroundColor: 'rgba(70, 245, 224, 0.08)',
          },
        ]}
      />
    </View>
  );
};

// ── PREMIUM GLASS COMPONENT ────────────────────────────────────────────────
const PremiumGlass = ({
  children,
  style,
  r = 24,
  blur = 60,
  gloss = true,
  gradient = false,
}: any) => {
  return (
    <View style={[{ borderRadius: r, overflow: 'hidden' }, style]}>
      <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: C.surface,
            borderRadius: r,
          },
        ]}
      />

      {gloss && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: r * 0.3,
            right: r * 0.3,
            height: 1.5,
            backgroundColor: 'rgba(255,255,255,0.25)',
            borderRadius: r,
            zIndex: 5,
          }}
        />
      )}

      {gloss && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 6,
            top: 10,
            bottom: 10,
            width: 2.5,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 2,
            zIndex: 4,
          }}
        />
      )}

      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: r,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(255,255,255,0.02)',
          zIndex: 3,
        }}
      />

      {gradient && (
        <LinearGradient
          colors={['rgba(191,90,242,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: r, zIndex: 2 }]}
          pointerEvents="none"
        />
      )}

      <View style={{ zIndex: 1, flex: 1 }}>{children}</View>
    </View>
  );
};

// ── MATERIAL ENTRANCE ANIMATION ────────────────────────────────────────────
const MaterialEntrance = ({ children, delay = 0, style }: any) => {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, ...SP, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <Animated.View style={[{ opacity: op, transform: [{ translateY: ty }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ── INTERACTIVE HEART BUTTON ───────────────────────────────────────────────
const HeartButton = ({ liked = false, onPress, size = 24 }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.7, duration: 100, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: -20, duration: 100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.2, ...SP, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 20, duration: 100, useNativeDriver: true }),
      ]),
      Animated.spring(rotation, { toValue: 0, ...SP, useNativeDriver: true }),
    ]).start();

    onPress?.();
  }, []);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Animated.View
        style={{
          transform: [
            { scale },
            {
              rotate: rotation.interpolate({
                inputRange: [-20, 0, 20],
                outputRange: ['-20deg', '0deg', '20deg'],
              }),
            },
          ],
        }}
      >
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? '#FF1744' : C.textSecondary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── DOWNLOAD BUTTON WITH PROGRESS ──────────────────────────────────────────
const DownloadButton = ({ downloaded = false, onPress, downloading = false, progress = 0 }: any) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (downloading) {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [downloading]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  }, []);

  const rotationValue = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (downloading) {
    return (
      <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={{ position: 'absolute', transform: [{ rotate: rotationValue }] }}>
          <Ionicons name="sync" size={20} color={C.accent} />
        </Animated.View>
        <Text style={{ fontSize: 8, color: C.accent, fontWeight: '900' }}>{Math.round(progress * 100)}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons
        name={downloaded ? 'checkmark-circle' : 'cloud-download-outline'}
        size={24}
        color={downloaded ? C.accent : C.textSecondary}
      />
    </TouchableOpacity>
  );
};

// ── HORIZONTAL TRACK CARD (FIXED) ──────────────────────────────────────────
const TrackCard = React.memo(({ track, onPress, onArtistPress, variant = 'compact' }: any) => {
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  const activeTasks = useDownloadStore(s => s.activeTasks);
  const addDownload = useDownloadStore(s => s.addDownload);

  const isLiked = useLikesStore((s) => !!s.likedTrackIds[track.id]);
  const toggleLike = useLikesStore((s) => s.toggleLike);

  const downloaded = !!downloadedTracks[track.id];
  const task = activeTasks[track.id];
  const downloading = task?.status === 'downloading' || task?.status === 'queued';
  const progress = task?.progress || 0;

  const isCompact = variant === 'compact';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.trackCardContainer, isCompact ? s.trackCardContainerCompact : s.trackCardContainerExpanded]}
    >
      <PremiumGlass r={20} blur={40} gloss style={[s.trackCardGlass, isCompact ? s.trackCardGlassCompact : s.trackCardGlassExpanded]}>
        <View style={[s.trackCardImageContainer, isCompact ? s.trackCardImageContainerCompact : s.trackCardImageContainerExpanded]}>
          <Image source={{ uri: track.image }} style={s.trackCardImage} contentFit="cover" transition={200} />
          <View style={s.trackCardImageOverlay} />
        </View>
        <View style={[s.trackCardContent, !isCompact && s.trackCardContentExpanded]}>
          <Text style={[s.trackCardTitle, isCompact ? s.trackCardTitleCompact : s.trackCardTitleExpanded]} numberOfLines={isCompact ? 1 : 2}>
            {track.title}
          </Text>
          <TouchableOpacity onPress={(e) => {
            e.stopPropagation();
            onArtistPress?.();
          }}>
            <Text style={[s.trackCardArtist, !isCompact && s.trackCardArtistExpanded]} numberOfLines={1}>
              {track.artist}
            </Text>
          </TouchableOpacity>
          
          {!isCompact && (
            <View style={s.trackCardActionsExpandedRow}>
              <DownloadButton
                downloaded={downloaded}
                downloading={downloading}
                progress={progress}
                onPress={() => {
                  if (!downloaded && !downloading) {
                    addDownload({ 
                      id: track.id, 
                      title: track.title, 
                      artist: track.artist, 
                      art: track.image,
                      url: track.url
                    });
                  }
                }}
              />
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleLike({ ...track, art: track.image });
                }}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={24}
                  color={isLiked ? C.primary : C.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {isCompact && (
          <View style={s.trackCardActionsCompact}>
            <DownloadButton
              downloaded={downloaded}
              downloading={downloading}
              progress={progress}
              onPress={() => {
                if (!downloaded && !downloading) {
                   addDownload({ 
                    id: track.id, 
                    title: track.title, 
                    artist: track.artist, 
                    art: track.image,
                    url: track.url
                  });
                }
              }}
            />
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleLike({ ...track, art: track.image });
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginTop: 12 }}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={22}
                color={isLiked ? C.primary : C.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}
      </PremiumGlass>
    </TouchableOpacity>
  );
});

// ── BENTO CARD (LARGE FEATURED) ────────────────────────────────────────────
const BentoCard = React.memo(({
  image,
  title,
  subtitle,
  tag,
  onPress,
  style
}: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.bentoCard, style]}
    >
      <PremiumGlass r={28} blur={60} gloss gradient style={s.bentoCardGlass}>
        <View style={s.bentoCardImageContainer}>
          <Image 
            source={{ uri: image }} 
            style={[s.bentoCardImage, { borderRadius: 28 }]} 
            contentFit="cover" 
            transition={300} 
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
        <View style={s.bentoCardContent}>
          {tag && (
            <View style={s.bentoCardTag}>
              <Text style={s.bentoCardTagText}>{tag}</Text>
            </View>
          )}
          <Text style={s.bentoCardTitle} numberOfLines={2}>{title}</Text>
          <Text style={s.bentoCardSubtitle} numberOfLines={2}>{subtitle}</Text>
        </View>
      </PremiumGlass>
    </TouchableOpacity>
  );
});

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'Just now';
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── CONTINUE LISTENING CARD (REDESIGNED LIKE PAGE.HTML) ───────────────────
const ContinueListeningCard = React.memo(({ track, onPress }: any) => {
  const candidateCanonical = getCanonicalTrackId({ id: track.id, title: track.title, artist: track.artist });
  const isPlaying = usePlayerStore(s => s.isPlaying && s.currentTrack && getCanonicalTrackId(s.currentTrack) === candidateCanonical);
  const isPaused = usePlayerStore(s => !s.isPlaying && s.currentTrack && getCanonicalTrackId(s.currentTrack) === candidateCanonical);
  const progressPercent = Math.round(track.completionRatio * 100);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.clCardContainer}
    >
      <PremiumGlass r={20} blur={40} gloss style={s.clCardGlass}>
        <View style={s.clCardImageContainer}>
          <Image source={{ uri: track.art }} style={s.clCardImage} contentFit="cover" transition={200} />
          
          {/* Progress bar overlay at the bottom */}
          <View style={s.clProgressBarContainer}>
            <View style={[s.clProgressBarActive, { width: `${track.completionRatio * 100}%` }]} />
          </View>
        </View>
      </PremiumGlass>
      <Text style={s.clCardTitle} numberOfLines={1}>
        {track.title}
      </Text>
      <Text style={s.clCardArtist} numberOfLines={1}>
        {track.artist}
      </Text>
      
      <View style={s.clProgressInfo}>
        {isPlaying ? (
          <Text style={s.clNowPlayingText}>Now Playing</Text>
        ) : isPaused ? (
          <Text style={s.clPausedText}>Paused</Text>
        ) : (
          <Text style={s.clProgressText}>{progressPercent}% completed</Text>
        )}
        <Text style={s.clTimeText}> • {formatRelativeTime(track.playedAt)}</Text>
      </View>
    </TouchableOpacity>
  );
});

// ── RECENTLY PLAYED CARD (EDITORIAL GLASS DESIGN) ─────────────────────────
const RecentlyPlayedCard = React.memo(({ track, onPress }: any) => {
  const candidateCanonical = getCanonicalTrackId({ id: track.id, title: track.title, artist: track.artist });
  const isPlaying = usePlayerStore(s => s.isPlaying && s.currentTrack && getCanonicalTrackId(s.currentTrack) === candidateCanonical);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.rpCardContainer}
    >
      <PremiumGlass r={16} blur={30} gloss style={s.rpCardGlass}>
        <View style={s.rpCardImageContainer}>
          <Image source={{ uri: track.art }} style={s.rpCardImage} contentFit="cover" transition={200} />
          {isPlaying && (
            <View style={s.rpActiveOverlay}>
              <Ionicons name="volume-high" size={24} color={C.primary} />
            </View>
          )}
        </View>
      </PremiumGlass>
      <Text style={s.rpCardTitle} numberOfLines={1}>
        {track.title}
      </Text>
      <Text style={s.rpCardArtist} numberOfLines={1}>
        {track.artist}
      </Text>
    </TouchableOpacity>
  );
});

// ── CIRCULAR ARTIST CARD ───────────────────────────────────────────────────
const CircleArtistCard = ({ name, image, score, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.circleArtistContainer}
    >
      <PremiumGlass r={64} blur={60} gloss style={s.circleArtistGlass}>
        <Image source={{ uri: image }} style={s.circleArtistImage} contentFit="cover" />
      </PremiumGlass>
      <Text style={s.circleArtistName} numberOfLines={1}>
        {name}
      </Text>
      {score !== undefined && score > 0 && (
        <Text style={s.circleArtistScore} numberOfLines={1}>
          Affinity: {score.toFixed(1)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// ── FAVORITE ALBUM CARD ───────────────────────────────────────────────────
const FavoriteAlbumCard = React.memo(({ album, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.favAlbumContainer}
    >
      <PremiumGlass r={22} blur={45} gloss style={s.favAlbumGlass}>
        <View style={s.favAlbumImageContainer}>
          <Image 
            source={{ uri: album.image }} 
            style={s.favAlbumImage} 
            contentFit="cover" 
            transition={200} 
          />
        </View>
      </PremiumGlass>
      <Text style={s.favAlbumTitle} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={s.favAlbumArtist} numberOfLines={1}>
        {album.artist}
      </Text>
    </TouchableOpacity>
  );
});

// ── DAILY MIX CARD ────────────────────────────────────────────────────────
const DailyMixCard = React.memo(({ seed, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.dmCardContainer}
    >
      <PremiumGlass r={20} blur={35} gloss style={s.dmCardGlass}>
        <View style={s.dmCardImageContainer}>
          <Image 
            source={{ uri: seed.image }} 
            style={s.dmCardImage} 
            contentFit="cover" 
            transition={200} 
          />
          <View style={s.dmBadge}>
            <Ionicons name="sparkles" size={10} color={C.accent} />
            <Text style={s.dmBadgeText}>MIX</Text>
          </View>
        </View>
      </PremiumGlass>
      <Text style={s.dmCardTitle} numberOfLines={1}>
        {seed.title}
      </Text>
      <Text style={s.dmCardSubtitle} numberOfLines={1}>
        Based on your taste
      </Text>
    </TouchableOpacity>
  );
});

// ── BECAUSE YOU LIKE CARD ──────────────────────────────────────────────────
const BecauseYouLikeCard = React.memo(({ seed, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.bylCardContainer}
    >
      <PremiumGlass r={24} blur={40} gloss style={s.bylCardGlass}>
        <Image 
          source={{ uri: seed.image }} 
          style={s.bylCardImage} 
          contentFit="cover" 
          transition={200} 
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={s.bylCardContent}>
          <Text style={s.bylCardLabel}>BECAUSE YOU LIKE</Text>
          <Text style={s.bylCardArtist} numberOfLines={1}>{seed.title}</Text>
        </View>
      </PremiumGlass>
    </TouchableOpacity>
  );
});

// ── SEED TRACK CARD (REDISCOVER & LOVED) ────────────────────────────────────
const SeedTrackCard = React.memo(({ seed, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.stCardContainer}
    >
      <PremiumGlass r={16} blur={30} gloss style={s.stCardGlass}>
        <View style={s.stCardImageContainer}>
          <Image 
            source={{ uri: seed.image }} 
            style={s.stCardImage} 
            contentFit="cover" 
            transition={200} 
          />
        </View>
      </PremiumGlass>
      <Text style={s.stCardTitle} numberOfLines={1}>
        {seed.title}
      </Text>
      <Text style={s.stCardArtist} numberOfLines={1}>
        {seed.artistName || 'Unknown Artist'}
      </Text>
    </TouchableOpacity>
  );
});

// ── SWIPEABLE HERO CARD ────────────────────────────────────────────────────
const SwipeableHeroCard = ({ albums, onPlay, onPressCard }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardWidth = SW - PAD * 2;

  return (
    <View style={s.heroCard}>
      <ScrollView
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
          if (index !== currentIndex) {
            setCurrentIndex(index);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }}
      >
        {albums.map((album: any) => (
          <TouchableOpacity
            key={album.id}
            activeOpacity={0.95}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onPressCard?.(album.id);
            }}
            style={[s.heroSlide, { width: cardWidth }]}
          >
            <Image source={{ uri: album.artwork || album.image }} style={s.heroImage} contentFit="cover" contentPosition="center" />
            <LinearGradient
              colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.82)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.heroBottom}>
              <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={s.heroInfo}>
                <Text numberOfLines={1} style={s.heroTitle}>{album.title}</Text>
                <Text numberOfLines={1} style={s.heroSubtitle}>{album.artist}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Text style={{ color: C.accent, fontSize: 11, fontWeight: 'bold' }}>{album.confidence}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 8 }}>{album.updatedAt}</Text>
                </View>
                {album.reason && (
                  <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>
                    {album.reason}
                  </Text>
                )}
              </View>

              <View style={s.heroControls}>
                <View style={s.pagination}>
                  {albums.map((_: any, i: number) => (
                    <View
                      key={i}
                      style={[
                        s.paginationDot,
                        currentIndex === i && s.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    onPlay?.(album);
                  }}
                  activeOpacity={0.8}
                  style={s.heroPlayButton}
                >
                  <LinearGradient
                    colors={[h2r('#BF5AF2', 0.9), h2r('#9B38DA', 1)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="play" size={32} color={C.text} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// ── SECTION HEADER ─────────────────────────────────────────────────────────
const SectionHeader = ({ title, onSeeAll }: any) => (
  <View style={s.sectionHeader}>
    <Text style={s.sectionTitle}>{title}</Text>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
        <Text style={s.seeAllText}>See all</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ── MAIN HOME SCREEN ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const scrollRef = useRef<any>(null);
  useScrollToTopOnTabPress(scrollRef);
  const insets = useSafeAreaInsets();
  const { bottomPadding } = usePlaybackInsets();
  const { goNowPlaying, goArtist, goPlaylist, goAlbum, goArtistByName, router } = useMusicNavigation('home');
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [downloadedSongs, setDownloadedSongs] = useState<Set<string>>(new Set());

  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { title: 'Good morning', sub: 'Rise and shine for some morning beats.' };
    } else if (hour >= 12 && hour < 17) {
      return { title: 'Good afternoon', sub: 'Keep the energy up with some mid-day vibes.' };
    } else if (hour >= 17 && hour < 21) {
      return { title: 'Good evening', sub: 'Ready for some evening vibes?' };
    } else {
      return { title: 'Good night', sub: 'Wind down with some midnight melodies.' };
    }
  }, []);

  const albums = [
    {
      id: 'neon-echoes',
      title: 'Neon Dreams',
      artist: 'The Midnight Syndicate • New Release',
      image: 'https://picsum.photos/400/400?random=7',
    },
    {
      id: 'a3',
      title: 'Echoes of Silence',
      artist: 'Lumina Flux • 2024',
      image: 'https://picsum.photos/400/400?random=8',
    },
    {
      id: 'solaris',
      title: 'Urban Jungle',
      artist: 'Concrete Beats • Trending',
      image: 'https://picsum.photos/400/400?random=9',
    },
  ];

  const tracks = [
    { id: 'nebula', title: 'Echoes of Silence', artist: 'Lumina Flux', artistId: '1', image: 'https://picsum.photos/300/300?random=1' },
    { id: 'neon', title: 'Urban Jungle', artist: 'Concrete Beats', artistId: 'elara', image: 'https://picsum.photos/300/300?random=2' },
    { id: 'solar', title: 'Neon Dreams', artist: 'The Midnight Syndicate', artistId: 'elara', image: 'https://picsum.photos/300/300?random=3' },
    { id: 'cosmic', title: 'Cosmic Wave', artist: 'Digital Echo', artistId: '2', image: 'https://picsum.photos/300/300?random=10' },
    { id: 'midnight', title: 'Midnight Flow', artist: 'Luna Ray', artistId: '2', image: 'https://picsum.photos/300/300?random=11' },
  ];
  const trackUrls: Record<string, string> = {
    nebula: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    neon: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    solar: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    cosmic: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    midnight: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    '1': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    '2': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    '3': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  };

  const artists = [
    { id: '1', name: 'Solstice', image: 'https://picsum.photos/300/300?random=4' },
    { id: '2', name: 'Luna Ray', image: 'https://picsum.photos/300/300?random=5' },
    { id: 'elara', name: 'Elara Vance', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVPNWk1tlfHYyyWTBZhwh81Z6py-WVfUuxGVj51H72sBRafC8YphQ6KN32w47mVX4Vc_Gilgd9z97W25tKGqRujSEIq2yStVYqau9IUi6SHp1oWk4cXmYzmyTW3FjDYeBq6PdVhXaO0tAWivGBf42atMriqBRDwDtZarzZFB8CXSe6nZ2p5F-dWmhBrdH-IMd3mhHX3Thcn_9L_5R7nIJdFSM0Rglel2NhCZiTz9FL4EQBpTBZwwMZTDDbA8vKdPQ3ErzWfZi8Lqw' },
  ];

  const playlistsData = [
    {
      id: 'p1',
      title: 'Daily Mix 1',
      image: 'https://picsum.photos/400/300?random=8',
      tag: 'PERSONALIZED',
      subtitle: 'Experimental pop, synthwave, and indie electronic just for you.',
    },
    {
      id: 'p2',
      title: 'Focus Flow',
      image: 'https://picsum.photos/400/300?random=9',
      subtitle: 'Deep ambient for concentration.',
    },
    {
      id: 'p3',
      title: 'Chill Vibes',
      image: 'https://picsum.photos/400/300?random=12',
      subtitle: 'Relaxing sounds for your mood.',
    },
  ];

  const { setQueue } = useMusic();
  const setActiveContext = usePlayerStore(s => s.setActiveContext);

  const history = useAnalyticsStore(s => s.history);
  const artistAffinities = useAnalyticsStore(s => s.artistAffinities);
  const albumAffinities = useAnalyticsStore(s => s.albumAffinities);
  const analyticsVersion = useAnalyticsStore(s => s.analyticsVersion);

  const continueListeningCandidates = useMemo(() => {
    const seen = new Set<string>();
    const list = history
      .filter((e) => e.positionMs >= 30000 && e.completionRatio < 0.95 && !e.skipped)
      .sort((a, b) => b.playedAt - a.playedAt);
      
    return list.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [history]);

  const continueListeningTracks = useMemo(() => {
    return continueListeningCandidates
      .filter((t) => t.art && !t.art.includes('placeholder') && !t.art.includes('picsum.photos'))
      .slice(0, 7);
  }, [continueListeningCandidates]);

  const recentlyPlayedCandidates = useMemo(() => {
    const seen = new Set<string>();
    const list = history
      .filter((e) => !!e.trackSnapshot)
      .sort((a, b) => b.playedAt - a.playedAt);
      
    return list.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [history]);

  const recentlyPlayedTracks = useMemo(() => {
    return recentlyPlayedCandidates
      .filter((t) => t.art && !t.art.includes('placeholder') && !t.art.includes('picsum.photos'))
      .slice(0, 20);
  }, [recentlyPlayedCandidates]);

  const rawTopArtists = useMemo(() => {
    return Object.keys(artistAffinities)
      .map((key) => ({ key, ...artistAffinities[key] }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.playCount - a.playCount;
      });
  }, [artistAffinities]);

  const rawTopAlbums = useMemo(() => {
    return Object.keys(albumAffinities)
      .map((key) => ({ key, ...albumAffinities[key] }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.playCount - a.playCount;
      });
  }, [albumAffinities]);

  const recStoreVersion = useRecommendationsStore(s => s.analyticsVersion);
  const generateRecommendations = useRecommendationsStore(s => s.generateRecommendations);

  const lastRecommendationBuild = useRecommendationsStore(s => s.lastRecommendationBuild);
  const refreshTrendingIfNeeded = useRecommendationsStore(s => s.refreshTrendingIfNeeded);

  useEffect(() => {
    // Re-check trending seeds freshness on mount/focus
    refreshTrendingIfNeeded();

    const now = Date.now();
    const timeSinceLastBuild = now - (lastRecommendationBuild || 0);
    const fourHours = 4 * 60 * 60 * 1000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    // Check if new history items exist since the last build
    const latestHistoryTime = history[0]?.playedAt || 0;
    
    if (!lastRecommendationBuild || timeSinceLastBuild > sevenDays || (timeSinceLastBuild > fourHours && latestHistoryTime > (lastRecommendationBuild || 0))) {
      console.log('[Recommendations] Recommendations are stale (older than 7 days) or fresher telemetry detected. Rebuilding.');
      generateRecommendations();
    }
  }, [lastRecommendationBuild, history, generateRecommendations, refreshTrendingIfNeeded]);

  const artistCache = useAnalyticsStore((s) => s.artistCache || {});
  const rawDailyMixes = useRecommendationsStore(s => s.dailyMixes || []);
  const rawMadeForYou = useRecommendationsStore(s => s.madeForYou || []);
  const rawRediscover = useRecommendationsStore(s => s.rediscover || []);
  const rawBecauseYouLike = useRecommendationsStore(s => s.becauseYouLike || []);
  const rawRecentlyLoved = useRecommendationsStore(s => s.recentlyLoved || []);
  const rawHiddenGems = useRecommendationsStore(s => s.hiddenGems || []);
  const rawForgottenFavorites = useRecommendationsStore(s => s.forgottenFavorites || []);
  const trendingSeeds = useRecommendationsStore(s => s.trendingSeeds || []);
  const rawTrendingForYou = useRecommendationsStore(s => s.trendingForYou);
  const rawTopSongs = useRecommendationsStore(s => s.topSongs || []);
  const rawRecoTopArtists = useRecommendationsStore(s => s.topArtists || []);

  const healthReport = useLibraryHealthStore(s => s.healthReport);
  const duplicateGroups = useLibraryHealthStore(s => s.duplicateGroups);

  const isStale = useMemo(() => {
    if (!lastRecommendationBuild) return true;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return (Date.now() - lastRecommendationBuild) > sevenDays;
  }, [lastRecommendationBuild]);

  const dailyMixes = useMemo(() => {
    if (isStale) return [];
    return rawDailyMixes.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawDailyMixes, isStale]);

  const madeForYou = useMemo(() => {
    if (isStale) return [];
    return rawMadeForYou.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawMadeForYou, isStale]);

  const rediscover = useMemo(() => {
    if (isStale) return [];
    return rawRediscover.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawRediscover, isStale]);

  const becauseYouLike = useMemo(() => {
    if (isStale) return [];
    return rawBecauseYouLike.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawBecauseYouLike, isStale]);

  const recentlyLoved = useMemo(() => {
    if (isStale) return [];
    return rawRecentlyLoved.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawRecentlyLoved, isStale]);

  const hiddenGems = useMemo(() => {
    if (isStale) return [];
    return rawHiddenGems.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawHiddenGems, isStale]);

  const forgottenFavorites = useMemo(() => {
    if (isStale) return [];
    return rawForgottenFavorites.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawForgottenFavorites, isStale]);

  const trendingForYou = useMemo(() => {
    if (isStale || !rawTrendingForYou) return null;
    if (rawTrendingForYou.image && !rawTrendingForYou.image.includes('placeholder') && !rawTrendingForYou.image.includes('picsum.photos')) {
      return rawTrendingForYou;
    }
    return null;
  }, [rawTrendingForYou, isStale]);

  const topSongs = useMemo(() => {
    if (isStale) return [];
    return rawTopSongs.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawTopSongs, isStale]);

  const topArtists = useMemo(() => {
    if (isStale) return [];
    return rawRecoTopArtists.filter(item => item.image && !item.image.includes('placeholder') && !item.image.includes('picsum.photos'));
  }, [rawRecoTopArtists, isStale]);
  const listeningDNA = useRecommendationsStore(s => s.listeningDNA);
  const tasteDriftLevel = useRecommendationsStore(s => s.tasteDriftLevel);
  const registerRecommendationShown = useRecommendationsStore(s => s.registerRecommendationShown);

  const [rowType, setRowType] = useState<'gems' | 'favorites' | null>(null);

  useEffect(() => {
    const hasGems = hiddenGems.length > 0;
    const hasFavorites = forgottenFavorites.length > 0;

    if (hasGems && hasFavorites) {
      const topArtistName = topArtists[0]?.title || 'Aura';
      const dayOfYear = getDayOfYear(new Date());
      const seedString = `${topArtistName}-${dayOfYear}`;
      const userHash = getStringHash(seedString);
      const normalizedScore = (userHash % 1000) / 1000;

      const listenerType = listeningDNA?.listenerType || 'Balanced';
      let gemsThreshold = 0.50;
      if (listenerType === 'Explorer') {
        gemsThreshold = 0.70;
      } else if (listenerType === 'Loyalist') {
        gemsThreshold = 0.30;
      }

      if (normalizedScore < gemsThreshold) {
        setRowType('gems');
      } else {
        setRowType('favorites');
      }
    } else if (hasGems) {
      setRowType('gems');
    } else if (hasFavorites) {
      setRowType('favorites');
    } else {
      setRowType(null);
    }
  }, [hiddenGems, forgottenFavorites, topArtists, listeningDNA]);

  // Fatigue protection registration on feed visibility/load
  useEffect(() => {
    dailyMixes.forEach(s => registerRecommendationShown(s.id));
    madeForYou.forEach(s => registerRecommendationShown(s.id));
    becauseYouLike.forEach(s => registerRecommendationShown(s.id));
    rediscover.forEach(s => registerRecommendationShown(s.id));
    recentlyLoved.forEach(s => registerRecommendationShown(s.id));
    if (trendingForYou) {
      registerRecommendationShown(trendingForYou.id);
    }
    if (rowType === 'gems') {
      hiddenGems.forEach(s => registerRecommendationShown(s.id));
    } else if (rowType === 'favorites') {
      forgottenFavorites.forEach(s => registerRecommendationShown(s.id));
    }
  }, [dailyMixes, madeForYou, becauseYouLike, rediscover, recentlyLoved, trendingForYou, registerRecommendationShown, rowType, hiddenGems, forgottenFavorites]);
  const favoriteArtists = useMemo(() => {
    return rawTopArtists
      .filter((artist) => artist.score > 0)
      .map((artist) => {
        const cached = artistCache[artist.key];
        const match = history.find((h) => {
          const names = splitArtistNames(h.artist);
          return names.includes(artist.key);
        });

        // Rule 5: Only render artists with a real, cached profile image (never track/album artwork or picsum)
        const image = cached?.image;
        if (!image || image.includes('placeholder') || image.includes('picsum.photos')) {
          return null;
        }

        return {
          name: artist.key,
          id: cached?.id || match?.artistId || null,
          image: image,
          score: artist.score,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 10);
  }, [rawTopArtists, history, artistCache]);

  const recentlyPlayedArtists = useMemo(() => {
    const list: Array<{ name: string; id: string | null; image: string }> = [];
    const seen = new Set<string>();

    for (const entry of history) {
      const names = splitArtistNames(entry.artist);
      for (const name of names) {
        if (!seen.has(name)) {
          seen.add(name);
          const cached = artistCache[name];
          const image = cached?.image;
          
          // Rule 5: Only render artists with a real, cached profile image
          if (image && !image.includes('placeholder') && !image.includes('picsum.photos')) {
            list.push({
              name,
              id: cached?.id || (names[0] === name ? entry.artistId : null),
              image: image,
            });
          }
        }
      }
      if (list.length >= 10) break;
    }
    return list;
  }, [history, artistCache]);

  // Asynchronously resolve profile image & browseId for favorite and recently played artists
  useEffect(() => {
    const missing = new Set<string>();

    favoriteArtists.forEach((a) => {
      if (!artistCache[a.name] || !artistCache[a.name].image || !artistCache[a.name].id) {
        missing.add(a.name);
      }
    });

    recentlyPlayedArtists.forEach((a) => {
      if (!artistCache[a.name] || !artistCache[a.name].image || !artistCache[a.name].id) {
        missing.add(a.name);
      }
    });

    if (missing.size === 0) return;

    let active = true;
    const resolveMissing = async () => {
      const { musicService } = require('@/src/services/api/music');
      const cacheAction = useAnalyticsStore.getState().cacheArtistDetails;
      for (const name of missing) {
        if (!active) break;
        try {
          console.log(`[ArtistResolver] Resolving artist profile for: ${name}`);
          const results = await musicService.searchArtists(name);
          if (results && results.length > 0) {
            const bestMatch = results[0];
            if (bestMatch && bestMatch.id && active) {
              cacheAction(name, {
                id: bestMatch.id,
                image: bestMatch.art || '',
              });
            }
          }
        } catch (err) {
          console.warn(`[ArtistResolver] Failed to resolve details for artist ${name}:`, err);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    };

    resolveMissing();

    return () => {
      active = false;
    };
  }, [favoriteArtists, recentlyPlayedArtists, artistCache]);

  const handlePlaySeed = useCallback(async (seed: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const tracks = await hydrateRecommendationSeed(seed);
      if (tracks && tracks.length > 0) {
        let contextType: any = 'home';
        if (seed.type === 'artist' || seed.type === 'album' || seed.type === 'playlist') {
          contextType = seed.type;
        }
        setActiveContext({ type: contextType, id: seed.id, name: seed.title });
        
        const queueTracks = tracks.map((t: any) => ({
          id: t.id,
          url: t.url || '',
          title: t.title,
          artist: t.artist,
          art: t.art,
          duration: t.duration || 240,
          dominantColors: t.dominantColors || ['#bf5af2', '#1a0033'],
        }));
        
        setQueue(queueTracks as any, 0);
        goNowPlaying(queueTracks[0].id);
      } else {
        Alert.alert('Playback Error', 'No playable tracks could be loaded for this mix.');
      }
    } catch (e) {
      console.error('[HomeScreen] Error hydrating dynamic seed:', e);
      Alert.alert('Hydration Error', 'An error occurred while loading this mix.');
    }
  }, [goNowPlaying, setQueue, setActiveContext]);



  const heroSlides = useMemo(() => {
    const list = [];

    // Helper for relative time
    const getRelativeTime = (timestamp: number | null) => {
      if (!timestamp) return 'Updated today';
      const diffMs = Date.now() - timestamp;
      const diffMins = Math.round(diffMs / 60000);
      if (diffMins < 1) return 'Updated just now';
      if (diffMins < 60) return `Updated ${diffMins} min ago`;
      const diffHours = Math.round(diffMins / 60);
      if (diffHours < 24) return `Updated ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return 'Updated today';
    };

    const recoStore = useRecommendationsStore.getState();
    const lastBuild = recoStore.lastRecommendationBuild;
    const timeText = getRelativeTime(lastBuild);

    // Slot 1: Daily Soundtrack (Comfort/Familiar mix) - Rule 8: Hero requires confidence >= 70
    const dailyMix = dailyMixes && dailyMixes[0];
    if (dailyMix && (!dailyMix.confidence || dailyMix.confidence >= 70)) {
      list.push({
        id: dailyMix.id,
        title: 'Daily Soundtrack',
        artist: dailyMix.title || 'Your Daily Soundtrack',
        image: dailyMix.image,
        isSeed: true,
        seed: dailyMix,
        artwork: dailyMix.image,
        confidence: dailyMix.confidence ? `${dailyMix.confidence}% Match` : '98% Match',
        reason: dailyMix.reason || 'Based on your recent favorites',
        updatedAt: timeText,
      });
    }

    // Slot 2: Trending For You - Rule 8: Hero requires confidence >= 70
    const trending = trendingForYou;
    if (trending && (!trending.confidence || trending.confidence >= 70)) {
      list.push({
        id: trending.id,
        title: 'Trending For You',
        artist: trending.title || 'Personalized Hits',
        image: trending.image,
        isSeed: true,
        seed: trending,
        artwork: trending.image,
        confidence: trending.confidence ? `${trending.confidence}% Match` : '91% Match',
        reason: trending.reason || 'Popular among artists you frequently enjoy',
        updatedAt: timeText,
      });
    }

    // Slot 3: Taste Evolution - Rule 8: Hero requires confidence >= 70
    let evolutionTitle = 'Your Taste is Evolving';
    let defaultReason = 'Exploring fresh new sounds for you';
    let defaultConfidence = 76;

    if (tasteDriftLevel === 'major') {
      evolutionTitle = 'Exploring New Sounds';
      defaultReason = 'Exploring new sounds outside your comfort zone';
      defaultConfidence = 76;
    } else if (tasteDriftLevel === 'moderate') {
      evolutionTitle = 'Your Taste Is Evolving';
      defaultReason = 'Your taste profile is evolving with new discoveries';
      defaultConfidence = 82;
    } else if (listeningDNA && listeningDNA.explorationScore > 60) {
      evolutionTitle = 'Hidden Gems';
      defaultReason = 'Exploring lesser-known artists you might like';
      defaultConfidence = 85;
    } else if (listeningDNA && listeningDNA.primarySession === 'night') {
      evolutionTitle = 'Late Night Energy';
      defaultReason = 'Atmospheric late-night tracks to wind down';
      defaultConfidence = 80;
    } else {
      evolutionTitle = 'Back To Your Favorites';
      defaultReason = 'Rediscover your all-time favorite tracks';
      defaultConfidence = 94;
    }

    const evoSeed = madeForYou && madeForYou[0] ? madeForYou[0] : (rediscover && rediscover[0] ? rediscover[0] : null);
    const confidenceScore = evoSeed?.confidence ?? defaultConfidence;
    if (evoSeed && confidenceScore >= 70) {
      list.push({
        id: evoSeed.id,
        title: evolutionTitle,
        artist: evoSeed.title || 'Personalized for your taste',
        image: evoSeed.image,
        isSeed: true,
        seed: evoSeed,
        artwork: evoSeed.image,
        confidence: `${confidenceScore}% Match`,
        reason: evoSeed.reason || defaultReason,
        updatedAt: timeText,
      });
    }

    // Rule 1: Filter out any slides without real artwork or placeholder/picsum images
    return list.filter(slide => slide.artwork && !slide.artwork.includes('placeholder') && !slide.artwork.includes('picsum.photos'));
  }, [dailyMixes, trendingForYou, tasteDriftLevel, listeningDNA, madeForYou, rediscover]);

  const handlePlayCLTrack = useCallback((track: any) => {
    const { resumeTrackFromHistory } = require('@/src/features/player/utils/playback-resume');
    resumeTrackFromHistory(track, goNowPlaying, 'home');
  }, [goNowPlaying]);

  const handlePlayRPTrack = useCallback((track: any) => {
    const { resumeTrackFromHistory } = require('@/src/features/player/utils/playback-resume');
    resumeTrackFromHistory(track, goNowPlaying, 'home');
  }, [goNowPlaying]);

  const handleArtistClick = useCallback(async (artist: { name: string; id: string | null }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (artist.id && artist.id.length > 5) {
      goArtist(artist.id);
      return;
    }
    try {
      const { musicService } = require('@/src/services/api/music');
      const results = await musicService.searchArtists(artist.name);
      if (results && results.length > 0) {
        const bestMatch = results[0];
        if (bestMatch && bestMatch.id) {
          goArtist(bestMatch.id);
          return;
        }
      }
    } catch (e) {
      console.warn('[HomeScreen] Failed to resolve artist browseId dynamically:', e);
    }
    goArtistByName(artist.name);
  }, [goArtist, goArtistByName]);

  const favoriteAlbums = useMemo(() => {
    return rawTopAlbums
      .filter((album) => album.score > 0)
      .map((album) => {
        const match = history.find((h) => h.album === album.key);
        const image = match?.art;
        if (!image || image.includes('placeholder') || image.includes('picsum.photos')) {
          return null;
        }
        return {
          title: album.key,
          id: match?.albumId || album.key,
          artist: match?.artist || 'Unknown Artist',
          image: image,
          score: album.score,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .slice(0, 10);
  }, [rawTopAlbums, history]);

  const handlePlayPress = useCallback((item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    if (item.isSeed && item.seed) {
      handlePlaySeed(item.seed);
      return;
    }

    setActiveContext({ type: 'home', id: 'home' });
    
    const idx = tracks.findIndex(t => t.id === item.id);
    const queueTracks = tracks.map(t => ({
      id: t.id,
      url: '',
      title: t.title,
      artist: t.artist,
      art: item.image,
      duration: 240,
      dominantColors: ['#bf5af2', '#1a0033'],
    }));
    
    setQueue(queueTracks as any, idx !== -1 ? idx : 0);
    goNowPlaying(item.id);
  }, [goNowPlaying, setQueue, tracks, setActiveContext, handlePlaySeed]);

  const sections = useMemo(() => {
    const list = [];
    list.push({ id: 'welcome', type: 'welcome' });
    if (heroSlides.length > 0) {
      list.push({ id: 'hero', type: 'hero', data: heroSlides });
    } else {
      list.push({ id: 'onboarding', type: 'onboarding' });
    }
    if (continueListeningTracks.length > 0) {
      list.push({ id: 'continue_listening', type: 'continue_listening', data: continueListeningTracks });
    }
    if (recentlyPlayedTracks.length > 0) {
      list.push({ id: 'recently_played', type: 'recently_played', data: recentlyPlayedTracks });
    }
    if (topSongs && topSongs.length > 0) {
      list.push({ id: 'top_songs', type: 'top_songs', data: topSongs });
    }
    if (dailyMixes && dailyMixes.length > 0) {
      list.push({ id: 'daily_mixes', type: 'daily_mixes', data: dailyMixes });
    }
    if (rowType !== null && (rowType === 'gems' ? hiddenGems.length > 0 : forgottenFavorites.length > 0)) {
      list.push({ id: 'row_type', type: 'row_type', data: rowType === 'gems' ? hiddenGems : forgottenFavorites, rowType });
    }
    if (healthReport && healthReport.storageWasteBytes > 250 * 1024 * 1024) {
      list.push({ id: 'cleanup', type: 'cleanup', data: healthReport });
    }
    if (madeForYou && madeForYou.length > 0) {
      list.push({ id: 'made_for_you', type: 'made_for_you', data: madeForYou });
    }
    if (becauseYouLike && becauseYouLike.length > 0) {
      list.push({ id: 'because_you_like', type: 'because_you_like', data: becauseYouLike });
    }
    if (topArtists && topArtists.length > 0) {
      list.push({ id: 'top_artists', type: 'top_artists', data: topArtists });
    }
    if (favoriteArtists.length > 0) {
      list.push({ id: 'favorite_artists', type: 'favorite_artists', data: favoriteArtists });
    }
    if (favoriteAlbums.length > 0) {
      list.push({ id: 'favorite_albums', type: 'favorite_albums', data: favoriteAlbums });
    }
    if (trendingSeeds && trendingSeeds.length > 0) {
      list.push({ id: 'trending_now', type: 'trending_now', data: trendingSeeds });
    }
    if (rediscover && rediscover.length > 0) {
      list.push({ id: 'rediscover', type: 'rediscover', data: rediscover });
    }
    if (recentlyLoved && recentlyLoved.length > 0) {
      list.push({ id: 'recently_loved', type: 'recently_loved', data: recentlyLoved });
    }
    if (recentlyPlayedArtists.length > 0) {
      list.push({ id: 'recently_played_artists', type: 'recently_played_artists', data: recentlyPlayedArtists });
    }
    return list;
  }, [
    heroSlides,
    continueListeningTracks,
    recentlyPlayedTracks,
    topSongs,
    dailyMixes,
    rowType,
    hiddenGems,
    forgottenFavorites,
    healthReport,
    madeForYou,
    becauseYouLike,
    topArtists,
    favoriteArtists,
    favoriteAlbums,
    trendingSeeds,
    rediscover,
    recentlyLoved,
    recentlyPlayedArtists
  ]);

  const renderSectionItem = useCallback(({ item }: any) => {
    switch (item.type) {
      case 'welcome':
        return (
          <MaterialEntrance delay={0}>
            <View style={s.welcomeSection}>
              <Text style={s.welcomeTitle}>{greetingData.title}</Text>
              <Text style={s.welcomeSubtitle}>{greetingData.sub}</Text>
            </View>
          </MaterialEntrance>
        );
      case 'hero':
        return (
          <MaterialEntrance delay={100}>
            <SwipeableHeroCard albums={item.data} onPlay={handlePlayPress} onPressCard={(id: string) => goPlaylist(id)} />
          </MaterialEntrance>
        );
      case 'onboarding':
        return (
          <MaterialEntrance delay={100}>
            <View style={s.onboardingCard}>
              <PremiumGlass r={32} blur={60} gloss gradient style={s.onboardingGlass}>
                <Ionicons name="sparkles" size={42} color={C.primary} style={{ marginBottom: 12, alignSelf: 'center' }} />
                <Text style={s.onboardingTitle}>Start listening to build your soundtrack</Text>
                <Text style={s.onboardingSub}>Your personal Daily Soundtrack, Trending mixes, and Taste snapshots will appear here as you play more music.</Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/search');
                  }}
                  activeOpacity={0.85}
                  style={s.onboardingCTA}
                >
                  <LinearGradient
                    colors={[C.primary, C.primaryMid]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={s.onboardingCTAText}>Discover Music</Text>
                </TouchableOpacity>
              </PremiumGlass>
            </View>
          </MaterialEntrance>
        );
      case 'continue_listening':
        return (
          <MaterialEntrance delay={200}>
            <SectionHeader title="Continue Listening" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: track }: any) => (
                <ContinueListeningCard track={track} onPress={() => handlePlayCLTrack(track)} />
              )}
              keyExtractor={(track: any) => track.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'recently_played':
        return (
          <MaterialEntrance delay={250}>
            <SectionHeader title="Recently Played" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: track }: any) => (
                <RecentlyPlayedCard track={track} onPress={() => handlePlayRPTrack(track)} />
              )}
              keyExtractor={(track: any) => track.playedAt ? track.playedAt.toString() : track.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'top_songs':
        return (
          <MaterialEntrance delay={260}>
            <SectionHeader title="Your Top Songs" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: song }: any) => (
                <SeedTrackCard seed={song} onPress={() => handlePlaySeed(song)} />
              )}
              keyExtractor={(song: any, idx: number) => `${song.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'daily_mixes':
        return (
          <MaterialEntrance delay={310}>
            <SectionHeader title="Daily Mixes" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: mix }: any) => (
                <DailyMixCard seed={mix} onPress={() => goPlaylist(mix.id)} />
              )}
              keyExtractor={(mix: any, idx: number) => `${mix.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'row_type':
        return (
          <MaterialEntrance delay={315}>
            <SectionHeader title={item.rowType === 'gems' ? "Hidden Gems" : "Forgotten Favorites"} />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: song }: any) => (
                <SeedTrackCard seed={song} onPress={() => handlePlaySeed(song)} />
              )}
              keyExtractor={(song: any, idx: number) => `${song.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'cleanup':
        return (
          <MaterialEntrance delay={305}>
            <View style={s.cleanupContainer}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/library-health');
                }}
                activeOpacity={0.9}
              >
                <PremiumGlass r={28} blur={50} gloss gradient style={s.cleanupGlass}>
                  <View style={s.cleanupContent}>
                    <View style={s.cleanupTextSection}>
                      <Text style={s.cleanupTag}>LIBRARY CLEANUP</Text>
                      <Text style={s.cleanupTitle}>
                        Recover {formatBytes(item.data.storageWasteBytes)}
                      </Text>
                      <Text style={s.cleanupSub}>
                        {duplicateGroups.length} duplicate songs detected
                      </Text>
                    </View>
                    <View style={s.cleanupScoreContainer}>
                      <View style={s.scoreCircle}>
                        <Text style={s.scoreText}>{item.data.healthScore}</Text>
                      </View>
                    </View>
                  </View>
                </PremiumGlass>
              </TouchableOpacity>
            </View>
          </MaterialEntrance>
        );
      case 'made_for_you':
        return (
          <MaterialEntrance delay={300}>
            <View style={s.madeForYouSection}>
              <SectionHeader title="Made For You" />
              {item.data.map((seed: any, idx: number) => (
                <BentoCard
                  key={`${seed.id}-${idx}`}
                  image={seed.image}
                  tag={seed.type === 'playlist' ? 'PERSONALIZED' : 'RECOMMENDED'}
                  title={seed.title}
                  subtitle={seed.reason || 'Personalized mix based on your taste profile.'}
                  onPress={() => goPlaylist(seed.id)}
                />
              ))}
            </View>
          </MaterialEntrance>
        );
      case 'because_you_like':
        return (
          <MaterialEntrance delay={320}>
            <SectionHeader title="Because You Like" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: seed }: any) => (
                <BecauseYouLikeCard seed={seed} onPress={() => goPlaylist(seed.id)} />
              )}
              keyExtractor={(seed: any, idx: number) => `${seed.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'top_artists':
        return (
          <MaterialEntrance delay={270}>
            <SectionHeader title="Top Artists This Month" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: artist }: any) => (
                <CircleArtistCard
                  name={artist.title}
                  image={artist.image}
                  score={artist.score}
                  onPress={() => handleArtistClick({ name: artist.title, id: artist.id })}
                />
              )}
              keyExtractor={(artist: any, idx: number) => `${artist.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.artistScrollContent}
            />
          </MaterialEntrance>
        );
      case 'favorite_artists':
        return (
          <MaterialEntrance delay={275}>
            <SectionHeader title="Favorite Artists" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: artist }: any) => (
                <CircleArtistCard
                  name={artist.name}
                  image={artist.image}
                  score={artist.score}
                  onPress={() => handleArtistClick(artist)}
                />
              )}
              keyExtractor={(artist: any) => artist.name}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.artistScrollContent}
            />
          </MaterialEntrance>
        );
      case 'favorite_albums':
        return (
          <MaterialEntrance delay={290}>
            <SectionHeader title="Favorite Albums" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: album }: any) => (
                <FavoriteAlbumCard
                  album={album}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    goAlbum(album.id);
                  }}
                />
              )}
              keyExtractor={(album: any, idx: number) => `${album.id || album.title}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'trending_now':
        return (
          <MaterialEntrance delay={500}>
            <SectionHeader title="Trending Now" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: seed }: any) => (
                <View style={{ width: 280, marginRight: 20 }}>
                  <BentoCard
                    image={seed.image}
                    tag={seed.source === 'india' ? 'TRENDING IN INDIA' : 'GLOBAL HITS'}
                    title={seed.title}
                    subtitle={`Hydrated live from charts. Updated today.`}
                    onPress={() => goPlaylist(seed.id)}
                  />
                </View>
              )}
              keyExtractor={(seed: any) => seed.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'rediscover':
        return (
          <MaterialEntrance delay={330}>
            <SectionHeader title="Rediscover" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: song }: any) => (
                <SeedTrackCard seed={song} onPress={() => handlePlaySeed(song)} />
              )}
              keyExtractor={(song: any, idx: number) => `${song.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'recently_loved':
        return (
          <MaterialEntrance delay={340}>
            <SectionHeader title="Recently Loved" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: song }: any) => (
                <SeedTrackCard seed={song} onPress={() => handlePlaySeed(song)} />
              )}
              keyExtractor={(song: any, idx: number) => `${song.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hzScrollContent}
            />
          </MaterialEntrance>
        );
      case 'recently_played_artists':
        return (
          <MaterialEntrance delay={400}>
            <SectionHeader title="Recently Played Artists" />
            <FlashList
              horizontal
              data={item.data}
              renderItem={({ item: artist }: any) => (
                <CircleArtistCard
                  name={artist.name}
                  image={artist.image}
                  onPress={() => handleArtistClick(artist)}
                />
              )}
              keyExtractor={(artist: any, idx: number) => `${artist.name}-${idx}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.artistScrollContent}
            />
          </MaterialEntrance>
        );
      default:
        return null;
    }
  }, [
    greetingData,
    duplicateGroups.length,
    handlePlayCLTrack,
    handlePlayRPTrack,
    handlePlaySeed,
    goPlaylist,
    goAlbum,
    handleArtistClick,
    handlePlayPress,
    router
  ]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Animated Gradient Background */}
      <AnimatedGradientBackground />

      <FlashList
        ref={scrollRef}
        data={sections}
        renderItem={renderSectionItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 10, paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {},
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },

  // Welcome Section
  welcomeSection: {
    paddingHorizontal: PAD,
    marginBottom: 32,
    marginTop: 8,
  },
  welcomeTitle: {
    color: C.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    color: C.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.85,
  },

  // Hero Card
  heroCard: {
    height: 360,
    marginHorizontal: PAD,
    borderRadius: 36,
    overflow: 'hidden',
    marginBottom: 44,
    backgroundColor: C.surface,
  },
  heroSlide: {
    height: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 154,
    paddingHorizontal: 28,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroInfo: {
    flex: 1,
  },
  heroTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  heroControls: {
    alignItems: 'center',
    gap: 16,
  },
  pagination: {
    flexDirection: 'row',
    gap: 7,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  paginationDotActive: {
    backgroundColor: C.text,
    width: 24,
  },
  heroPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowRadius: 16,
    shadowOpacity: 0.6,
    elevation: 12,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: PAD,
    marginBottom: 18,
    marginTop: 12,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  seeAllText: {
    color: C.accent,
    fontWeight: '700',
    fontSize: 14,
  },

  // Horizontal Scroll
  hzScroll: {
    marginBottom: 8,
  },
  hzScrollContent: {
    paddingHorizontal: PAD,
  },

  // Track Card
  trackCardContainer: {
    marginBottom: 12,
  },
  trackCardContainerCompact: {
    width: 160,
    marginRight: 16,
  },
  trackCardContainerExpanded: {
    width: '100%',
  },
  trackCardGlass: {
    padding: 12,
  },
  trackCardGlassCompact: {
    minHeight: 180,
    justifyContent: 'space-between',
  },
  trackCardGlassExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  trackCardImageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  trackCardImageContainerCompact: {
    width: '100%',
    aspectRatio: 1,
  },
  trackCardImageContainerExpanded: {
    width: 64,
    height: 64,
  },
  trackCardImage: {
    width: '100%',
    height: '100%',
  },
  trackCardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  trackCardContent: {
    flex: 1,
    minWidth: 0,
  },
  trackCardContentExpanded: {
    justifyContent: 'center',
  },
  trackCardTitle: {
    color: C.text,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  trackCardTitleCompact: {
    marginTop: 10,
    marginBottom: 4,
  },
  trackCardTitleExpanded: {
    fontSize: 16,
    marginBottom: 2,
  },
  trackCardArtist: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
  },
  trackCardArtistExpanded: {
    fontSize: 14,
  },
  trackCardActionsCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 2,
  },
  trackCardActionsExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },

  // Expanded List
  expandedListContainer: {
    paddingHorizontal: PAD,
    gap: 12,
    marginTop: 12,
  },

  // Bento Card
  madeForYouSection: {
    paddingHorizontal: PAD,
    marginBottom: 44,
    gap: 20,
  },
  bentoCard: {
    width: '100%',
    height: 260,
  },
  bentoCardGlass: {
    flex: 1,
  },
  bentoCardImageContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    overflow: 'hidden',
  },
  bentoCardImage: {
    width: '100%',
    height: '100%',
  },
  bentoCardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
  },
  bentoCardTag: {
    backgroundColor: 'rgba(70, 245, 224, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(70, 245, 224, 0.3)',
  },
  bentoCardTagText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bentoCardTitle: {
    color: C.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 6,
  },
  bentoCardSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },

  // Circle Artist
  circleArtistContainer: {
    marginRight: 20,
    alignItems: 'center',
  },
  circleArtistGlass: {
    width: 128,
    height: 128,
    borderRadius: 64,
    marginBottom: 12,
    overflow: 'hidden',
  },
  circleArtistImage: {
    width: '100%',
    height: '100%',
    borderRadius: 64,
  },
  circleArtistName: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    width: 128,
    textAlign: 'center',
  },
  circleArtistScore: {
    color: 'rgba(255, 255, 255, 0.48)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    width: 128,
    textAlign: 'center',
  },

  // Artist Scroll
  artistScroll: {
    marginBottom: 44,
  },
  artistScrollContent: {
    paddingHorizontal: PAD,
  },

  // Continue Listening Cards (page.html Redesign)
  clCardContainer: {
    width: 160,
    marginRight: 16,
    marginBottom: 8,
  },
  clCardGlass: {
    width: 160,
    height: 160,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  clCardImageContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  clCardImage: {
    width: '100%',
    height: '100%',
  },
  clProgressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  clProgressBarActive: {
    height: '100%',
    backgroundColor: C.primary,
    // iOS shadow for glow
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  clCardTitle: {
    color: C.text,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  clCardArtist: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.65,
  },
  clProgressInfo: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clProgressText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.5,
  },
  clNowPlayingText: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  clPausedText: {
    color: C.amber,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  clTimeText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.45,
  },
  rpCardContainer: {
    width: 120,
    marginRight: 14,
    marginBottom: 8,
  },
  rpCardGlass: {
    width: 120,
    height: 120,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rpCardImageContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 16,
  },
  rpCardImage: {
    width: '100%',
    height: '100%',
  },
  rpActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rpCardTitle: {
    color: C.text,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: -0.15,
    marginBottom: 2,
  },
  rpCardArtist: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },
  favAlbumContainer: {
    width: 180,
    marginRight: 20,
    marginBottom: 12,
  },
  favAlbumGlass: {
    width: 180,
    height: 180,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  favAlbumImageContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 22,
  },
  favAlbumImage: {
    width: '100%',
    height: '100%',
  },
  favAlbumTitle: {
    color: C.text,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: -0.2,
    marginTop: 4,
    marginBottom: 2,
  },
  favAlbumArtist: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
  },

  // Daily Mix Cards
  dmCardContainer: {
    width: 180,
    marginRight: 20,
    marginBottom: 12,
  },
  dmCardGlass: {
    width: 180,
    height: 180,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dmCardImageContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 20,
    position: 'relative',
  },
  dmCardImage: {
    width: '100%',
    height: '100%',
  },
  dmBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dmBadgeText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dmCardTitle: {
    color: C.text,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: -0.2,
    marginTop: 4,
    marginBottom: 2,
  },
  dmCardSubtitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
  },

  // Because You Like Cards
  bylCardContainer: {
    width: 220,
    marginRight: 20,
    marginBottom: 12,
  },
  bylCardGlass: {
    width: 220,
    height: 140,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bylCardImage: {
    width: '100%',
    height: '100%',
  },
  bylCardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  bylCardLabel: {
    color: C.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bylCardArtist: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // Seed Track Cards (Rediscover / Recently Loved)
  stCardContainer: {
    width: 140,
    marginRight: 16,
    marginBottom: 12,
  },
  stCardGlass: {
    width: 140,
    height: 140,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stCardImageContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 16,
  },
  stCardImage: {
    width: '100%',
    height: '100%',
  },
  stCardTitle: {
    color: C.text,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: -0.15,
    marginTop: 4,
    marginBottom: 2,
  },
  stCardArtist: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },

  // Hydration Loader Overlay
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  loaderText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  onboardingCard: {
    height: 360,
    marginHorizontal: PAD,
    borderRadius: 36,
    overflow: 'hidden',
    marginBottom: 44,
  },
  onboardingGlass: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  onboardingTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  onboardingSub: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.7,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  onboardingCTA: {
    height: 52,
    paddingHorizontal: 36,
    borderRadius: 26,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  onboardingCTAText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.1,
  },

  // Library Cleanup Card Styles
  cleanupContainer: {
    marginHorizontal: PAD,
    marginBottom: 28,
    marginTop: 12,
  },
  cleanupGlass: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cleanupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
  },
  cleanupTextSection: {
    flex: 1,
    paddingRight: 16,
  },
  cleanupTag: {
    color: C.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  cleanupTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  cleanupSub: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.6,
  },
  cleanupScoreContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'rgba(191,90,242,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(191,90,242,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    color: C.primary,
    fontSize: 20,
    fontWeight: '800',
  },
});
