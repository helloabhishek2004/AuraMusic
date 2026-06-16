import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
  memo
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  Animated,
  InteractionManager,
  Share,
  Modal
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
  FadeInDown,
  SlideInDown,
  SlideOutDown,
  FadeIn,
} from 'react-native-reanimated';

import { palette as P } from '@/src/design/tokens';
import { useMusic, useNowPlayingTrack } from '@/src/context/MusicContext';
import { usePlayerStore } from '@/src/features/player/store/player.store';
import { useAnalyticsStore, getContinueListeningCandidates, getRecentlyPlayedCandidates } from '@/src/features/analytics/store/analytics.store';
import { useRecommendationsStore } from '@/src/features/recommendations/store/recommendations.store';
import { useLibraryHealthStore } from '@/src/features/library-health/store/library-health.store';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import { DownloadManager } from '@/src/features/download/services/download.manager';
import { useLikesStore } from '@/src/features/likes/store/likes.store';
import { useMusicNavigation } from '@/src/navigation/music-navigation';
import { usePlaybackInsets } from '@/src/hooks/use-playback-insets';
import { useScrollToTopOnTabPress } from '@/src/hooks/use-scroll-to-top';
import { LiquidGlass } from '@/src/components/ui/liquid-glass';
import { PressScale } from '@/src/components/ui/press-scale';
import { DownloadButton } from '@/src/components/ui/download-button';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import { getCanonicalTrackId, getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { resolveArtwork, getDeterministicGradient } from '@/src/features/player/utils/artwork-resolver';

import { MotionTiming, MotionSpring, MotionEasing } from '@/src/design/motion';
import { ScrollPhysics } from '@/src/design/scroll-physics';

import { PlayerTrack } from '@/src/features/player/types/player';

const { width: SW } = Dimensions.get('window');
const PAD = 20;

// ── MATERIAL ENTRANCE ANIMATION (Native Reanimated Version) ───────────────
const MaterialEntrance = ({ children, delay = 0, style }: any) => {
  return (
    <AnimatedReanimated.View 
      entering={FadeInDown.delay(delay).duration(MotionTiming.ENTRANCE)} 
      style={style}
    >
      {children}
    </AnimatedReanimated.View>
  );
};

// ── INTERACTIVE HEART BUTTON ───────────────────────────────────────────────
const HeartButton = ({ liked = false, onPress, size = 24 }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.5, useNativeDriver: true, friction: 3, tension: 40 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 40 }),
    ]).start();

    if (!liked) {
      Animated.timing(rotation, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
        rotation.setValue(0);
      });
    }
    
    onPress?.();
  }, [liked, onPress, scale, rotation]);

  const rotationValue = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Animated.View style={{ transform: [{ scale }, { rotate: rotationValue }] }}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={size}
          color={liked ? P.primary : "rgba(255,255,255,0.45)"}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatMs = (ms: number) => {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// ── HORIZONTAL TRACK CARD ──────────────────────────────────────────
const TrackCard = React.memo(({ track, onPress, onArtistPress, variant = 'compact', style }: any) => {
  const isLiked = useLikesStore((s) => !!(track.id && s.likedTrackIds[track.id]));
  const toggleLike = useLikesStore((s) => s.toggleLike);
  const isCompact = variant === 'compact';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.trackCardContainer, isCompact ? s.trackCardContainerCompact : s.trackCardContainerExpanded, style]}
    >
      <LiquidGlass borderRadius={20} intensity={40} gradient style={[s.trackCardGlass, isCompact ? s.trackCardGlassCompact : s.trackCardGlassExpanded]}>
        <View style={[s.trackCardImageContainer, isCompact ? s.trackCardImageContainerCompact : s.trackCardImageContainerExpanded]}>
          <AuraArtwork 
            source={resolveArtwork(track, 'card')} 
            entityName={track.title}
            entityType="song"
            style={s.trackCardImage} 
            contentFit="cover" 
            transition={200}
            cachePolicy="memory-disk"
          />
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
                track={{
                  id: track.id,
                  title: track.title,
                  artist: track.artist,
                  art: track.image,
                  url: track.url || "",
                  duration: 0
                }}
                size={22}
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
                  color={isLiked ? P.primary : "rgba(255,255,255,0.4)"}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {isCompact && (
          <View style={s.trackCardActionsCompact}>
            <DownloadButton
              track={{
                id: track.id,
                title: track.title,
                artist: track.artist,
                art: track.image,
                url: track.url || "",
                duration: 0
              }}
              size={20}
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
                color={isLiked ? P.primary : "rgba(255,255,255,0.4)"}
              />
            </TouchableOpacity>
          </View>
        )}
      </LiquidGlass>
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
      <LiquidGlass borderRadius={28} intensity={60} gradient style={s.bentoCardGlass}>
        <View style={s.bentoCardImageContainer}>
          <AuraArtwork 
            source={resolveArtwork({ art: image, title }, 'album')} 
            entityName={title}
            entityType="playlist"
            style={[s.bentoCardImage, { borderRadius: 28 }]} 
            contentFit="cover" 
            transition={MotionTiming.MEDIUM} 
            cachePolicy="memory-disk"
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
      </LiquidGlass>
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

// ── CONTINUE LISTENING CARD ───────────────────
const ContinueListeningCard = React.memo(({ track, onPress }: any) => {
  const candidateCanonical = getCanonicalTrackId({ id: track.id, title: track.title, artist: track.artist });
  const isPlaying = usePlayerStore(s => s.isPlaying && s.currentTrack && getCanonicalTrackId(s.currentTrack) === candidateCanonical);
  const isPaused = usePlayerStore(s => !s.isPlaying && s.currentTrack && getCanonicalTrackId(s.currentTrack) === candidateCanonical);
  
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.97}
      haptic={Haptics.ImpactFeedbackStyle.Light}
      wrapperStyle={s.clCardContainer}
    >
      <LiquidGlass borderRadius={20} intensity={40} gradient style={s.clCardGlass}>
        <View style={s.clCardInner}>
          <View style={s.clCardImageContainer}>
            <AuraArtwork 
              source={resolveArtwork(track, 'album')} 
              entityName={track.title}
              entityType="song"
              style={s.clCardImage} 
              contentFit="cover" 
              transition={200} 
              cachePolicy="memory-disk" 
            />
          </View>
          
          <View style={s.clCardMetadata}>
            <Text style={s.clCardTitle} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={s.clCardArtist} numberOfLines={1}>
              {track.artist}
            </Text>
          </View>
          
          <View style={s.clProgressSection}>
            <View style={s.clProgressBarContainer}>
              <View style={[s.clProgressBarActive, { width: `${(track.completionRatio || 0) * 100}%` }]} />
            </View>
            <View style={s.clProgressInfo}>
              <Text style={s.clProgressText}>
                {formatMs(track.positionMs)} / {formatMs(track.durationMs)}
              </Text>
              <Text style={s.clTimeText}>
                {isPlaying ? 'Playing' : isPaused ? 'Paused' : formatRelativeTime(track.playedAt || Date.now())}
              </Text>
            </View>
          </View>
        </View>
      </LiquidGlass>
    </PressScale>
  );
});

// ── RECENTLY PLAYED CARD ─────────────────────────
const RecentlyPlayedCard = React.memo(({ track, onPress }: any) => {
  const candidateCanonical = getCanonicalTrackId({ id: track.id, title: track.title, artist: track.artist });
  const isPlaying = usePlayerStore(s => s.isPlaying && s.currentTrack && getCanonicalTrackId(s.currentTrack) === candidateCanonical);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.rpCardContainer}
    >
      <LiquidGlass borderRadius={16} intensity={30} gradient style={s.rpCardGlass}>
        <View style={s.rpCardImageContainer}>
          <AuraArtwork 
            source={resolveArtwork(track, 'card')} 
            entityName={track.title}
            entityType="song"
            style={s.rpCardImage} 
            contentFit="cover" 
            transition={200} 
            cachePolicy="memory-disk" 
          />
          {isPlaying && (
            <View style={s.rpActiveOverlay}>
              <Ionicons name="volume-high" size={24} color={P.primary} />
            </View>
          )}
        </View>
      </LiquidGlass>
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
const CircleArtistCard = memo(({ name, image, score, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.circleArtistContainer}
    >
      <LiquidGlass borderRadius={64} intensity={60} gradient style={s.circleArtistGlass}>
        <AuraArtwork 
          source={resolveArtwork({ art: image, artist: name, type: 'artist' }, 'card')} 
          entityName={name}
          entityType="artist"
          style={s.circleArtistImage} 
          contentFit="cover"
          cachePolicy="memory-disk"
          borderRadius={60}
        />
      </LiquidGlass>
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
});

// ── FAVORITE ALBUM CARD ───────────────────────────────────────────────────
const FavoriteAlbumCard = React.memo(({ album, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.favAlbumContainer}
    >
      <LiquidGlass borderRadius={22} intensity={45} gradient style={s.favAlbumGlass}>
        <View style={s.favAlbumImageContainer}>
          <AuraArtwork 
            source={resolveArtwork(album, 'card')} 
            entityName={album.title}
            entityType="album"
            style={s.favAlbumImage} 
            contentFit="cover" 
            transition={200} 
            cachePolicy="memory-disk"
          />
        </View>
      </LiquidGlass>
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
      <LiquidGlass borderRadius={20} intensity={35} gradient style={s.dmCardGlass}>
        <View style={s.dmCardImageContainer}>
          <AuraArtwork 
            source={resolveArtwork(seed, 'card')} 
            entityName={seed.title}
            entityType="playlist"
            style={s.dmCardImage} 
            contentFit="cover" 
            transition={200} 
            cachePolicy="memory-disk"
          />
          <View style={s.dmBadge}>
            <Ionicons name="sparkles" size={10} color={P.primary} />
            <Text style={s.dmBadgeText}>MIX</Text>
          </View>
        </View>
      </LiquidGlass>
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
      <LiquidGlass borderRadius={24} intensity={40} gradient style={s.bylCardGlass}>
        <AuraArtwork 
          source={resolveArtwork(seed, 'album')} 
          entityName={seed.title}
          entityType="album"
          style={s.bylCardImage} 
          contentFit="cover" 
          transition={200} 
          cachePolicy="memory-disk"
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
      </LiquidGlass>
    </TouchableOpacity>
  );
});

// ── SEED TRACK CARD ────────────────────────────────────
const SeedTrackCard = React.memo(({ seed, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.stCardContainer}
    >
      <LiquidGlass borderRadius={16} intensity={30} gradient style={s.stCardGlass}>
        <View style={s.stCardImageContainer}>
          <AuraArtwork 
            source={resolveArtwork(seed, 'card')} 
            entityName={seed.title}
            entityType="song"
            style={s.stCardImage} 
            contentFit="cover" 
            transition={200} 
            cachePolicy="memory-disk"
          />
        </View>
      </LiquidGlass>
      <Text style={s.stCardTitle} numberOfLines={1}>
        {seed.title}
      </Text>
      <Text style={s.stCardArtist} numberOfLines={1}>
        {seed.artistName || seed.artist || 'Unknown Artist'}
      </Text>
    </TouchableOpacity>
  );
});

// ── SECTION HEADER ─────────────────────────────────────────────────────────
const SectionHeader = memo(({ title, subtitle, onSeeAll }: any) => (
  <View style={s.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
    </View>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
        <Text style={s.seeAllText}>See all</Text>
      </TouchableOpacity>
    )}
  </View>
));

import { requestIdleTask } from '@/src/utils/idle-task';

// ── PUSH-BASED SECTION COMPONENTS ──────────────────────────────────────────

// ── LAZY FLASH LIST (Staggered Mounting) ──────────────────────────────────
const LazyFlashList = memo(({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Stagger initialization to avoid JS-thread mount collisions
    const timer = setTimeout(() => {
      requestIdleTask(() => {
        setShouldRender(true);
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!shouldRender) {
    return (
      <View style={{ height: 180, justifyContent: 'center' }}>
        <ActivityIndicator color={P.primary} size="small" />
      </View>
    );
  }

  return <>{children}</>;
});

const ContinueListeningSection = memo(({ handlePlay }: any) => {
  const tracks = useAnalyticsStore(getContinueListeningCandidates);
  const continueListeningTracks = useMemo(() => {
      // Soften filtering: allow items without high-quality remote artwork
      // resolveArtwork will handle the visual representation
      return tracks.slice(0, 6);
  }, [tracks]);

  if (continueListeningTracks.length === 0) return null;

  return (
    <View style={s.section}>
      <SectionHeader title="Continue Listening" />
      <LazyFlashList delay={0}>
        <FlashList
          // @ts-ignore
          estimatedItemSize={200}
          horizontal
          data={continueListeningTracks}
          renderItem={({ item: track }: any) => (
            <ContinueListeningCard track={track} onPress={() => handlePlay(track)} />
          )}
          keyExtractor={(track: any) => track.id}
          contentContainerStyle={s.hzScrollContent}
          snapToInterval={216}
          {...ScrollPhysics.SNAPPY}
        />
      </LazyFlashList>
    </View>
  );
});

const RecentlyPlayedSection = memo(({ handlePlay }: any) => {
  const recentlyPlayedTracks = useAnalyticsStore(getRecentlyPlayedCandidates);
  
  if (recentlyPlayedTracks.length === 0) return null;

  return (
    <View style={s.section}>
      <SectionHeader title="Recently Played" />
      <LazyFlashList delay={150}>
        <FlashList
          // @ts-ignore
          estimatedItemSize={140}
          horizontal
          data={recentlyPlayedTracks}
          renderItem={({ item: track }: any) => (
            <RecentlyPlayedCard track={track} onPress={() => handlePlay(track)} />
          )}
          keyExtractor={(track: any) => track.playedAt ? track.playedAt.toString() : track.id}
          contentContainerStyle={s.hzScrollContent}
          {...ScrollPhysics.SNAPPY}
        />
      </LazyFlashList>
    </View>
  );
});

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith('#')) return `rgba(255,255,255,${alpha})`;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const TopTrackCard = React.memo(({ track, index, onPress, onLongPress }: any) => {
  const floatAnim = useSharedValue(0);
  useEffect(() => {
    // Subtle float animation: translateY from 0 to -2
    floatAnim.value = withRepeat(
      withTiming(1, { duration: 3500 }),
      -1,
      true
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: floatAnim.value * -2 }],
    };
  });

  const colors = getDeterministicGradient(track.title || 'Aura');
  const cardBgColor = hexToRgba(colors[0], 0.09); // Capped at 9% opacity tint

  const rank = index + 1;

  // Formulate significance subtext for rank badge
  const isFavorite = useLikesStore(s => !!(track.id && s.likedTrackIds[track.id]));
  const durationHours = track.totalListenMs ? (track.totalListenMs / (1000 * 60 * 60)).toFixed(1) : '0.0';
  
  let significanceText = '🔥 Trending';
  if (isFavorite) {
    significanceText = '⭐ Favorite';
  } else if (track.playCount > 10) {
    significanceText = `${track.playCount} Plays`;
  } else if (parseFloat(durationHours) > 0.5) {
    significanceText = `${durationHours}h`;
  }

  // Build bottom metadata pills (max 2)
  const pills = [];
  if (track.playCount && track.playCount > 0) {
    pills.push(`🎧 ${track.playCount} Plays`);
  }
  if (track.totalListenMs && track.totalListenMs > 60000) {
    const hours = track.totalListenMs / (1000 * 60 * 60);
    if (hours >= 0.1) {
      pills.push(`⏱ ${hours.toFixed(1)}h`);
    } else {
      pills.push(`⏱ ${Math.round(track.totalListenMs / 60000)}m`);
    }
  }
  if (isFavorite && pills.length < 2) {
    pills.push('❤️ Favorite');
  }
  if (rank <= 3 && pills.length < 2) {
    pills.push('🔥 Trending');
  }
  // Cap at 2 pills
  const visiblePills = pills.slice(0, 2);

  return (
    <PressScale
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.98}
      haptic={Haptics.ImpactFeedbackStyle.Medium}
      wrapperStyle={s.topTrackCardContainer}
    >
      <LiquidGlass
        borderRadius={28}
        intensity={55}
        accentColor={colors[0]}
        accentOpacity={0.09}
        gradient
        style={s.topTrackCardGlass}
      >
        <View style={s.topTrackCardInner}>
          {/* Left Section: Artwork */}
          <AnimatedReanimated.View style={[s.topTrackArtworkContainer, { shadowColor: colors[0] }, floatStyle]}>
            <AuraArtwork 
              source={resolveArtwork(track, 'card')} 
              entityName={track.title}
              entityType="song"
              style={s.topTrackArtwork} 
              contentFit="cover" 
              transition={200}
              cachePolicy="memory-disk"
              borderRadius={22}
              fallbackIcon="musical-note-outline"
            />
          </AnimatedReanimated.View>

          {/* Center Section: Track Info */}
          <View style={s.topTrackInfo}>
            <Text style={s.topTrackTitle} numberOfLines={2}>
              {track.title}
            </Text>
            <Text style={s.topTrackArtist} numberOfLines={1}>
              {track.artist}
            </Text>
            {track.album && (
              <Text style={s.topTrackAlbum} numberOfLines={1}>
                {track.album}
              </Text>
            )}
            
            {/* Bottom Metadata Pills */}
            {visiblePills.length > 0 && (
              <View style={s.topTrackPillsRow}>
                {visiblePills.map((pill, pIdx) => (
                  <View key={`pill-${pIdx}`} style={s.topTrackPill}>
                    <Text style={s.topTrackPillText}>{pill}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Right Section: Ranking Badge */}
          <View style={s.topTrackRankBadge}>
            <Text style={s.topTrackRankNumber}>#{rank}</Text>
            <Text style={s.topTrackRankSub}>{significanceText}</Text>
          </View>
        </View>
      </LiquidGlass>
    </PressScale>
  );
});

const TopTracksSection = memo(({ data, handlePlay, handleLongPress }: any) => {
  const columnWidth = SW * 0.85;
  const topTracksLimit = useMemo(() => {
    return (data || []).slice(0, 12);
  }, [data]);

  if (topTracksLimit.length === 0) return null;

  return (
    <View style={s.section}>
      <SectionHeader 
        title="Top Tracks" 
        subtitle="Your most played songs based on listening habits" 
      />
      <LazyFlashList delay={200}>
        <FlashList
          // @ts-ignore
          estimatedItemSize={columnWidth}
          horizontal
          data={topTracksLimit}
          renderItem={({ item: track, index }: any) => (
            <TopTrackCard
              track={track}
              index={index}
              onPress={() => handlePlay(track)}
              onLongPress={() => handleLongPress(track)}
            />
          )}
          keyExtractor={(track: any) => track.id}
          contentContainerStyle={s.hzScrollContent}
          snapToInterval={columnWidth + 16}
          {...ScrollPhysics.SNAPPY}
        />
      </LazyFlashList>
    </View>
  );
});

const TrackActionSheet = memo(({ visible, track, onClose }: { visible: boolean; track: any; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const playNext = usePlayerStore(s => s.playNext);
  const addToQueue = usePlayerStore(s => s.addToQueue);
  const toggleLike = useLikesStore(s => s.toggleLike);
  const isLiked = useLikesStore(s => !!(track?.id && s.likedTrackIds[track.id]));

  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  const activeTasks = useDownloadStore(s => s.activeTasks);
  const addDownload = useDownloadStore(s => s.addDownload);

  if (!visible || !track) return null;

  const isDownloaded = !!downloadedTracks[track.id];
  const task = activeTasks[track.id];
  const isDownloading = task?.status === 'downloading' || task?.status === 'queued';

  const handlePlayNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playNext(track);
    onClose();
  };

  const handleAddToQueue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToQueue(track);
    onClose();
  };

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLike({ ...track, art: track.art });
    onClose();
  };

  const handleDownload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isDownloaded && !isDownloading) {
      addDownload(track);
    } else if (isDownloaded) {
      DownloadManager.removeDownload(track.id);
    }
    onClose();
  };

  const handleGoToAlbum = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    if (track.albumId) {
      router.push(`/album/${track.albumId}`);
    }
  };

  const handleGoToArtist = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    if (track.artistId) {
      router.push(`/artist/${track.artistId}`);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    try {
      await Share.share({
        message: `Check out "${track.title}" by ${track.artist} on AuraMusic!`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={[StyleSheet.absoluteFill, { zIndex: 3000 }]}>
        {/* Backdrop */}
        <AnimatedReanimated.View 
          entering={FadeIn.duration(200)} 
          style={StyleSheet.absoluteFill}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={onClose}
          >
            {Platform.OS === 'ios' && <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          </TouchableOpacity>
        </AnimatedReanimated.View>

        {/* Sheet Content */}
        <AnimatedReanimated.View
          entering={SlideInDown.springify().damping(22).stiffness(200).mass(0.85)}
          exiting={SlideOutDown.springify().damping(22).stiffness(200)}
          style={[
            s.actionSheetContainer,
            { paddingBottom: Math.max(insets.bottom + 16, 24) }
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={68} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 12, 24, 0.96)' }]} />
          )}
          <LinearGradient
            colors={['rgba(14,12,24,0.97)', 'rgba(8,8,14,0.99)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.actionSheetTopLine} />
          
          <View style={s.actionSheetHeader}>
            <AuraArtwork 
              source={resolveArtwork(track, 'card')} 
              entityName={track.title}
              entityType="song"
              style={s.actionSheetArt} 
              contentFit="cover" 
              borderRadius={12}
            />
            <View style={s.actionSheetMeta}>
              <Text style={s.actionSheetTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={s.actionSheetArtist} numberOfLines={1}>{track.artist}</Text>
            </View>
          </View>

          <View style={s.actionSheetDivider} />

          <View style={s.actionSheetGrid}>
            <TouchableOpacity style={s.actionSheetBtn} onPress={handlePlayNext}>
              <View style={s.actionSheetIconCircle}>
                <Ionicons name="play-forward" size={20} color="#FFF" />
              </View>
              <Text style={s.actionSheetBtnText}>Play Next</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionSheetBtn} onPress={handleAddToQueue}>
              <View style={s.actionSheetIconCircle}>
                <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              </View>
              <Text style={s.actionSheetBtnText}>Add to Queue</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[s.actionSheetBtn, !track.albumId && { opacity: 0.4 }]} 
              onPress={handleGoToAlbum}
              disabled={!track.albumId}
            >
              <View style={s.actionSheetIconCircle}>
                <Ionicons name="disc-outline" size={20} color="#FFF" />
              </View>
              <Text style={s.actionSheetBtnText}>Go to Album</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[s.actionSheetBtn, !track.artistId && { opacity: 0.4 }]} 
              onPress={handleGoToArtist}
              disabled={!track.artistId}
            >
              <View style={s.actionSheetIconCircle}>
                <Ionicons name="person-outline" size={20} color="#FFF" />
              </View>
              <Text style={s.actionSheetBtnText}>Go to Artist</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionSheetBtn} onPress={handleLike}>
              <View style={[s.actionSheetIconCircle, isLiked && { backgroundColor: 'rgba(191,90,242,0.15)' }]}>
                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={20} color={isLiked ? P.primary : "#FFF"} />
              </View>
              <Text style={s.actionSheetBtnText}>{isLiked ? 'Liked' : 'Like'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionSheetBtn} onPress={handleDownload} disabled={isDownloading}>
              <View style={[s.actionSheetIconCircle, isDownloaded && { backgroundColor: 'rgba(255,107,128,0.15)' }]}>
                <Ionicons 
                  name={isDownloaded ? "trash-outline" : (isDownloading ? "refresh-outline" : "cloud-download-outline")} 
                  size={20} 
                  color={isDownloaded ? P.coral : "#FFF"} 
                />
              </View>
              <Text style={s.actionSheetBtnText}>
                {isDownloaded ? 'Remove' : (isDownloading ? 'Downloading' : 'Download')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionSheetBtn} onPress={handleShare}>
              <View style={s.actionSheetIconCircle}>
                <Ionicons name="share-outline" size={20} color="#FFF" />
              </View>
              <Text style={s.actionSheetBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.actionSheetCancelBtn} onPress={onClose}>
            <Text style={s.actionSheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </AnimatedReanimated.View>
      </View>
    </Modal>
  );
});

// ── MAIN HOME SCREEN ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const scrollRef = useRef<any>(null);
  useScrollToTopOnTabPress(scrollRef);
  const insets = useSafeAreaInsets();
  const { bottomPadding } = usePlaybackInsets();
  const { router, goAlbum, goPlaylist, goArtist } = useMusicNavigation('home');
  const [longPressTrack, setLongPressTrack] = useState<any>(null);

  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { title: 'Good morning', sub: 'Rise and shine for some morning beats.' };
    if (hour >= 12 && hour < 17) return { title: 'Good afternoon', sub: 'Keep the energy up with some mid-day vibes.' };
    if (hour >= 17 && hour < 21) return { title: 'Good evening', sub: 'Ready for some evening vibes?' };
    return { title: 'Good night', sub: 'Wind down with some midnight melodies.' };
  }, []);

  const { setQueue } = useMusic();
  const setActiveContext = usePlayerStore(s => s.setActiveContext);
  
  // Hydration state
  const isAnalyticsHydrated = useAnalyticsStore(s => s.isHydrated);
  const isRecommendationsHydrated = useRecommendationsStore(s => s.isHydrated);

  // Real data
  const historyCount = useAnalyticsStore(s => s.history?.length || 0);
  const continueListening = useAnalyticsStore(s => s.computed?.continueListening || []);
  const topTracks = useAnalyticsStore(s => s.computed?.topTracks || []);
  const topAlbums = useAnalyticsStore(s => s.computed?.topAlbums || []);
  const topArtists = useAnalyticsStore(s => s.computed?.topArtists || []);
  const recentlyPlayed = useAnalyticsStore(s => s.computed?.recentlyPlayed || []);
  const favoriteArtists = useAnalyticsStore(s => s.userTasteProfile?.favoriteArtists || []);
  const favoriteAlbums = useAnalyticsStore(s => s.userTasteProfile?.favoriteAlbums || []);
  
  const dailyMixes = useRecommendationsStore(s => s.dailyMixes || []);
  const becauseYouLike = useRecommendationsStore(s => s.becauseYouLike || []);
  const trendingSeeds = useRecommendationsStore(s => s.trendingSeeds || []);

  const handlePlayTrack = useCallback((track: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveContext({ type: 'home' as any, id: 'home_generic' });
    setQueue([track]);
  }, [setActiveContext, setQueue]);

  // STABLE SECTIONS DATA - Dynamic "Push" Model
  const sectionsData = useMemo(() => {
    // Show nothing until stores hydrate to prevent layout jumping
    if (!isAnalyticsHydrated || !isRecommendationsHydrated) return [];

    const sections = [];
    sections.push({ id: 'welcome', type: 'welcome' });
    
    // Discover Music (Onboarding for new users)
    if (historyCount <= 20 && trendingSeeds.length > 0) {
        sections.push({ id: 'discover_music', type: 'discover_music', data: trendingSeeds });
    }

    // Hero Fallback Priority: DailyMix -> TopTrack -> ContinueListening
    if (dailyMixes.length > 0) {
      sections.push({ id: 'hero', type: 'hero', heroType: 'mix', data: dailyMixes[0] });
    } else if (topTracks.length > 0) {
      sections.push({ id: 'hero', type: 'hero', heroType: 'track', data: topTracks[0] });
    } else if (continueListening.length > 0) {
      sections.push({ id: 'hero', type: 'hero', heroType: 'track', data: continueListening[0] });
    }

    if (continueListening.length > 0) sections.push({ id: 'continue_listening', type: 'continue_listening' });
    if (dailyMixes.length > 0) sections.push({ id: 'daily_mixes', type: 'daily_mixes', data: dailyMixes });
    if (becauseYouLike.length > 0) sections.push({ id: 'because_you_like', type: 'because_you_like', data: becauseYouLike });
    if (topTracks.length > 0) sections.push({ id: 'top_tracks', type: 'top_tracks', data: topTracks });
    if (favoriteArtists.length > 0) sections.push({ id: 'favorite_artists', type: 'favorite_artists', data: favoriteArtists });
    if (favoriteAlbums.length > 0) sections.push({ id: 'favorite_albums', type: 'favorite_albums', data: favoriteAlbums });
    if (recentlyPlayed.length > 0) sections.push({ id: 'recently_played', type: 'recently_played' });

    sections.push({ id: 'cleanup', type: 'cleanup' });

    return sections;
  }, [isAnalyticsHydrated, isRecommendationsHydrated, historyCount, dailyMixes, topTracks, continueListening, becauseYouLike, favoriteArtists, favoriteAlbums, recentlyPlayed, trendingSeeds]);

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
      case 'discover_music':
        return (
            <View style={s.section}>
                <SectionHeader title="Discover Music" />
                <FlashList
                    // @ts-ignore
                    estimatedItemSize={160}
                    horizontal
                    data={item.data}
                    renderItem={({ item: seed }: any) => (
                        <DailyMixCard seed={seed} onPress={() => goPlaylist(seed.id)} />
                    )}
                    keyExtractor={(seed: any) => seed.id}
                    contentContainerStyle={s.hzScrollContent}
                    {...ScrollPhysics.SNAPPY}
                />
            </View>
        );
      case 'hero':
        return (
            <MaterialEntrance delay={100}>
                <View style={s.heroCard}>
                    <Text style={{ color: '#FFF', paddingHorizontal: PAD, marginBottom: 12, fontSize: 13, fontWeight: '700' }}>
                        {item.heroType === 'mix' ? 'FEATURED MIX' : 'FEATURED TRACK'}
                    </Text>
                    <BentoCard 
                        image={getArtworkUrl(item.data, 'card')}
                        title={item.data.title || item.data.name}
                        subtitle={item.heroType === 'mix' ? "A personalized mix just for you." : (item.data.artist || 'A track you might love.')}
                        onPress={() => item.heroType === 'mix' ? goPlaylist(item.data.id) : handlePlayTrack(item.data)}
                        style={{ marginHorizontal: PAD }}
                    />
                </View>
            </MaterialEntrance>
        );
      case 'cleanup':
        return <LibraryCleanupCard />;
      case 'continue_listening':
        return <ContinueListeningSection handlePlay={handlePlayTrack} />;
      case 'recently_played':
        return <RecentlyPlayedSection handlePlay={handlePlayTrack} />;
      case 'daily_mixes':
        return (
            <View style={s.section}>
                <SectionHeader title="Made For You" />
                <FlashList
                    // @ts-ignore
                    estimatedItemSize={160}
                    horizontal
                    data={item.data}
                    renderItem={({ item: mix }: any) => (
                        <DailyMixCard seed={mix} onPress={() => goPlaylist(mix.id)} />
                    )}
                    keyExtractor={(mix: any) => mix.id}
                    contentContainerStyle={s.hzScrollContent}
                    {...ScrollPhysics.SNAPPY}
                />
            </View>
        );
      case 'because_you_like':
        return (
            <View style={s.section}>
                <SectionHeader title="Because You Like" />
                <FlashList
                    // @ts-ignore
                    estimatedItemSize={300}
                    horizontal
                    data={item.data}
                    renderItem={({ item: seed }: any) => (
                        <BecauseYouLikeCard seed={seed} onPress={() => goPlaylist(seed.id)} />
                    )}
                    keyExtractor={(seed: any) => seed.id}
                    contentContainerStyle={s.hzScrollContent}
                    {...ScrollPhysics.SNAPPY}
                />
            </View>
        );
      case 'top_tracks':
        return <TopTracksSection data={item.data} handlePlay={handlePlayTrack} handleLongPress={setLongPressTrack} />;
      case 'favorite_artists':
        return (
            <View style={s.section}>
                <SectionHeader title="Your Favorite Artists" />
                <FlashList
                    // @ts-ignore
                    estimatedItemSize={120}
                    horizontal
                    data={item.data}
                    renderItem={({ item: artist }: any) => (
                        <CircleArtistCard name={artist.name} image={getArtworkUrl(artist, 'card')} score={artist.score} onPress={() => goArtist(artist.id)} />
                    )}
                    keyExtractor={(artist: any) => artist.id}
                    contentContainerStyle={s.hzScrollContent}
                    {...ScrollPhysics.SNAPPY}
                />
            </View>
        );
      case 'favorite_albums':
        return (
            <View style={s.section}>
                <SectionHeader title="Favorite Albums" />
                <FlashList
                    // @ts-ignore
                    estimatedItemSize={160}
                    horizontal
                    data={item.data}
                    renderItem={({ item: album }: any) => (
                        <FavoriteAlbumCard album={album} onPress={() => goAlbum(album.id)} />
                    )}
                    keyExtractor={(album: any) => album.id}
                    contentContainerStyle={s.hzScrollContent}
                    {...ScrollPhysics.SNAPPY}
                />
            </View>
        );
      default:
        return null;
    }
  }, [greetingData, handlePlayTrack, goPlaylist, goArtist]);

  return (
    <View style={s.container}>
      {sectionsData.length > 0 ? (
        <FlashList
          ref={scrollRef}
          data={sectionsData}
          renderItem={renderSectionItem}
          keyExtractor={(item: any) => item.id}
          // @ts-ignore
          estimatedItemSize={400}
          contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 10, paddingBottom: bottomPadding }]}
          {...ScrollPhysics.STANDARD}
        />
      ) : (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color={P.primary} />
        </View>
      )}
      <TrackActionSheet
        visible={longPressTrack !== null}
        track={longPressTrack}
        onClose={() => setLongPressTrack(null)}
      />
    </View>
  );
}

// ── COMPONENTIZED SECTIONS ──────────────────────────────────────────────────

const LibraryCleanupCard = memo(() => {
    const report = useLibraryHealthStore(s => s.healthReport);
    const router = useRouter();
    if (!report || (report as any).storageWasteBytes < 1024 * 1024 * 50) return null;

    return (
        <View style={s.cleanupContainer}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/library-health');
              }}
              activeOpacity={0.9}
            >
              <LiquidGlass borderRadius={28} intensity={50} gradient style={s.cleanupGlass}>
                <View style={s.cleanupContent}>
                  <View style={s.cleanupTextSection}>
                    <Text style={s.cleanupTag}>LIBRARY CLEANUP</Text>
                    <Text style={s.cleanupTitle}>
                      Recover {formatBytes((report as any).storageWasteBytes)}
                    </Text>
                  </View>
                  <View style={s.cleanupScoreContainer}>
                    <View style={s.scoreCircle}>
                      <Text style={s.scoreText}>{report.healthScore}</Text>
                    </View>
                  </View>
                </View>
              </LiquidGlass>
            </TouchableOpacity>
        </View>
    );
});

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: P.background,
  },
  section: {
    marginBottom: 32,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  welcomeSection: {
    paddingHorizontal: PAD,
    marginBottom: 32,
    marginTop: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: P.ink,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: P.inkMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  heroCard: {
    marginBottom: 32,
  },
  heroPlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: P.ink,
    letterSpacing: -0.4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: P.primary,
  },
  hzScrollContent: {
    paddingHorizontal: PAD,
    paddingBottom: 24,
  },
  clCardContainer: {
    width: 200,
    height: 200,
    marginRight: 16,
  },
  clCardGlass: {
    width: 200,
    height: 200,
  },
  clCardInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  clCardImageContainer: {
    width: '100%',
    height: 106,
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  clCardImage: {
    flex: 1,
  },
  clCardMetadata: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  clCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  clCardArtist: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  clProgressSection: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    marginTop: 'auto',
  },
  clProgressBarContainer: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 6,
    overflow: 'hidden',
  },
  clProgressBarActive: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: P.primary,
  },
  clProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clProgressText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  clNowPlayingText: {
    fontSize: 10,
    fontWeight: '800',
    color: P.primary,
  },
  clPausedText: {
    fontSize: 10,
    fontWeight: '800',
    color: P.amber,
  },
  clTimeText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
  },
  rpCardContainer: {
    width: 140,
    marginRight: 16,
  },
  rpCardGlass: {
    width: 140,
    height: 140,
    marginBottom: 10,
  },
  rpCardImageContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  rpCardImage: {
    flex: 1,
  },
  rpActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  rpCardArtist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  circleArtistContainer: {
    width: 120,
    marginRight: 16,
    alignItems: 'center',
  },
  circleArtistGlass: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  circleArtistImage: {
    flex: 1,
    borderRadius: 60,
  },
  circleArtistName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  circleArtistScore: {
    fontSize: 10,
    fontWeight: '600',
    color: P.primary,
    marginTop: 2,
  },
  favAlbumContainer: {
    width: 140,
    marginRight: 16,
  },
  favAlbumGlass: {
    width: 140,
    height: 140,
    marginBottom: 10,
  },
  favAlbumImageContainer: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  favAlbumImage: {
    flex: 1,
  },
  favAlbumTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  favAlbumArtist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  dmCardContainer: {
    width: 160,
    marginRight: 16,
  },
  dmCardGlass: {
    width: 160,
    height: 160,
    marginBottom: 10,
  },
  dmCardImageContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dmCardImage: {
    flex: 1,
  },
  dmBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dmBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
  },
  dmCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  dmCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  bylCardContainer: {
    width: 240,
    marginRight: 16,
  },
  bylCardGlass: {
    width: 240,
    height: 140,
    overflow: 'hidden',
  },
  bylCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  bylCardContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  bylCardLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: P.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  bylCardArtist: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
  },
  stCardContainer: {
    width: 140,
    marginRight: 16,
  },
  stCardGlass: {
    width: 140,
    height: 140,
    marginBottom: 10,
  },
  stCardImageContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  stCardImage: {
    flex: 1,
  },
  stCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  stCardArtist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  bentoCard: {
    marginBottom: 20,
  },
  bentoCardGlass: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bentoCardImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bentoCardImage: {
    flex: 1,
  },
  bentoCardContent: {
    flex: 1,
  },
  bentoCardTag: {
    backgroundColor: 'rgba(191,90,242,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  bentoCardTagText: {
    color: P.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bentoCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 2,
  },
  bentoCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  cleanupContainer: {
    paddingHorizontal: PAD,
    marginBottom: 32,
  },
  cleanupGlass: {
    padding: 24,
  },
  cleanupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cleanupTextSection: {
    flex: 1,
  },
  cleanupTag: {
    fontSize: 10,
    fontWeight: '900',
    color: P.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  cleanupTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 2,
  },
  cleanupSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  cleanupScoreContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(191,90,242,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '900',
    color: P.primary,
  },
  trackCardContainer: {
    marginHorizontal: PAD,
    marginBottom: 12,
  },
  trackCardContainerCompact: {
    height: 80,
  },
  trackCardContainerExpanded: {
    height: 100,
  },
  trackCardGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  trackCardGlassCompact: {},
  trackCardGlassExpanded: {
    padding: 16,
  },
  trackCardImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
  },
  trackCardImageContainerCompact: {
    width: 56,
    height: 56,
  },
  trackCardImageContainerExpanded: {
    width: 68,
    height: 68,
  },
  trackCardImage: {
    flex: 1,
  },
  trackCardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  trackCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  trackCardContentExpanded: {
    gap: 2,
  },
  trackCardTitle: {
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  trackCardTitleCompact: {
    fontSize: 15,
  },
  trackCardTitleExpanded: {
    fontSize: 17,
  },
  trackCardArtist: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  trackCardArtistExpanded: {
    fontSize: 14,
  },
  trackCardActionsExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  trackCardActionsCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  topTrackCardOverride: {
    marginHorizontal: 0,
    width: '100%',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: P.inkMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  topTrackCardContainer: {
    width: SW * 0.85,
    height: 124,
    marginRight: 16,
  },
  topTrackCardGlass: {
    width: '100%',
    height: '100%',
  },
  topTrackCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  topTrackArtworkContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginRight: 14,
  },
  topTrackArtwork: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  topTrackInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  topTrackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  topTrackArtist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontWeight: '500',
  },
  topTrackAlbum: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
    marginTop: 1,
  },
  topTrackPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  topTrackPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topTrackPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  topTrackRankBadge: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  topTrackRankNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: P.primary,
    letterSpacing: -1,
  },
  topTrackRankSub: {
    fontSize: 10,
    fontWeight: '800',
    color: P.inkDim,
    marginTop: 2,
  },
  actionSheetContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.48,
    shadowRadius: 24,
    elevation: 24,
  },
  actionSheetTopLine: {
    position: 'absolute',
    top: 0,
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 0.5,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  actionSheetArt: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionSheetMeta: {
    marginLeft: 14,
    flex: 1,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  actionSheetArtist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  actionSheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  actionSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    width: '48%',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionSheetIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionSheetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  actionSheetCancelBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  actionSheetCancelText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
});
