import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

// Core imports
import { useMusicActions, usePlaybackState } from "@/src/context/MusicContext";
import { useReducedMotionPreference } from "@/src/hooks/use-accessibility-preferences";
import { useResponsiveMetrics } from "@/src/hooks/use-responsive-metrics";
import { useMusicNavigation } from "@/src/navigation/music-navigation";
import { musicService } from "@/src/services/api/music";

// Design system
import { glass, motion, palette, radius, spacing } from "@/src/design/tokens";

// Utils
import { parseDuration } from "@/src/utils/time";

// Components
import { AtmosphericBackground } from "@/src/components/ui/atmospheric-background";
import {
  AuraText,
  MediaListItem,
  MotionReveal,
  SectionHeader,
  SkeletonBlock,
} from "@/src/components/ui/aura-primitives";
import { LiquidGlass } from "@/src/components/ui/liquid-glass";
import { PressScale } from "@/src/components/ui/press-scale";

// Types
import {
  AlbumDetails,
  ArtistBasicInfo,
  ArtistDetails,
  MusicTrack,
} from "@/src/types/music";

const CACHE_PREFIX = "artist_cache_";
const IN_MEMORY_CACHE: Record<string, ArtistDetails> = {};

// ─── Haptic-safe press helper ───────────────────────────────────────────────
// Wraps Pressable with a spring scale for Android (no haptics dependency)
const SpringButton = memo(
  ({
    onPress,
    style,
    accessibilityLabel,
    accessibilityRole = "button",
    hitSlop,
    disabled,
    children,
  }: {
    onPress?: () => void;
    style?: any;
    accessibilityLabel?: string;
    accessibilityRole?: any;
    hitSlop?: any;
    disabled?: boolean;
    children: React.ReactNode;
  }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
      Animated.spring(scale, {
        toValue: 0.94,
        useNativeDriver: true,
        speed: 50,
        bounciness: 2,
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
        bounciness: 6,
      }).start();
    };

    return (
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessible
      >
        <Animated.View style={[style, { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  },
);

// ─── Main Page ───────────────────────────────────────────────────────────────
function ArtistPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const responsive = useResponsiveMetrics();
  const reduceMotion = useReducedMotionPreference();
  const navigation = useMusicNavigation("artist");
  const { currentTrack, isPlaying } = usePlaybackState();
  const { play, setQueue } = useMusicActions();

  const artistId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [artist, setArtist] = useState<ArtistDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  // Animation values
  const pageOpacity = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isLeaving, setIsLeaving] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  // Bottom Sheet State
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetTitle, setBottomSheetTitle] = useState("");
  const [bottomSheetData, setBottomSheetData] = useState<any[]>([]);
  const [bottomSheetType, setBottomSheetType] = useState<
    "tracks" | "albums" | "artists"
  >("tracks");
  const [isModalLoadingMore, setIsModalLoadingMore] = useState(false);
  const [isModalFetching, setIsModalFetching] = useState(false);

  // Expanded Content Cache
  const expandedCache = useRef<Record<string, any[]>>({});

  // Sticky header threshold
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const threshold = height * 0.25;
      if (value > threshold) {
        if (!showSticky) setShowSticky(true);
      } else {
        if (showSticky) setShowSticky(false);
      }
    });
    return () => scrollY.removeListener(id);
  }, [height, scrollY, showSticky]);

  // Derived data
  const latestTracks = useMemo(() => {
    if (!artist?.songs?.length) return [];
    const timestamp = (track: MusicTrack) => {
      const value = track.time ? Date.parse(track.time) : NaN;
      return Number.isNaN(value) ? 0 : value;
    };
    return [...artist.songs]
      .sort((a, b) => timestamp(b) - timestamp(a))
      .slice(0, 4);
  }, [artist?.songs]);

  const allReleases = useMemo(() => {
    if (!artist) return [];
    return [...artist.singles, ...artist.albums].sort(
      (a, b) => parseInt(b.year || "0", 10) - parseInt(a.year || "0", 10),
    );
  }, [artist?.albums, artist?.singles]);

  const releaseItems = useMemo(() => allReleases.slice(0, 6), [allReleases]);

  // Page enter animation
  useEffect(() => {
    if (reduceMotion) {
      pageOpacity.setValue(1);
      return;
    }
    Animated.timing(pageOpacity, {
      toValue: 1,
      duration: motion.duration.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [pageOpacity, reduceMotion]);

  // Data Fetching
  const fetchArtistData = useCallback(async (id: string, useCache = true) => {
    if (!id) return;

    if (useCache && IN_MEMORY_CACHE[id]) {
      setArtist(IN_MEMORY_CACHE[id]);
      setIsLoading(false);
      refreshArtistData(id);
      return;
    }

    if (useCache) {
      try {
        const cachedData = await AsyncStorage.getItem(CACHE_PREFIX + id);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          setArtist(parsed);
          IN_MEMORY_CACHE[id] = parsed;
          setIsLoading(false);
          refreshArtistData(id);
          return;
        }
      } catch (e) {
        console.warn("[Artist Page] Cache read failed:", e);
      }
    }

    setIsLoading(true);
    await refreshArtistData(id);
    setIsLoading(false);
  }, []);

  const refreshArtistData = async (id: string) => {
    setIsRefreshing(true);
    setError(null);
    try {
      const data = await musicService.getArtistDetails(id);
      if (data) {
        const enriched = {
          ...data,
          tagline: data.tagline || "Pioneering the future of electronic music",
          genres: data.genres || ["Synthwave", "Electronic", "Ambient"],
        };
        setArtist(enriched);
        IN_MEMORY_CACHE[id] = enriched;
        await AsyncStorage.setItem(CACHE_PREFIX + id, JSON.stringify(enriched));
      } else {
        setError("Artist details not found.");
      }
    } catch (e: any) {
      console.error("[Artist Page] Fetch failed:", e);
      setError(
        e?.message || "Unable to load artist. Please check your connection.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArtistData(artistId);
  }, [artistId, fetchArtistData]);

  const handleBackPress = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    if (reduceMotion) {
      router.back();
      return;
    }
    Animated.timing(pageOpacity, {
      toValue: 0,
      duration: motion.duration.fast,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => router.back());
  }, [isLeaving, pageOpacity, router, reduceMotion]);

  const handleArtistPress = useCallback(
    (artistId?: string, artistName?: string) => {
      if (artistId) navigation.goArtist(artistId);
      else if (artistName) navigation.goArtistByName(artistName);
    },
    [navigation],
  );

  // Header interpolations
  const headerOverlayOpacity = scrollY.interpolate({
    inputRange: [height * 0.1, height * 0.22],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [height * 0.28, height * 0.38],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const stickyHeaderTranslateY = scrollY.interpolate({
    inputRange: [height * 0.28, height * 0.38],
    outputRange: [-10, 0],
    extrapolate: "clamp",
  });

  // Playback actions
  const handlePlayArtist = useCallback(async () => {
    if (!artist?.songs?.length) return;
    const tracks = artist.songs.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      art: track.art,
      url: "",
      duration: parseDuration(track.duration),
    }));
    await setQueue(tracks, 0);
    // Removed navigation to goNowPlaying
  }, [artist, setQueue]);

  const handleShuffleArtist = useCallback(async () => {
    if (!artist?.songs?.length) return;
    const shuffled = [...artist.songs].sort(() => Math.random() - 0.5);
    const tracks = shuffled.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      art: track.art,
      url: "",
      duration: parseDuration(track.duration),
    }));
    await setQueue(tracks, 0);
    // Removed navigation to goNowPlaying
  }, [artist, setQueue]);

  const handleTrackPress = useCallback(
    async (track: MusicTrack) => {
      const index = artist?.songs.findIndex((t) => t.id === track.id) ?? 0;
      await setQueue(
        artist?.songs.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          art: t.art,
          url: "",
          duration: parseDuration(t.duration),
        })) ?? [],
        index,
      );
      // Removed navigation to goNowPlaying
    },
    [artist, setQueue],
  );

  const openSeeAll = useCallback(
    async (
      title: string,
      initialData: any[],
      type: "tracks" | "albums" | "artists",
      params?: string,
    ) => {
      setBottomSheetTitle(title);
      setBottomSheetType(type);
      setBottomSheetVisible(true);

      const cacheKey = `${artistId}_${type}_${title}`;

      if (expandedCache.current[cacheKey]) {
        setBottomSheetData(expandedCache.current[cacheKey]);
        return;
      }

      // Show initial data while fetching
      setBottomSheetData(initialData);

      // Only fetch if we have params (except for artists which we don't have expanded endpoint yet)
      if (!params || type === "artists") return;

      setIsModalFetching(true);
      try {
        let expandedData: (MusicTrack | AlbumDetails | ArtistBasicInfo)[] = [];
        if (type === "tracks") {
          expandedData = await musicService.getArtistSongs(artistId, params);
        } else if (type === "albums") {
          expandedData = await musicService.getArtistAlbums(artistId, params);
        }

        if (expandedData && expandedData.length > 0) {
          setBottomSheetData(expandedData);
          expandedCache.current[cacheKey] = expandedData;
        }
      } catch (e) {
        console.error("[Artist Page] See All fetch failed:", e);
      } finally {
        setIsModalFetching(false);
      }
    },
    [artistId],
  );

  const handleModalScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isCloseToBottom && !isModalLoadingMore && !isModalFetching) {
      // Future: add pagination if backend supports it
    }
  };

  // ─── Error State ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <AtmosphericBackground />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={palette.coral} />
          <AuraText variant="title" style={styles.errorTitle}>
            Connection Error
          </AuraText>
          <AuraText variant="body" style={styles.errorText}>
            {error}
          </AuraText>
          <SpringButton
            onPress={() => fetchArtistData(artistId, false)}
            style={styles.retryButton}
            accessibilityLabel="Retry loading artist"
          >
            <AuraText variant="headline" style={styles.retryText}>
              Try Again
            </AuraText>
          </SpringButton>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.errorBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <AuraText variant="caption">Go Back</AuraText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Loading State ────────────────────────────────────────────────────────
  if (isLoading || !artist) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <AtmosphericBackground />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.loadingContent}
        >
          <HeroSkeleton />
          <ControlsSkeleton />
          <StatsSkeleton />
          <TracksSkeleton />
        </ScrollView>
      </View>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AtmosphericBackground />

      {/* Floating Back / Like header (visible when near top) */}
      <Animated.View
        style={[styles.headerOverlay, { opacity: headerOverlayOpacity }]}
        pointerEvents={showSticky ? "none" : "auto"}
      >
        <SpringButton
          onPress={handleBackPress}
          style={styles.headerGlassButton}
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color={palette.ink} />
        </SpringButton>
        <SpringButton
          onPress={() => { }}
          style={styles.headerGlassButton}
          accessibilityLabel="Like artist"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="heart-outline" size={18} color={palette.ink} />
        </SpringButton>
      </Animated.View>

      {/* Sticky Header (visible after scroll) */}
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            opacity: stickyHeaderOpacity,
            transform: [{ translateY: stickyHeaderTranslateY }],
          },
        ]}
        pointerEvents={showSticky ? "auto" : "none"}
      >
        <LiquidGlass
          intensity={glass.navBlur}
          borderRadius={radius.xl}
          gradient
          style={styles.stickyHeaderGlass}
          contentStyle={styles.stickyHeaderContent}
        >
          <SpringButton
            onPress={handleBackPress}
            style={styles.stickyBackButton}
            accessibilityLabel="Go back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={18} color={palette.ink} />
          </SpringButton>

          <View style={styles.stickyHeaderInfo}>
            <Image
              source={{ uri: artist.thumbnail }}
              style={styles.stickyAvatar}
              contentFit="cover"
            />
            <AuraText
              variant="headline"
              numberOfLines={1}
              style={styles.stickyTitle}
            >
              {artist.name}
            </AuraText>
          </View>

          <SpringButton
            onPress={handleShuffleArtist}
            style={styles.stickyPlayButton}
            accessibilityLabel="Shuffle all tracks"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="shuffle" size={16} color={palette.ink} />
          </SpringButton>
        </LiquidGlass>
      </Animated.View>

      {/* Page content */}
      <Animated.View style={[styles.pageTransition, { opacity: pageOpacity }]}>
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
        >
          <HeroSection artist={artist} scrollY={scrollY} />

          <MotionReveal delay={80}>
            <FloatingControlPanel
              onPlay={handlePlayArtist}
              onShuffle={handleShuffleArtist}
              isFollowing={isFollowing}
              onFollow={() => setIsFollowing((v) => !v)}
            />
          </MotionReveal>

          <MotionReveal delay={180}>
            <QuickStats artist={artist} />
          </MotionReveal>

          {latestTracks.length > 0 && (
            <MotionReveal delay={260}>
              <TopTracksSection
                title="Top Tracks"
                tracks={latestTracks}
                allTracks={artist.songs}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onTrackPress={handleTrackPress}
                onSeeAll={() =>
                  openSeeAll(
                    "Top Tracks",
                    artist.songs,
                    "tracks",
                    artist.songs_params,
                  )
                }
              />
            </MotionReveal>
          )}

          {releaseItems.length > 0 ? (
            <MotionReveal delay={340}>
              <PopularReleasesSection
                releases={releaseItems}
                onSeeAll={() =>
                  openSeeAll(
                    "Popular Releases",
                    allReleases,
                    "albums",
                    artist.singles_params || artist.albums_params,
                  )
                }
                onAlbumPress={(albumId) => navigation.goAlbum(albumId)}
              />
            </MotionReveal>
          ) : (
            <MotionReveal delay={340}>
              <SectionWithPlaceholder title="Popular Releases" />
            </MotionReveal>
          )}

          {artist.albums && artist.albums.length > 0 && (
            <MotionReveal delay={420}>
              <AlbumShowcaseSection
                title="Albums"
                albums={artist.albums}
                onAlbumPress={(albumId) => navigation.goAlbum(albumId)}
                onSeeAll={() =>
                  openSeeAll(
                    "Albums",
                    artist.albums,
                    "albums",
                    artist.albums_params,
                  )
                }
              />
            </MotionReveal>
          )}

          <MotionReveal delay={500}>
            <AboutArtistSection artist={artist} />
          </MotionReveal>

          {artist.related && artist.related.length > 0 && (
            <MotionReveal delay={580}>
              <RelatedArtistsSection
                artists={artist.related}
                onSeeAll={() =>
                  openSeeAll("Related Artists", artist.related, "artists")
                }
                onArtistPress={handleArtistPress}
              />
            </MotionReveal>
          )}

          <View style={styles.bottomSpacing} />
        </Animated.ScrollView>
      </Animated.View>

      {/* Bottom Sheet */}
      <SeeAllBottomSheet
        visible={bottomSheetVisible}
        title={bottomSheetTitle}
        data={bottomSheetData}
        type={bottomSheetType}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        isLoadingMore={isModalLoadingMore}
        isFetching={isModalFetching}
        onClose={() => setBottomSheetVisible(false)}
        onScroll={handleModalScroll}
        onTrackPress={(track) => {
          setBottomSheetVisible(false);
          handleTrackPress(track);
        }}
        onAlbumPress={(albumId) => {
          setBottomSheetVisible(false);
          navigation.goAlbum(albumId);
        }}
        onArtistPress={(artistId) => {
          setBottomSheetVisible(false);
          handleArtistPress(artistId);
        }}
      />
    </View>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
const HeroSection = memo(
  ({
    artist,
    scrollY,
  }: {
    artist: ArtistDetails;
    scrollY: Animated.Value;
  }) => {
    const imageScale = scrollY.interpolate({
      inputRange: [-120, 0, 120],
      outputRange: [1.12, 1, 0.94],
      extrapolate: "clamp",
    });

    const imageTranslateY = scrollY.interpolate({
      inputRange: [0, 200],
      outputRange: [0, 50],
      extrapolate: "clamp",
    });

    const contentOpacity = scrollY.interpolate({
      inputRange: [0, 160],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    const contentTranslateY = scrollY.interpolate({
      inputRange: [0, 160],
      outputRange: [0, -20],
      extrapolate: "clamp",
    });

    return (
      <View style={styles.heroSection}>
        <Animated.View
          style={[
            styles.heroImageContainer,
            {
              transform: [
                { scale: imageScale },
                { translateY: imageTranslateY },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: artist.thumbnail }}
            style={styles.heroImage}
            contentFit="cover"
            transition={500}
            accessibilityLabel={`${artist.name} artist photo`}
          />
          {/* subtle inner shadow rim */}
          <View style={styles.heroImageRim} pointerEvents="none" />
        </Animated.View>

        <Animated.View
          style={[
            styles.heroInfo,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={13} color={palette.primary} />
            <AuraText variant="caption" style={styles.verifiedText}>
              Verified Artist
            </AuraText>
          </View>

          <AuraText
            variant="display"
            style={styles.artistName}
            accessibilityRole="header"
          >
            {artist.name}
          </AuraText>

          <AuraText variant="body" style={styles.listenersText}>
            {artist.subscribers} monthly listeners
          </AuraText>

          {artist.genres && artist.genres.length > 0 && (
            <View style={styles.genreRow}>
              {artist.genres.map((g: string, i: number) => (
                <View key={i} style={styles.genrePill}>
                  <AuraText variant="caption" style={styles.genrePillText}>
                    {g}
                  </AuraText>
                </View>
              ))}
            </View>
          )}

          <AuraText variant="headline" style={styles.taglineText}>
            {artist.tagline}
          </AuraText>
        </Animated.View>
      </View>
    );
  },
);

// ─── Liquid Glass Control Panel ───────────────────────────────────────────────
// iOS liquid glass concept: frosted glass card, primary play/shuffle pills,
// icon action row with individual glass capsules
const FloatingControlPanel = memo(
  ({
    onPlay,
    onShuffle,
    isFollowing,
    onFollow,
  }: {
    onPlay: () => void;
    onShuffle: () => void;
    isFollowing: boolean;
    onFollow: () => void;
  }) => {
    const followScale = useRef(new Animated.Value(1)).current;

    const animateFollow = () => {
      Animated.sequence([
        Animated.spring(followScale, {
          toValue: 1.18,
          useNativeDriver: true,
          speed: 60,
          bounciness: 12,
        }),
        Animated.spring(followScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 40,
          bounciness: 4,
        }),
      ]).start();
      onFollow();
    };

    const secondaryActions = [
      {
        icon: isFollowing ? "person-remove-outline" : "person-add-outline",
        label: isFollowing ? "Unfollow" : "Follow",
        onPress: animateFollow,
        animated: true,
        active: isFollowing,
      },

      {
        icon: "share-social-outline",
        label: "Share",
        onPress: () => { },
        active: false,
      },
      {
        icon: "ellipsis-horizontal",
        label: "More",
        onPress: () => { },
        active: false,
      },
    ];

    return (
      <View style={styles.controlPanelContainer}>
        <LiquidGlass
          borderRadius={28}
          intensity={glass.denseBlur ?? 60}
          gradient
          style={styles.controlPanelGlass}
          contentStyle={styles.controlPanelInner}
        >
          {/* ── Primary row: Play + Shuffle ── */}
          <View style={styles.primaryRow}>
            {/* Play pill – solid, primary coloured */}
            <SpringButton
              onPress={onPlay}
              style={styles.playPill}
              accessibilityLabel="Play all tracks"
            >
              <View style={styles.playPillContent}>
                <View style={styles.playIconCircle}>
                  <Ionicons name="play" size={15} color="#fff" />
                </View>
                <AuraText variant="headline" style={styles.playPillText}>
                  Play
                </AuraText>
              </View>
            </SpringButton>

            {/* Shuffle pill – glass */}
            <SpringButton
              onPress={onShuffle}
              style={styles.shufflePill}
              accessibilityLabel="Shuffle all tracks"
            >
              <View style={styles.shufflePillContent}>
                <Ionicons name="shuffle" size={18} color={palette.primary} />
                <AuraText variant="headline" style={styles.shufflePillText}>
                  Shuffle
                </AuraText>
              </View>
            </SpringButton>
          </View>

          {/* ── Divider ── */}
          <View style={styles.panelDivider} />

          {/* ── Secondary row: icon capsules ── */}
          <View style={styles.secondaryRow}>
            {secondaryActions.map((action, i) => (
              <View key={i} style={styles.actionCapsuleWrapper}>
                <SpringButton
                  onPress={action.onPress}
                  style={[
                    styles.actionCapsule,
                    action.active && styles.actionCapsuleActive,
                  ]}
                  accessibilityLabel={action.label}
                >
                  {action.animated ? (
                    <Animated.View
                      style={{ transform: [{ scale: followScale }] }}
                    >
                      <Ionicons
                        name={action.icon as any}
                        size={20}
                        color={action.active ? palette.primary : palette.inkDim}
                      />
                    </Animated.View>
                  ) : (
                    <Ionicons
                      name={action.icon as any}
                      size={20}
                      color={action.active ? palette.primary : palette.inkDim}
                    />
                  )}
                </SpringButton>
                <AuraText variant="caption" style={styles.actionCapsuleLabel}>
                  {action.label}
                </AuraText>
              </View>
            ))}
          </View>
        </LiquidGlass>
      </View>
    );
  },
);

// ─── Quick Stats ──────────────────────────────────────────────────────────────
const QuickStats = memo(({ artist }: { artist: ArtistDetails }) => {
  const stats = [
    { label: "Listeners", value: artist.subscribers || "12.4M", icon: "headset-outline" },
    { label: "Total Plays", value: "2.1B", icon: "play-circle-outline" },
    { label: "Followers", value: "840K", icon: "people-outline" },
  ];

  return (
    <View style={styles.statsSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsScroll}
        decelerationRate="fast"
        snapToInterval={164}
        snapToAlignment="start"
      >
        {stats.map((stat, i) => (
          <LiquidGlass
            key={i}
            borderRadius={radius.lg}
            style={styles.statCard}
            contentStyle={styles.statInner}
          >
            <Ionicons
              name={stat.icon as any}
              size={16}
              color={palette.primary}
              style={{ marginBottom: 8 }}
            />
            <AuraText variant="caption" muted style={styles.statLabel}>
              {stat.label}
            </AuraText>
            <AuraText variant="title" style={styles.statValue}>
              {stat.value}
            </AuraText>
          </LiquidGlass>
        ))}
      </ScrollView>
    </View>
  );
});

// ─── Top Tracks ───────────────────────────────────────────────────────────────
interface TopTracksSectionProps {
  title: string;
  tracks: MusicTrack[];
  allTracks: MusicTrack[];
  currentTrack: any;
  isPlaying: boolean;
  onTrackPress: (track: MusicTrack) => void;
  onSeeAll: () => void;
}

const TopTracksSection = memo(
  ({
    title,
    tracks,
    allTracks,
    currentTrack,
    isPlaying,
    onTrackPress,
    onSeeAll,
  }: TopTracksSectionProps) => (
    <View style={styles.section}>
      <SectionHeader title={title} actionLabel="See all" onActionPress={onSeeAll} />
      <View style={styles.tracksList}>
        {tracks.map((track: MusicTrack) => (
          <MediaListItem
            key={track.id}
            title={track.title}
            subtitle={track.artist}
            image={track.art}
            meta={track.duration}
            active={currentTrack?.id === track.id}
            onPress={() => onTrackPress(track)}
            downloadable
            track={{
              id: track.id,
              title: track.title,
              artist: track.artist,
              art: track.art,
              url: "",
              duration: parseDuration(track.duration),
            }}
          />
        ))}
      </View>
    </View>
  ),
);

// ─── Popular Releases ─────────────────────────────────────────────────────────
interface PopularReleasesSectionProps {
  releases: AlbumDetails[];
  onSeeAll: () => void;
  onAlbumPress: (albumId: string) => void;
}

const PopularReleasesSection = memo(
  ({ releases, onSeeAll, onAlbumPress }: PopularReleasesSectionProps) => (
    <View style={styles.section}>
      <SectionHeader
        title="Popular Releases"
        actionLabel="See all"
        onActionPress={onSeeAll}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
        decelerationRate="fast"
      >
        {releases.map((release) => (
          <SpringButton
            key={release.id}
            style={styles.releaseItem}
            onPress={() => onAlbumPress(release.id)}
            accessibilityLabel={`${release.title} by ${release.artist}, ${release.type === "single" ? "Single" : "Album"}, ${release.year || "2024"}`}
          >
            <Image
              source={{ uri: release.thumbnail }}
              style={styles.releaseArt}
              contentFit="cover"
            />
            <AuraText variant="headline" numberOfLines={1} style={styles.releaseTitle}>
              {release.title}
            </AuraText>
            <AuraText variant="caption" muted>
              {release.type === "single" ? "Single" : "Album"} · {release.year || "2024"}
            </AuraText>
          </SpringButton>
        ))}
      </ScrollView>
    </View>
  ),
);

// ─── Album Showcase ───────────────────────────────────────────────────────────
interface AlbumShowcaseSectionProps {
  title: string;
  albums: AlbumDetails[];
  onSeeAll: () => void;
  onAlbumPress: (albumId: string) => void;
}

const AlbumShowcaseSection = memo(
  ({ title, albums, onSeeAll, onAlbumPress }: AlbumShowcaseSectionProps) => (
    <View style={styles.section}>
      <SectionHeader title={title} actionLabel="See all" onActionPress={onSeeAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
        decelerationRate="fast"
      >
        {albums.slice(0, 6).map((album: AlbumDetails) => (
          <SpringButton
            key={album.id}
            style={styles.albumItem}
            onPress={() => onAlbumPress(album.id)}
            accessibilityLabel={`${album.title}, ${album.year || "2024"}`}
          >
            <Image
              source={{ uri: album.thumbnail }}
              style={styles.albumArt}
              contentFit="cover"
            />
            <AuraText variant="headline" numberOfLines={1} style={styles.albumTitle}>
              {album.title}
            </AuraText>
            <AuraText variant="caption" muted>
              {album.year || "2024"}
            </AuraText>
          </SpringButton>
        ))}
      </ScrollView>
    </View>
  ),
);

// ─── Placeholder Section ──────────────────────────────────────────────────────
interface SectionWithPlaceholderProps {
  title: string;
  onSeeAll?: () => void;
}

const SectionWithPlaceholder = memo(
  ({ title, onSeeAll }: SectionWithPlaceholderProps) => (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        actionLabel={onSeeAll ? "See all" : undefined}
        onActionPress={onSeeAll}
      />
      <AuraText variant="body" muted style={styles.placeholderText}>
        {title} will appear here
      </AuraText>
    </View>
  ),
);

// ─── About Artist ─────────────────────────────────────────────────────────────
const AboutArtistSection = memo(({ artist }: { artist: ArtistDetails }) => {
  const [expanded, setExpanded] = useState(false);
  const contentHeight = useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="About" />
      <LiquidGlass
        borderRadius={radius.lg}
        style={styles.aboutCard}
        contentStyle={styles.aboutInner}
      >
        <AuraText variant="body" style={styles.aboutText}>
          {expanded ? artist.description : `${artist.description?.slice(0, 200)}...`}
        </AuraText>
        <TouchableOpacity
          onPress={toggleExpand}
          accessibilityLabel={expanded ? "Show less about artist" : "Show more about artist"}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AuraText variant="caption" style={styles.expandText}>
            {expanded ? "Show less" : "Show more"}
          </AuraText>
        </TouchableOpacity>

        <View style={styles.aboutMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={palette.inkDim} />
            <AuraText variant="caption" muted>
              Los Angeles, CA
            </AuraText>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="musical-notes-outline" size={14} color={palette.inkDim} />
            <AuraText variant="caption" muted>
              Influences: Kavinsky, The Midnight
            </AuraText>
          </View>
        </View>
      </LiquidGlass>
    </View>
  );
});

// ─── Related Artists ──────────────────────────────────────────────────────────
interface RelatedArtistsSectionProps {
  artists: ArtistBasicInfo[];
  onSeeAll: () => void;
  onArtistPress: (artistId?: string, artistName?: string) => void;
}

const RelatedArtistsSection = memo(
  ({ artists, onSeeAll, onArtistPress }: RelatedArtistsSectionProps) => (
    <View style={styles.section}>
      <SectionHeader
        title="Related Artists"
        actionLabel="See all"
        onActionPress={onSeeAll}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
        decelerationRate="fast"
      >
        {artists.slice(0, 6).map((item: ArtistBasicInfo) => (
          <SpringButton
            key={item.id}
            style={styles.relatedItem}
            onPress={() => onArtistPress(item.id, item.title)}
            accessibilityLabel={item.title}
          >
            <Image
              source={{ uri: item.thumbnail }}
              style={styles.relatedArt}
              contentFit="cover"
            />
            <AuraText
              variant="headline"
              numberOfLines={1}
              style={styles.relatedName}
            >
              {item.title}
            </AuraText>
          </SpringButton>
        ))}
      </ScrollView>
    </View>
  ),
);

// ─── See All Bottom Sheet ─────────────────────────────────────────────────────
interface SeeAllBottomSheetProps {
  visible: boolean;
  title: string;
  data: any[];
  type: "tracks" | "albums" | "artists";
  currentTrack: any;
  isPlaying: boolean;
  isLoadingMore: boolean;
  onClose: () => void;
  onScroll: (e: any) => void;
  onTrackPress: (track: MusicTrack) => void;
  onAlbumPress: (albumId: string) => void;
  onArtistPress: (artistId: string) => void;
}

const SeeAllBottomSheet = memo(
  ({
    visible,
    title,
    data,
    type,
    currentTrack,
    isPlaying,
    isLoadingMore,
    isFetching,
    onClose,
    onScroll,
    onTrackPress,
    onAlbumPress,
    onArtistPress,
  }: SeeAllBottomSheetProps & { isFetching: boolean }) => {
    const { height, width } = useWindowDimensions();

    const renderItem = useCallback(
      ({ item }: { item: any }) => {
        if (type === "tracks") {
          return (
            <MediaListItem
              key={item.id}
              title={item.title}
              subtitle={item.artist}
              image={item.art}
              meta={item.duration}
              active={currentTrack?.id === item.id}
              onPress={() => onTrackPress(item)}
              downloadable
              track={{
                id: item.id,
                title: item.title,
                artist: item.artist,
                art: item.art,
                url: "",
                duration: parseDuration(item.duration),
              }}
            />
          );
        }
        return (
          <SpringButton
            key={item.id}
            style={styles.modalGridItem}
            onPress={() =>
              type === "albums" ? onAlbumPress(item.id) : onArtistPress(item.id)
            }
            accessibilityLabel={item.title}
          >
            <Image
              source={{ uri: item.thumbnail || item.art }}
              style={[
                styles.modalGridArt,
                type === "artists" && { borderRadius: width * 0.2 },
              ]}
              contentFit="cover"
            />
            <AuraText
              variant="headline"
              numberOfLines={1}
              style={[
                styles.modalGridTitle,
                type === "artists" && { textAlign: "center" },
              ]}
            >
              {item.title}
            </AuraText>
          </SpringButton>
        );
      },
      [type, currentTrack, isPlaying, onTrackPress, onAlbumPress, onArtistPress, width],
    );

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={onClose}
            accessibilityLabel="Close panel"
            accessibilityRole="button"
          />
          <LiquidGlass
            intensity={glass.denseBlur}
            borderRadius={radius.xl}
            gradient
            style={[styles.modalContent, { height: height * 0.85 }]}
            contentStyle={styles.modalContentInner}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeaderRow}>
                <AuraText variant="title" style={styles.modalTitle}>
                  {title}
                </AuraText>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.modalClose}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={28} color={palette.inkDim} />
                </TouchableOpacity>
              </View>
            </View>

            {isFetching && data.length === 0 ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={palette.primary} size="large" />
                <AuraText variant="caption" style={{ marginTop: 12 }}>
                  Fetching collection...
                </AuraText>
              </View>
            ) : (
              <Animated.FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                numColumns={type === "tracks" ? 1 : 2}
                columnWrapperStyle={type !== "tracks" ? styles.modalGrid : undefined}
                onScroll={onScroll}
                scrollEventThrottle={16}
                removeClippedSubviews
                ListHeaderComponent={isFetching ? (
                  <ActivityIndicator color={palette.primary} style={{ marginVertical: 10 }} />
                ) : null}
                ListFooterComponent={
                  isLoadingMore ? (
                    <View style={styles.modalLoading}>
                      <ActivityIndicator color={palette.primary} />
                      <AuraText variant="caption" style={{ marginTop: 8 }}>
                        Loading more...
                      </AuraText>
                    </View>
                  ) : (
                    <View style={{ height: 40 }} />
                  )
                }
              />
            )}
          </LiquidGlass>
        </View>
      </Modal>
    );
  },
);

// ─── Skeleton States ──────────────────────────────────────────────────────────
const HeroSkeleton = () => (
  <View style={styles.heroSkeleton}>
    <SkeletonBlock style={styles.heroImageSkeleton} />
    <SkeletonBlock style={{ width: 100, height: 20, borderRadius: 10, marginBottom: 12 }} />
    <SkeletonBlock style={{ width: 220, height: 40, borderRadius: 12, marginBottom: 8 }} />
    <SkeletonBlock style={{ width: 160, height: 16, borderRadius: 8 }} />
  </View>
);

const ControlsSkeleton = () => (
  <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
    <SkeletonBlock style={{ height: 148, borderRadius: 28 }} />
  </View>
);

const StatsSkeleton = () => (
  <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 28 }}>
    {Array.from({ length: 3 }).map((_, i) => (
      <SkeletonBlock key={i} style={{ width: 130, height: 94, borderRadius: radius.lg }} />
    ))}
  </View>
);

const TracksSkeleton = () => (
  <View style={{ paddingHorizontal: 20, gap: 8 }}>
    {Array.from({ length: 4 }).map((_, i) => (
      <SkeletonBlock key={i} style={{ height: 70, borderRadius: radius.md }} />
    ))}
  </View>
);

export default memo(ArtistPage);

// ─── Styles ───────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  // ── Layout
  container: { flex: 1, backgroundColor: palette.background },
  scrollView: { flex: 1 },
  content: { paddingTop: 0 },
  loadingContent: { paddingTop: 40 },
  bottomSpacing: { height: 140 },
  pageTransition: { flex: 1 },

  // ── Floating header overlay (top of page)
  headerOverlay: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 32,
    left: 20,
    right: 20,
    zIndex: 120,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerGlassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    // Android elevation
    elevation: 4,
  },

  // ── Sticky header
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 8,
  },
  stickyHeaderGlass: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    elevation: 10,
  },
  stickyHeaderContent: {
    paddingTop: Platform.OS === "ios" ? 44 : 30,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stickyBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  stickyHeaderInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stickyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  stickyTitle: { fontSize: 15, fontWeight: "700", letterSpacing: -0.3 },
  stickyPlayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },

  // ── Hero
  heroSection: { paddingTop: 56, alignItems: "center", marginBottom: 28 },
  heroImageContainer: {
    width: 256,
    height: 256,
    borderRadius: radius.xl,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: palette.backgroundRaised,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
  },
  heroImage: { width: "100%", height: "100%" },
  heroImageRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroInfo: { alignItems: "center", paddingHorizontal: 20 },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
    backgroundColor: "rgba(191,90,242,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(191,90,242,0.18)",
  },
  verifiedText: {
    color: palette.primary,
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  artistName: {
    fontSize: 38,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.8,
    lineHeight: 44,
  },
  listenersText: { color: palette.inkMuted, marginBottom: 12, fontSize: 15 },
  genreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: 14,
  },
  genrePill: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  genrePillText: { fontSize: 12, color: palette.inkDim, fontWeight: "500" },
  taglineText: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.inkMuted,
    textAlign: "center",
    paddingHorizontal: 24,
    opacity: 0.85,
  },

  // ── Liquid Glass Control Panel
  controlPanelContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  controlPanelGlass: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  controlPanelInner: {
    padding: 16,
    gap: 14,
  },

  // Primary row
  primaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  playPill: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: palette.primary,
    overflow: "hidden",
    elevation: 4,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  playPillContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  playIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  playPillText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: -0.2,
  },
  shufflePill: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    overflow: "hidden",
  },
  shufflePillContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 20,
  },
  shufflePillText: {
    color: palette.ink,
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: -0.2,
  },

  // Divider
  panelDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: -16,
  },

  // Secondary row
  secondaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingTop: 2,
  },
  actionCapsuleWrapper: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  actionCapsule: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  actionCapsuleActive: {
    backgroundColor: "rgba(191,90,242,0.12)",
    borderColor: "rgba(191,90,242,0.22)",
  },
  actionCapsuleLabel: {
    fontSize: 11,
    color: palette.inkDim,
    textAlign: "center",
    fontWeight: "500",
  },

  // ── Stats
  statsSection: { marginBottom: 32 },
  statsScroll: {
    paddingHorizontal: 20,
    gap: 12,
    paddingRight: 32,
  },
  statCard: { width: 152, height: 96 },
  statInner: { padding: 14, justifyContent: "center" },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.primary,
    letterSpacing: -0.5,
  },

  // ── Sections
  section: { marginBottom: 36, paddingHorizontal: 20 },
  tracksList: { gap: 10 },
  horizontalScroll: { gap: 16, paddingRight: 36 },

  albumItem: { width: 158 },
  albumArt: {
    width: 158,
    height: 158,
    borderRadius: radius.lg,
    marginBottom: 10,
    backgroundColor: palette.backgroundRaised,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  albumTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },

  releaseItem: { width: 158, marginRight: 2 },
  releaseArt: {
    width: 158,
    height: 158,
    borderRadius: radius.lg,
    marginBottom: 10,
    backgroundColor: palette.backgroundRaised,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  releaseTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },

  relatedItem: { width: 136, alignItems: "center" },
  relatedArt: {
    width: 136,
    height: 136,
    borderRadius: 68,
    marginBottom: 10,
    backgroundColor: palette.backgroundRaised,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  relatedName: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  placeholderText: { marginTop: 12, textAlign: "center", opacity: 0.45 },

  // ── About
  aboutCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  aboutInner: { padding: 20 },
  aboutText: { lineHeight: 22, color: palette.inkMuted, fontSize: 15 },
  expandText: { color: palette.primary, marginTop: 14, fontWeight: "700" },
  aboutMeta: {
    marginTop: 18,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 16,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  // ── Modal / Bottom Sheet
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  modalContent: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: "hidden",
  },
  modalContentInner: { flex: 1 },
  modalHeader: {
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 16,
  },
  modalHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 22, fontWeight: "800" },
  modalClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollContent: { padding: 20, paddingBottom: 100 },
  modalGrid: { justifyContent: "space-between", gap: 16, marginBottom: 16 },
  modalGridItem: {
    width: (SCREEN_WIDTH - 56) / 2,
    marginBottom: 8,
  },
  modalGridArt: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    marginBottom: 10,
    backgroundColor: palette.backgroundRaised,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  modalGridTitle: { fontSize: 14, fontWeight: "600", paddingHorizontal: 4 },
  modalLoading: { paddingVertical: 30, alignItems: "center" },

  // ── Error
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorTitle: { marginTop: 20, marginBottom: 10 },
  errorText: { textAlign: "center", marginBottom: 30, lineHeight: 20 },
  retryButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginBottom: 20,
    elevation: 4,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  errorBack: { padding: 10 },

  // ── Skeletons
  heroSkeleton: { paddingTop: 56, alignItems: "center", marginBottom: 28 },
  heroImageSkeleton: {
    width: 256,
    height: 256,
    borderRadius: radius.xl,
    marginBottom: 24,
  },
});