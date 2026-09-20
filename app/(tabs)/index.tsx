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
  Modal,
  RefreshControl
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
import { useMusic, useNowPlayingTrack, useMusicActions } from '@/src/context/MusicContext';
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
import { resumeTrackFromHistory } from '@/src/features/player/utils/playback-resume';
import { getArtistIdForName } from '@/src/data/music-catalog';
import { useArtistEnrichment } from '@/src/hooks/use-artist-enrichment';
import { useAlbumEnrichment } from '@/src/hooks/use-album-enrichment';



import { MotionTiming, MotionSpring, MotionEasing } from '@/src/design/motion';
import { ScrollPhysics } from '@/src/design/scroll-physics';

import { PlayerTrack } from '@/src/features/player/types/player';

const EMPTY_ARRAY: any[] = [];
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

// ── IOS FEATURED MIX HERO CARD (APPLE MUSIC STYLE) ────────────────────────
interface IOSFeaturedMixCardProps {
  item: any;
  tag: string;
  title: string;
  subtitle: string;
  image: string;
  onPress: () => void;
  onQuickPlay?: () => void;
  style?: any;
}

const IOSFeaturedMixCard = React.memo(({
  item,
  tag,
  title,
  subtitle,
  image,
  onPress,
  onQuickPlay,
  style
}: IOSFeaturedMixCardProps) => {
  const resolvedArt = useMemo(() => {
    if (item?.tracks && Array.isArray(item.tracks) && item.tracks.length > 0) {
      for (const t of item.tracks) {
        const a = t.art || t.artwork || t.artworkUrl || t.image;
        if (a && typeof a === 'string' && !a.startsWith('aura://') && !a.includes('placeholder')) {
          return getArtworkUrl(a, 'album');
        }
      }
    }
    if (image && typeof image === 'string' && !image.startsWith('aura://') && !image.includes('placeholder')) {
      return getArtworkUrl(image, 'album');
    }
    return resolveArtwork(item || { art: image, title }, 'album');
  }, [item, image, title]);

  return (
    <View style={[s.iosHeroContainer, style]}>
      {/* iOS Editorial Eyebrow & Header */}
      <View style={s.iosHeroHeader}>
        <Text style={s.iosHeroTag}>{tag}</Text>
        <Text style={s.iosHeroTitle} numberOfLines={1}>{title}</Text>
        <Text style={s.iosHeroSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>

      {/* iOS Stage Artwork Card */}
      <PressScale onPress={onPress} scaleTo={0.97} style={s.iosHeroCardTouch}>
        <View style={s.iosHeroCardWrapper}>
          {/* Main Visual Artwork with Squircle Radius & Drop Shadow */}
          <AuraArtwork
            source={resolvedArt}
            entityName={title}
            entityType="playlist"
            style={s.iosHeroArtwork}
            contentFit="cover"
            transition={MotionTiming.MEDIUM}
            cachePolicy="memory-disk"
          />

          {/* Cinematic Vignette Gradient Overlay */}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.0)',
              'rgba(0,0,0,0.15)',
              'rgba(0,0,0,0.85)'
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Bottom Badges Overlay */}
          <View style={s.iosHeroBottomContent}>
            <View style={s.iosHeroBadgesRow}>
              <View style={s.iosHeroGlassPill}>
                <Ionicons name="sparkles" size={11} color={P.primary} />
                <Text style={s.iosHeroGlassPillText}>Personal Mix</Text>
              </View>
              {item.tracks && item.tracks.length > 0 && (
                <View style={s.iosHeroGlassPill}>
                  <Ionicons name="musical-notes" size={11} color="rgba(255,255,255,0.75)" />
                  <Text style={s.iosHeroGlassPillText}>{item.tracks.length} Songs</Text>
                </View>
              )}
            </View>
          </View>

          {/* Floating iOS Quick Play Button */}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (onQuickPlay) {
                onQuickPlay();
              } else {
                onPress();
              }
            }}
            activeOpacity={0.8}
            style={s.iosHeroPlayButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LinearGradient
              colors={['#FFFFFF', '#E6E6E6']}
              style={s.iosHeroPlayGradient}
            >
              <Ionicons name="play" size={20} color="#000" style={{ marginLeft: 2 }} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </PressScale>
    </View>
  );
});

// Legacy Alias
const BentoCard = IOSFeaturedMixCard;

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

// ── CONTINUE LISTENING CARD (4:3 RATIO IOS STYLE) ─────────────────────────
const ContinueListeningCard = React.memo(({ track, onPress }: any) => {
  const candidateCanonical = getCanonicalTrackId({ id: track.id, title: track.title, artist: track.artist });
  
  // Connect to live player store state
  const isCurrentTrack = usePlayerStore(s => !!(s.currentTrack && getCanonicalTrackId(s.currentTrack) === candidateCanonical));
  const isPlaying = usePlayerStore(s => s.isPlaying && isCurrentTrack);
  const isPaused = usePlayerStore(s => !s.isPlaying && isCurrentTrack);
  const livePlayerPosition = usePlayerStore(s => isCurrentTrack ? s.position : null);
  const livePlayerDuration = usePlayerStore(s => isCurrentTrack ? s.duration : null);

  const colors = getDeterministicGradient(track.title || 'Aura');
  const positionMs = (isCurrentTrack && livePlayerPosition !== null) ? livePlayerPosition : (track.positionMs || track.position || 0);
  const durationMs = (isCurrentTrack && livePlayerDuration && livePlayerDuration > 0) ? livePlayerDuration : (track.durationMs || track.duration || 0);
  const completionRatio = durationMs > 0 ? positionMs / durationMs : 0;
  const progressPercent = Math.min(100, Math.max(0, completionRatio * 100));

  const remainingMs = Math.max(0, durationMs - positionMs);
  const remainingText = remainingMs > 0 ? `${formatMs(remainingMs)} left` : `${formatMs(positionMs)}`;

  const handlePlayToggle = (e?: any) => {
    if (e?.stopPropagation) e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isCurrentTrack) {
      if (isPlaying) {
        usePlayerStore.getState().pause();
      } else {
        usePlayerStore.getState().play();
      }
    } else {
      onPress();
    }
  };

  return (
    <PressScale
      onPress={handlePlayToggle}
      scaleTo={0.97}
      haptic={Haptics.ImpactFeedbackStyle.Medium}
      wrapperStyle={s.iosCl43CardContainer}
    >
      <LiquidGlass
        borderRadius={22}
        intensity={45}
        accentColor={colors[0]}
        accentOpacity={0.08}
        gradient
        style={s.iosCl43CardGlass}
      >
        <View style={s.iosCl43CardInner}>
          {/* Top: 4:3 Prominent Artwork Container with Floating Play Overlay */}
          <View style={s.iosCl43ArtworkWrapper}>
            <AuraArtwork 
              source={resolveArtwork(track, 'album')} 
              entityName={track.title}
              entityType="song"
              borderRadius={16}
              style={s.iosCl43Artwork} 
              contentFit="cover" 
              transition={200} 
              cachePolicy="memory-disk" 
              fallbackIcon="musical-note-outline"
            />

            {/* Subtle Gradient for play button legibility */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.45)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Floating Live State or Play Button */}
            <TouchableOpacity
              onPress={handlePlayToggle}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={s.iosCl43PlayBadge}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={14} 
                color="#000" 
                style={!isPlaying ? { marginLeft: 1.5 } : undefined}
              />
            </TouchableOpacity>
          </View>
          
          {/* Middle: Title & Artist Typography */}
          <View style={s.iosCl43Info}>
            <Text style={s.iosCl43Title} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={s.iosCl43Artist} numberOfLines={1}>
              {track.artist}
            </Text>
          </View>

          {/* Bottom: Progress Bar & Time */}
          <View style={s.iosCl43ProgressSection}>
            <View style={s.iosCl43ProgressTrack}>
              <View style={[s.iosCl43ProgressFill, { width: `${progressPercent}%` }]} />
            </View>

            <View style={s.iosCl43TimeRow}>
              <Text style={s.iosCl43RemainingText}>{remainingText}</Text>
              <Text style={[
                s.iosCl43StatusText,
                isPlaying ? s.iosCl43PlayingText : isPaused ? s.iosCl43PausedText : null
              ]}>
                {isPlaying ? 'Playing' : isPaused ? 'Paused' : formatRelativeTime(track.playedAt || track.lastPlayed || Date.now())}
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
            borderRadius={16}
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
const CircleArtistCard = memo(({ artist, name, image, score, onPress }: any) => {
  const artistName = name || (typeof artist === 'string' ? artist : artist?.name) || 'Unknown Artist';
  const artistScore = score ?? (typeof artist === 'object' ? artist?.score : undefined);

  // 1. Multi-tier synchronous resolution
  const synchronousArt = useMemo(() => {
    if (image && typeof image === 'string' && image.length > 0 && !image.includes('placeholder')) {
      return image;
    }
    if (typeof artist === 'object' && (artist?.image || artist?.art || artist?.thumbnail)) {
      const aArt = artist.image || artist.art || artist.thumbnail;
      if (typeof aArt === 'string' && aArt.length > 0 && !aArt.includes('placeholder')) return aArt;
    }
    
    // Check analytics store
    const analytics = useAnalyticsStore.getState();
    const cached = analytics.artistCache?.[artistName] || analytics.artistProfileCache?.[artistName];
    if (cached?.image) return cached.image;

    // Check history tracks
    const histMatch = analytics.history?.find(h => 
      h.artist?.toLowerCase().includes(artistName.toLowerCase()) || 
      artistName.toLowerCase().includes(h.artist?.toLowerCase())
    );
    if (histMatch?.art || histMatch?.artwork) return histMatch.art || histMatch.artwork;

    return null;
  }, [artist, image, artistName]);

  // 2. Live asynchronous YouTube Music enrichment for uncached artists
  const { enrichedArtist } = useArtistEnrichment(!synchronousArt ? artistName : undefined);

  useEffect(() => {
    if (enrichedArtist?.art && enrichedArtist.id) {
      useAnalyticsStore.getState().cacheArtistDetails(artistName, {
        id: enrichedArtist.id,
        image: enrichedArtist.art,
      });
    }
  }, [enrichedArtist, artistName]);

  const finalArtUrl = synchronousArt || enrichedArtist?.art || null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.circleArtistContainer}
    >
      <View style={s.circleArtistAvatarContainer}>
        <AuraArtwork 
          source={finalArtUrl ? { uri: finalArtUrl } : resolveArtwork({ name: artistName, artist: artistName, type: 'artist' }, 'card')} 
          entityName={artistName}
          entityType="artist"
          style={s.circleArtistImage} 
          contentFit="cover"
          cachePolicy="memory-disk"
          borderRadius={60}
          fallbackIcon="person"
        />
      </View>
      <Text style={s.circleArtistName} numberOfLines={1}>
        {artistName}
      </Text>
      {artistScore !== undefined && artistScore > 0 && (
        <Text style={s.circleArtistScore} numberOfLines={1}>
          Affinity: {artistScore.toFixed(1)}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// ── FAVORITE ALBUM CARD ───────────────────────────────────────────────────
const FavoriteAlbumCard = React.memo(({ album, onPress }: any) => {
  const albumTitle = typeof album === 'string' ? album : (album?.title || album?.name || 'Unknown Album');
  const albumArtist = typeof album === 'object' ? (album?.artist || '') : '';

  // 1. Multi-tier synchronous resolution
  const synchronousArt = useMemo(() => {
    if (typeof album === 'object' && (album?.image || album?.art || album?.thumbnail)) {
      const aArt = album.image || album.art || album.thumbnail;
      if (typeof aArt === 'string' && aArt.length > 0 && !aArt.includes('placeholder')) return aArt;
    }

    const cleanTitle = albumTitle.toLowerCase().trim();

    // 1. Check analytics store albumCache
    const analytics = useAnalyticsStore.getState();
    const cached = analytics.albumCache?.[albumTitle];
    if (cached?.image && !cached.image.includes('placeholder')) return cached.image;

    // 2. Find any song in history containing this album to grab its cover art
    const histMatch = analytics.history?.find(h => 
      (h.album && h.album.toLowerCase().trim() === cleanTitle) ||
      (h.trackSnapshot?.album && h.trackSnapshot.album.toLowerCase().trim() === cleanTitle) ||
      (h.title && h.title.toLowerCase().trim() === cleanTitle)
    );
    const histArt = histMatch?.art || histMatch?.artwork || histMatch?.trackSnapshot?.art;
    if (histArt && !histArt.includes('placeholder')) return histArt;

    return null;
  }, [album, albumTitle, albumArtist]);

  // 2. Live asynchronous YouTube Music enrichment for uncached albums
  const { enrichedAlbum } = useAlbumEnrichment(!synchronousArt ? albumTitle : undefined, albumArtist);

  useEffect(() => {
    if (enrichedAlbum?.art && enrichedAlbum.id) {
      useAnalyticsStore.getState().cacheAlbumDetails(albumTitle, {
        id: enrichedAlbum.id,
        image: enrichedAlbum.art,
        artist: enrichedAlbum.artist || albumArtist,
      });
    }
  }, [enrichedAlbum, albumTitle, albumArtist]);

  const finalArtUrl = synchronousArt || enrichedAlbum?.art || null;
  const resolvedArtist = albumArtist || enrichedAlbum?.artist || (typeof album === 'object' && album?.artist) || '';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.favAlbumContainer}
    >
      <View style={s.favAlbumImageContainer}>
        <AuraArtwork 
          source={finalArtUrl ? { uri: finalArtUrl } : resolveArtwork(typeof album === 'object' ? album : { title: albumTitle, artist: resolvedArtist, type: 'album' }, 'card')} 
          entityName={albumTitle}
          entityType="album"
          borderRadius={22}
          style={s.favAlbumImage} 
          contentFit="cover" 
          transition={200} 
          cachePolicy="memory-disk"
          fallbackIcon="disc"
        />
      </View>
      <Text style={s.favAlbumTitle} numberOfLines={1}>
        {albumTitle}
      </Text>
      {resolvedArtist ? (
        <Text style={s.favAlbumArtist} numberOfLines={1}>
          {resolvedArtist}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
});

// ── DAILY MIX CARD ────────────────────────────────────────────────────────
const DailyMixCard = React.memo(({ seed, onPress }: any) => {
  const cardArt = useMemo(() => {
    if (seed?.tracks && Array.isArray(seed.tracks) && seed.tracks.length > 0) {
      for (const t of seed.tracks) {
        const a = t.art || t.artwork || t.artworkUrl || t.image;
        if (a && typeof a === 'string' && !a.startsWith('aura://') && !a.includes('placeholder')) {
          return getArtworkUrl(a, 'card');
        }
      }
    }
    if (seed?.image && typeof seed.image === 'string' && !seed.image.startsWith('aura://') && !seed.image.includes('placeholder')) {
      return getArtworkUrl(seed.image, 'card');
    }
    return resolveArtwork(seed, 'card');
  }, [seed]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.dmCardContainer}
    >
      <LiquidGlass borderRadius={20} intensity={35} gradient style={s.dmCardGlass}>
        <View style={s.dmCardImageContainer}>
          <AuraArtwork 
            source={cardArt} 
            entityName={seed.title}
            entityType="playlist"
            borderRadius={20}
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
        {seed.reason || 'Based on your taste'}
      </Text>
    </TouchableOpacity>
  );
});

// ── BECAUSE YOU LIKE CARD ──────────────────────────────────────────────────
const BecauseYouLikeCard = React.memo(({ seed, onPress }: any) => {
  const cardArt = useMemo(() => {
    if (seed?.tracks && Array.isArray(seed.tracks) && seed.tracks.length > 0) {
      for (const t of seed.tracks) {
        const a = t.art || t.artwork || t.artworkUrl || t.image;
        if (a && typeof a === 'string' && !a.startsWith('aura://') && !a.includes('placeholder')) {
          return getArtworkUrl(a, 'album');
        }
      }
    }
    if (seed?.image && typeof seed.image === 'string' && !seed.image.startsWith('aura://') && !seed.image.includes('placeholder')) {
      return getArtworkUrl(seed.image, 'album');
    }
    return resolveArtwork(seed, 'album');
  }, [seed]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.bylCardContainer}
    >
      <LiquidGlass borderRadius={24} intensity={40} gradient style={s.bylCardGlass}>
        <AuraArtwork 
          source={cardArt} 
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
const SectionHeader = memo(({ title, subtitle, onSeeAll, rightAction }: any) => (
  <View style={s.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
    </View>
    {rightAction}
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
        <Text style={s.seeAllText}>See all</Text>
      </TouchableOpacity>
    )}
  </View>
));

import { requestIdleTask } from '@/src/utils/idle-task';

// ── PUSH-BASED SECTION COMPONENTS ──────────────────────────────────────────

// ── LAZY FLASH LIST (Direct Mounting) ──────────────────────────────────
const LazyFlashList = memo(({ children }: { children: React.ReactNode, delay?: number }) => {
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
          estimatedItemSize={180}
          horizontal
          data={continueListeningTracks}
          renderItem={({ item: track }: any) => (
            <ContinueListeningCard track={track} onPress={() => handlePlay(track)} />
          )}
          keyExtractor={(track: any) => track.id}
          contentContainerStyle={s.hzScrollContent}
          snapToInterval={194}
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
  const toggleLike = useLikesStore(s => s.toggleLike);
  const isFavorite = useLikesStore(s => !!(track.id && s.likedTrackIds[track.id]));

  const candidateCanonical = getCanonicalTrackId({ id: track.id, title: track.title, artist: track.artist });
  const isCurrentTrack = usePlayerStore(s => !!(s.currentTrack && getCanonicalTrackId(s.currentTrack) === candidateCanonical));
  const isPlaying = usePlayerStore(s => s.isPlaying && isCurrentTrack);

  const colors = getDeterministicGradient(track.title || 'Aura');
  const rank = index + 1;

  // iOS-style rank accents
  const isGold = rank === 1;
  const isSilver = rank === 2;
  const isBronze = rank === 3;
  const rankBadgeColor = isGold ? '#FFD700' : isSilver ? '#E0E0E0' : isBronze ? '#CD7F32' : 'rgba(255,255,255,0.45)';
  const rankBadgeBg = isGold ? 'rgba(255, 215, 0, 0.15)' : isSilver ? 'rgba(224, 224, 224, 0.12)' : isBronze ? 'rgba(205, 127, 50, 0.12)' : 'rgba(255,255,255,0.06)';

  // Formulate significance pill
  const durationHours = track.totalListenMs ? (track.totalListenMs / (1000 * 60 * 60)).toFixed(1) : null;
  const playCount = track.playCount || 0;

  let metricText = '';
  if (isPlaying) {
    metricText = 'Playing now';
  } else if (playCount > 0) {
    metricText = `${playCount} plays`;
  } else if (durationHours && parseFloat(durationHours) > 0.1) {
    metricText = `${durationHours}h listen`;
  } else if (isFavorite) {
    metricText = 'Favorite';
  } else {
    metricText = 'Top Chart';
  }

  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isCurrentTrack) {
      if (isPlaying) {
        usePlayerStore.getState().pause();
      } else {
        usePlayerStore.getState().play();
      }
    } else {
      onPress();
    }
  };

  return (
    <PressScale
      onPress={handleCardPress}
      onLongPress={onLongPress}
      scaleTo={0.97}
      haptic={Haptics.ImpactFeedbackStyle.Medium}
      wrapperStyle={s.iosTopTrackCardContainer}
    >
      <LiquidGlass
        borderRadius={22}
        intensity={45}
        accentColor={colors[0]}
        accentOpacity={0.08}
        gradient
        style={s.iosTopTrackCardGlass}
      >
        <View style={s.iosTopTrackCardInner}>
          {/* Left: Artwork Stage with iOS Floating Rank Corner Badge */}
          <View style={s.iosTopTrackArtworkWrapper}>
            <View style={[s.iosTopTrackArtworkContainer, { shadowColor: colors[0] }]}>
              <AuraArtwork 
                source={resolveArtwork(track, 'card')} 
                entityName={track.title}
                entityType="song"
                style={s.iosTopTrackArtwork} 
                contentFit="cover" 
                transition={200}
                cachePolicy="memory-disk"
                borderRadius={16}
                fallbackIcon="musical-note-outline"
              />
            </View>
            {/* iOS Floating Rank Corner Badge */}
            <View style={[s.iosTopTrackRankPill, { backgroundColor: rankBadgeBg, borderColor: hexToRgba(rankBadgeColor, 0.3) }]}>
              <Text style={[s.iosTopTrackRankText, { color: rankBadgeColor }]}>
                {rank}
              </Text>
            </View>
          </View>

          {/* Center: Track Typography & Hierarchy */}
          <View style={s.iosTopTrackInfo}>
            <Text style={s.iosTopTrackTitle} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={s.iosTopTrackArtist} numberOfLines={1}>
              {track.artist}
            </Text>
            
            {/* iOS Micro Metric Badge Row */}
            <View style={s.iosTopTrackMetaRow}>
              <View style={s.iosTopTrackMetricBadge}>
                <Ionicons 
                  name={isGold ? "trophy" : isSilver || isBronze ? "medal" : "flame"} 
                  size={10} 
                  color={rankBadgeColor} 
                />
                <Text style={s.iosTopTrackMetricText}>{metricText}</Text>
              </View>
              {track.album ? (
                <Text style={s.iosTopTrackAlbumText} numberOfLines={1}>
                  • {track.album}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Right: iOS Action Controls */}
          <View style={s.iosTopTrackActions}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleLike({ ...track, art: track.art });
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
              style={s.iosTopTrackHeartBtn}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={19}
                color={isFavorite ? P.primary : "rgba(255,255,255,0.35)"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (onLongPress) onLongPress();
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
              style={s.iosTopTrackMoreBtn}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={16}
                color="rgba(255,255,255,0.45)"
              />
            </TouchableOpacity>
          </View>
        </View>
      </LiquidGlass>
    </PressScale>
  );
});

const TopTracksSection = memo(({ data, handlePlay, handleLongPress }: any) => {
  const columnWidth = SW * 0.82;
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
          snapToInterval={columnWidth + 14}
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

  const { setQueue } = useMusicActions();
  const setActiveContext = usePlayerStore(s => s.setActiveContext);
  
  // Hydration state
  const isAnalyticsHydrated = useAnalyticsStore(s => s.isHydrated);
  const isRecommendationsHydrated = useRecommendationsStore(s => s.isHydrated);

  // Real data
  const historyCount = useAnalyticsStore(s => s.history?.length || 0);
  const continueListening = useAnalyticsStore(s => s.computed?.continueListening ?? EMPTY_ARRAY);
  const topTracks = useAnalyticsStore(s => s.computed?.topTracks ?? EMPTY_ARRAY);
  const topAlbums = useAnalyticsStore(s => s.computed?.topAlbums ?? EMPTY_ARRAY);
  const topArtists = useAnalyticsStore(s => s.computed?.topArtists ?? EMPTY_ARRAY);
  const recentlyPlayed = useAnalyticsStore(s => s.computed?.recentlyPlayed ?? EMPTY_ARRAY);
  const favoriteArtists = useAnalyticsStore(s => s.userTasteProfile?.favoriteArtists ?? EMPTY_ARRAY);
  const favoriteAlbums = useAnalyticsStore(s => s.userTasteProfile?.favoriteAlbums ?? EMPTY_ARRAY);
  
  const featuredHeroMix = useRecommendationsStore(s => s.featuredHeroMix);
  const madeForYou = useRecommendationsStore(s => s.madeForYou ?? EMPTY_ARRAY);
  const dailyMixes = useRecommendationsStore(s => s.dailyMixes ?? EMPTY_ARRAY);
  const becauseYouLike = useRecommendationsStore(s => s.becauseYouLike ?? EMPTY_ARRAY);
  const trendingSeeds = useRecommendationsStore(s => s.trendingSeeds ?? EMPTY_ARRAY);
  const recsReadiness = useRecommendationsStore(s => s.readiness);
  const refreshDiscover = useRecommendationsStore(s => s.refreshDiscover);
  const generateRecommendations = useRecommendationsStore(s => s.generateRecommendations);

  const [refreshing, setRefreshing] = useState(false);
  const [isRotatingDiscover, setIsRotatingDiscover] = useState(false);

  const handleRefreshDiscoverOnly = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRotatingDiscover(true);
    try {
      if (refreshDiscover) {
        await refreshDiscover(true);
      }
    } catch (e) {
      console.warn('[HomeScreen] Rotate discover error:', e);
    } finally {
      setIsRotatingDiscover(false);
    }
  }, [refreshDiscover]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (refreshDiscover) {
        await refreshDiscover(true);
      }
      await generateRecommendations();
    } catch (err) {
      console.warn('[HomeScreen] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshDiscover, generateRecommendations]);

  useEffect(() => {
    console.info('[HomeScreen] Mounted and interactive');
  }, []);

  const handlePlayTrack = useCallback((track: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveContext({ type: 'home' as any, id: 'home_generic' });
    setQueue([track]);
  }, [setActiveContext, setQueue]);

  const handleQuickPlaySeed = useCallback(async (seed: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (seed.tracks && seed.tracks.length > 0) {
      setActiveContext({ type: 'playlist' as any, id: seed.id });
      setQueue(seed.tracks);
    } else {
      const { hydrateRecommendationSeed } = require('@/src/features/recommendations/services/recommendation-hydrator');
      const hydrated = await hydrateRecommendationSeed(seed);
      if (hydrated && hydrated.length > 0) {
        setActiveContext({ type: 'playlist' as any, id: seed.id });
        setQueue(hydrated);
      }
    }
  }, [setActiveContext, setQueue]);

  const handleResumeContinueListening = useCallback((track: any) => {
    resumeTrackFromHistory(
      {
        id: track.id,
        title: track.title,
        artist: track.artist,
        art: track.art || track.artwork,
        positionMs: track.positionMs || track.position || 0,
        durationMs: track.durationMs || track.duration || 0,
        trackSnapshot: track.trackSnapshot,
      },
      () => {},
      'home'
    );
  }, []);

  // STABLE SECTIONS DATA - Dynamic "Push" Model with Authoritative Readiness Gating
  const sectionsData = useMemo(() => {
    const sections = [];
    sections.push({ id: 'welcome', type: 'welcome' });
    
    // Check authoritative data readiness
    const isDataReady = recsReadiness?.isReady || (madeForYou.length > 0 && dailyMixes.length > 0);

    // 1. Featured Mix / Hero (Contextual & Behavior-Driven)
    const effectiveHeroMix = isDataReady ? (featuredHeroMix || (madeForYou.length > 0 ? madeForYou[0] : (dailyMixes.length > 0 ? dailyMixes[0] : null))) : null;
    if (effectiveHeroMix) {
      sections.push({ id: 'hero', type: 'hero', heroType: 'mix', data: effectiveHeroMix });
    } else if (topTracks.length > 0) {
      sections.push({ id: 'hero', type: 'hero', heroType: 'track', data: topTracks[0] });
    } else if (continueListening.length > 0) {
      sections.push({ id: 'hero', type: 'hero', heroType: 'track', data: continueListening[0] });
    } else if (trendingSeeds.length > 0) {
      sections.push({ id: 'hero', type: 'hero', heroType: 'mix', data: trendingSeeds[0] });
    }

    if (continueListening.length > 0) sections.push({ id: 'continue_listening', type: 'continue_listening' });

    // 2. Made For You & Personal Mixes (Strictly omitted if behavioral data is not yet ready)
    if (isDataReady && madeForYou.length > 0) {
      const allPersonalMixes = [
        ...dailyMixes,
        ...madeForYou.filter(m => !dailyMixes.some(dm => dm.id === m.id)),
      ].filter(Boolean);

      if (allPersonalMixes.length > 0) {
        sections.push({ id: 'daily_mixes', type: 'daily_mixes', data: allPersonalMixes });
      }
    }

    // 3. Discover Music
    if (trendingSeeds.length > 0) {
      sections.push({ id: 'discover_music', type: 'discover_music', data: trendingSeeds });
    }

    // 4. Because You Like
    if (becauseYouLike.length > 0) {
      sections.push({ id: 'because_you_like', type: 'because_you_like', data: becauseYouLike });
    }
    
    // 5. Top Tracks (Strictly based on real listening affinity)
    if (topTracks.length > 0) {
      sections.push({ id: 'top_tracks', type: 'top_tracks', data: topTracks });
    }

    // 6. Favorite Artists (Derived from real play counts & affinities)
    const effectiveFavoriteArtists = (favoriteArtists.length > 0 ? favoriteArtists : topArtists).filter(Boolean);
    if (effectiveFavoriteArtists.length > 0) {
      sections.push({ id: 'favorite_artists', type: 'favorite_artists', data: effectiveFavoriteArtists });
    }

    // 7. Favorite Albums (Derived from real play counts & affinities)
    const effectiveFavoriteAlbums = (favoriteAlbums.length > 0 ? favoriteAlbums : topAlbums).filter(Boolean);
    if (effectiveFavoriteAlbums.length > 0) {
      sections.push({ id: 'favorite_albums', type: 'favorite_albums', data: effectiveFavoriteAlbums });
    }

    if (recentlyPlayed.length > 0) sections.push({ id: 'recently_played', type: 'recently_played' });

    sections.push({ id: 'cleanup', type: 'cleanup' });

    return sections;
  }, [isAnalyticsHydrated, isRecommendationsHydrated, historyCount, featuredHeroMix, madeForYou, dailyMixes, topTracks, continueListening, becauseYouLike, favoriteArtists, favoriteAlbums, recentlyPlayed, trendingSeeds, topArtists, topAlbums]);

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
                <SectionHeader 
                  title="Discover Music" 
                  rightAction={
                    <TouchableOpacity 
                      onPress={handleRefreshDiscoverOnly} 
                      activeOpacity={0.7} 
                      style={{ paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityLabel="Refresh discover music"
                      accessibilityRole="button"
                    >
                      {isRotatingDiscover ? (
                        <ActivityIndicator size="small" color={P.primary} />
                      ) : (
                        <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.6)" />
                      )}
                    </TouchableOpacity>
                  }
                />
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
      case 'hero': {
        const heroTag = item.data.id === 'time-night' ? 'NIGHT VIBES' :
                        item.data.id === 'time-morning' ? 'MORNING ENERGY' :
                        item.data.id === 'mix-on-repeat' ? 'ON REPEAT' :
                        item.data.id === 'mix-repeat-rewind' ? 'REPEAT REWIND' :
                        item.data.id === 'mix-discover-weekly' ? 'DISCOVER WEEKLY' :
                        item.data.id === 'mix-deep-cuts' ? 'DEEP CUTS' :
                        item.data.id === 'mix-made-for-you' ? 'MADE FOR YOU' :
                        item.heroType === 'mix' ? 'FEATURED PLAYLIST' : 'FEATURED TRACK';
        const heroSubtitle = item.data.reason || (item.heroType === 'mix' ? "A personalized mix crafted for your taste." : (item.data.artist || 'A track you might love.'));
        return (
            <MaterialEntrance delay={80}>
                <IOSFeaturedMixCard 
                    item={item.data}
                    tag={heroTag}
                    image={getArtworkUrl(item.data, 'card')}
                    title={item.data.title || item.data.name}
                    subtitle={heroSubtitle}
                    onPress={() => item.heroType === 'mix' ? goPlaylist(item.data.id) : handlePlayTrack(item.data)}
                    onQuickPlay={() => item.heroType === 'mix' ? handleQuickPlaySeed(item.data) : handlePlayTrack(item.data)}
                />
            </MaterialEntrance>
        );
      }
      case 'cleanup':
        return <LibraryCleanupCard />;
      case 'continue_listening':
        return <ContinueListeningSection handlePlay={handleResumeContinueListening} />;
      case 'recently_played':
        return <RecentlyPlayedSection handlePlay={handleResumeContinueListening} />;

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
                    renderItem={({ item: artist, index }: any) => {
                      const artistName = typeof artist === 'string' ? artist : (artist?.name || 'Unknown Artist');
                      const artistId = (typeof artist === 'object' && artist.id) ? artist.id : getArtistIdForName(artistName);
                      const artistImg = typeof artist === 'object' ? (artist.image || artist.art || getArtworkUrl(artist, 'card')) : '';
                      return (
                        <CircleArtistCard 
                          artist={artist} 
                          name={artistName} 
                          image={artistImg} 
                          score={typeof artist === 'object' ? artist.score : undefined} 
                          onPress={() => goArtist(artistId)} 
                        />
                      );
                    }}
                    keyExtractor={(artist: any, index: number) => (typeof artist === 'object' && artist.id ? artist.id : `artist-${artist?.name || artist}-${index}`)}
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
                    renderItem={({ item: album, index }: any) => {
                      const albumTitle = typeof album === 'string' ? album : (album.title || album.name || 'Unknown Album');
                      const albumId = (typeof album === 'object' && album.id) ? album.id : albumTitle;
                      return (
                        <FavoriteAlbumCard 
                          album={typeof album === 'object' ? album : { title: albumTitle, artist: 'Various Artists', id: albumId }} 
                          onPress={() => goAlbum(albumId)} 
                        />
                      );
                    }}
                    keyExtractor={(album: any, index: number) => (typeof album === 'object' && album.id ? album.id : `album-${album?.title || album}-${index}`)}
                    contentContainerStyle={s.hzScrollContent}
                    {...ScrollPhysics.SNAPPY}
                />
            </View>
        );
      default:
        return null;
    }
  }, [greetingData, handlePlayTrack, goPlaylist, goArtist, goAlbum, handleRefreshDiscoverOnly, isRotatingDiscover]);

  return (
    <View style={s.container}>
      {sectionsData.length > 0 ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 10, paddingBottom: bottomPadding }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={P.primary}
              colors={[P.primary]}
              progressBackgroundColor="rgba(28, 28, 30, 0.95)"
            />
          }
          {...ScrollPhysics.STANDARD}
        >
          {sectionsData.map((item: any) => (
            <React.Fragment key={item.id}>
              {renderSectionItem({ item })}
            </React.Fragment>
          ))}
        </ScrollView>
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
  // ── iOS 4:3 Continue Listening Card Styles ──────────────────────────────
  iosCl43CardContainer: {
    width: 180,
    height: 236,
    marginRight: 14,
  },
  iosCl43CardGlass: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  iosCl43CardInner: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  iosCl43ArtworkWrapper: {
    width: '100%',
    height: 136,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#16161A',
  },
  iosCl43Artwork: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  iosCl43PlayBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  iosCl43Info: {
    paddingHorizontal: 2,
    marginTop: 6,
  },
  iosCl43Title: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  iosCl43Artist: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
  },
  iosCl43ProgressSection: {
    paddingHorizontal: 2,
    marginTop: 4,
  },
  iosCl43ProgressTrack: {
    width: '100%',
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 5,
    overflow: 'hidden',
  },
  iosCl43ProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: P.primary,
  },
  iosCl43TimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iosCl43RemainingText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  iosCl43StatusText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
  },
  iosCl43PlayingText: {
    color: P.primary,
    fontWeight: '800',
  },
  iosCl43PausedText: {
    color: '#FFB300',
    fontWeight: '800',
  },
  // Legacy aliases
  iosClCardContainer: {
    width: 180,
    height: 236,
    marginRight: 14,
  },
  iosClCardGlass: {
    width: '100%',
    height: '100%',
  },
  clCardContainer: {
    width: 250,
    height: 104,
    marginRight: 14,
  },
  clCardGlass: {
    width: 250,
    height: 104,
  },
  clCardInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  clCardImageContainer: {
    width: '100%',
    height: 64,
  },
  clCardImage: {
    width: '100%',
    height: '100%',
  },
  clCardMetadata: {
    paddingHorizontal: 12,
  },
  clCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  clCardArtist: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  clProgressSection: {
    paddingHorizontal: 12,
  },
  clProgressBarContainer: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  clProgressBarActive: {
    height: '100%',
    backgroundColor: P.primary,
  },
  clProgressInfo: {
    flexDirection: 'row',
  },
  clProgressText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  clNowPlayingText: {
    fontSize: 10,
    color: P.primary,
  },
  clPausedText: {
    fontSize: 10,
    color: P.amber,
  },
  clTimeText: {
    fontSize: 10,
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
    width: '100%',
    height: '100%',
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
  circleArtistAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  circleArtistImage: {
    width: '100%',
    height: '100%',
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
  favAlbumImageContainer: {
    width: 140,
    height: 140,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  favAlbumImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
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
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 10,
  },
  dmCardImageContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dmCardImage: {
    width: '100%',
    height: '100%',
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
    borderRadius: 24,
    overflow: 'hidden',
  },
  bylCardImage: {
    width: '100%',
    height: '100%',
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
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  stCardImageContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  stCardImage: {
    width: '100%',
    height: '100%',
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
  // ── iOS Featured Mix Hero Styles ──────────────────────────────────────────
  iosHeroContainer: {
    marginHorizontal: PAD,
    marginBottom: 24,
  },
  iosHeroHeader: {
    marginBottom: 12,
  },
  iosHeroTag: {
    fontSize: 11,
    fontWeight: '800',
    color: P.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  iosHeroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  iosHeroSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    lineHeight: 18,
  },
  iosHeroCardTouch: {
    width: '100%',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14,
  },
  iosHeroCardWrapper: {
    width: '100%',
    height: 210,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#121216',
    position: 'relative',
  },
  iosHeroArtwork: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  iosHeroBottomContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 76,
    justifyContent: 'flex-end',
  },
  iosHeroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  iosHeroGlassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iosHeroGlassPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  iosHeroPlayButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  iosHeroPlayGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '100%',
    height: '100%',
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
    width: '100%',
    height: '100%',
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
  // ── iOS Top Track Card Styles ─────────────────────────────────────────────
  iosTopTrackCardContainer: {
    width: SW * 0.82,
    height: 106,
    marginRight: 14,
  },
  iosTopTrackCardGlass: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  iosTopTrackCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iosTopTrackArtworkWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  iosTopTrackArtworkContainer: {
    width: 68,
    height: 68,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  iosTopTrackArtwork: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  iosTopTrackRankPill: {
    position: 'absolute',
    top: -4,
    left: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  iosTopTrackRankText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  iosTopTrackInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 6,
  },
  iosTopTrackTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  iosTopTrackArtist: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 6,
  },
  iosTopTrackMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  iosTopTrackMetricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iosTopTrackMetricText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  iosTopTrackAlbumText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  iosTopTrackActions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingLeft: 4,
  },
  iosTopTrackHeartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosTopTrackMoreBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Legacy aliases
  topTrackCardContainer: {
    width: SW * 0.82,
    height: 106,
    marginRight: 14,
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
    width: 68,
    height: 68,
    borderRadius: 16,
    marginRight: 14,
  },
  topTrackArtwork: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  topTrackInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  topTrackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  topTrackArtist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  topTrackAlbum: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
  },
  topTrackPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  topTrackPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  topTrackPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  topTrackRankBadge: {
    alignItems: 'flex-end',
  },
  topTrackRankNumber: {
    fontSize: 26,
    fontWeight: '900',
  },
  topTrackRankSub: {
    fontSize: 10,
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
