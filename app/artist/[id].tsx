import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";
import {
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View
} from "react-native";

// Core imports
import { useMusicActions, usePlaybackState } from "@/src/context/MusicContext";
import { getArtistById, getTrackById } from "@/src/data/music-catalog";
import { useReducedMotionPreference } from "@/src/hooks/use-accessibility-preferences";
import { useResponsiveMetrics } from "@/src/hooks/use-responsive-metrics";
import { useMusicNavigation } from "@/src/navigation/music-navigation";

// Design system
import {
    glass,
    motion,
    palette,
    radius,
    spacing
} from "@/src/design/tokens";

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
import { CatalogArtist, CatalogTrack } from "@/src/data/music-catalog";

// Extended artist data for the page
interface ArtistPageData extends CatalogArtist {
  monthlyListeners?: string;
  verified?: boolean;
  genres?: string[];
  tagline?: string;
  biography?: string;
  origin?: string;
  influences?: string[];
  topTracks?: CatalogTrack[];
  popularReleases?: any[];
  relatedArtists?: CatalogArtist[];
  collaborators?: string[];
  fanInsights?: {
    trendGraph?: any;
    listenerHeatmap?: any;
    genreOverlap?: number;
    popularityScore?: number;
  };
  musicVideos?: any[];
  liveEvents?: any[];
}

// Mock extended data - in production this would come from API
const getExtendedArtistData = (artist: CatalogArtist): ArtistPageData => ({
  ...artist,
  monthlyListeners: "12.4M",
  verified: true,
  genres: ["Synthwave", "Electronic", "Ambient"],
  tagline: "Pioneering the future of electronic music",
  biography: `Elara Vance emerged from the underground synthwave scene in 2018 with her debut EP "Neon Dreams". Her unique blend of retro-futuristic aesthetics and modern production techniques quickly garnered attention from both critics and fans alike. Known for her immersive live performances and innovative use of technology in music creation, Elara has become a leading voice in the electronic music renaissance.`,
  origin: "Los Angeles, CA",
  influences: ["Kavinsky", "The Midnight", "Timecop1983"],
  topTracks: [
    getTrackById("nebula"),
    getTrackById("neon"),
    getTrackById("solar"),
    getTrackById("nightcall"),
  ].filter(Boolean) as CatalogTrack[],
  popularReleases: [],
  relatedArtists: [],
  collaborators: ["Synthwave Collective", "Cosmic Echo"],
  fanInsights: {
    popularityScore: 92,
  },
  musicVideos: [],
  liveEvents: [],
});

function ArtistPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const responsive = useResponsiveMetrics();
  const reduceMotion = useReducedMotionPreference();
  const navigation = useMusicNavigation("artist");
  const { currentTrack, isPlaying } = usePlaybackState();
  const { play, setQueue } = useMusicActions();

  const [pageOpacity] = useState(() => new Animated.Value(0));
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      pageOpacity.setValue(1);
      return;
    }

    Animated.timing(pageOpacity, {
      toValue: 1,
      duration: motion.duration.base,
      useNativeDriver: true,
    }).start();
  }, [pageOpacity, reduceMotion]);

  const handleBackPress = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    Animated.timing(pageOpacity, {
      toValue: 0,
      duration: motion.duration.fast,
      useNativeDriver: true,
    }).start(() => router.back());
  }, [isLeaving, pageOpacity, router]);

  // Artist data
  const artistId = Array.isArray(params.id) ? params.id[0] : params.id;
  const baseArtist = getArtistById(artistId);
  const artist = useMemo(
    () => (baseArtist ? getExtendedArtistData(baseArtist) : null),
    [baseArtist],
  );

  // Loading state
  const [isLoading, setIsLoading] = useState(!artist);
  const [scrollY] = useState(() => new Animated.Value(0));

  // Simulate loading
  useEffect(() => {
    if (!artist) {
      const timer = setTimeout(() => setIsLoading(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [artist]);

  // Animation values
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, height * 0.4],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const heroScale = scrollY.interpolate({
    inputRange: [0, height * 0.6],
    outputRange: [1, 0.8],
    extrapolate: "clamp",
  });

  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [height * 0.3, height * 0.5],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const blurIntensity = scrollY.interpolate({
    inputRange: [0, height * 0.4],
    outputRange: [glass.surfaceBlur, glass.denseBlur],
    extrapolate: "clamp",
  });

  // Actions
  const handlePlayArtist = useCallback(async () => {
    if (!artist?.topTracks?.length) return;
    await setQueue(
      artist.topTracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        art: track.art,
        url: track.art, // Placeholder - would be actual audio URL
        duration: track.durationSec,
        dominantColors: track.dominantColors,
      })),
      0,
    );
  }, [artist, setQueue]);

  const handleShuffleArtist = useCallback(async () => {
    if (!artist?.topTracks?.length) return;
    const shuffled = [...artist.topTracks].sort(() => Math.random() - 0.5);
    await setQueue(
      shuffled.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        art: track.art,
        url: track.art,
        duration: track.durationSec,
        dominantColors: track.dominantColors,
      })),
      0,
    );
  }, [artist, setQueue]);

  const handleTrackPress = useCallback(
    (track: CatalogTrack) => {
      navigation.goNowPlaying(track.id);
    },
    [navigation],
  );

  const handleFollowPress = useCallback(() => {
    // TODO: Implement follow functionality
    console.log("Follow artist:", artist?.name);
  }, [artist]);

  const handleSharePress = useCallback(() => {
    // TODO: Implement share functionality
    console.log("Share artist:", artist?.name);
  }, [artist]);

  const handleLikePress = useCallback(() => {
    // TODO: Implement like functionality
    console.log("Like artist:", artist?.name);
  }, [artist]);

  // Loading skeleton
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AtmosphericBackground />

      {/* Sticky Header */}
      <Animated.View
        style={[styles.stickyHeader, { opacity: stickyHeaderOpacity }]}
      >
        <LiquidGlass
          intensity={glass.navBlur}
          borderRadius={0}
          style={styles.stickyHeaderGlass}
          contentStyle={styles.stickyHeaderContent}
        >
          <PressScale
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            wrapperStyle={styles.backButtonWrapper}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={18} color={palette.ink} />
          </PressScale>

          <View style={styles.stickyTitleGroup}>
            <AuraText
              variant="headline"
              numberOfLines={1}
              style={styles.stickyTitle}
            >
              {artist.name}
            </AuraText>
            <AuraText variant="caption" style={styles.stickySubtitle}>
              {artist.monthlyListeners} monthly listeners
            </AuraText>
          </View>
        </LiquidGlass>
      </Animated.View>

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
        >
          {/* Hero Section */}
          <Animated.View
            style={[
              styles.heroContainer,
              { opacity: heroOpacity, transform: [{ scale: heroScale }] },
            ]}
          >
            <HeroSection
              artist={artist}
              onBack={handleBackPress}
              onFollow={handleFollowPress}
            />
          </Animated.View>

          {/* Floating Controls */}
          <MotionReveal delay={200}>
            <FloatingControls
              onPlay={handlePlayArtist}
              onShuffle={handleShuffleArtist}
              onFollow={handleFollowPress}
              onShare={handleSharePress}
              onLike={handleLikePress}
            />
          </MotionReveal>

          {/* Quick Stats */}
        <MotionReveal delay={400}>
          <QuickStats artist={artist} />
        </MotionReveal>

        {/* Top Tracks */}
        <MotionReveal delay={600}>
          <TopTracksSection
            tracks={artist.topTracks || []}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onTrackPress={handleTrackPress}
          />
        </MotionReveal>

        {/* Popular Releases */}
        <MotionReveal delay={800}>
          <PopularReleasesSection />
        </MotionReveal>

        {/* Visual Album Showcase */}
        <MotionReveal delay={1000}>
          <AlbumShowcaseSection />
        </MotionReveal>

        {/* About Artist */}
        <MotionReveal delay={1200}>
          <AboutArtistSection artist={artist} />
        </MotionReveal>

        {/* Collaborators */}
        <MotionReveal delay={1400}>
          <CollaboratorsSection collaborators={artist.collaborators || []} />
        </MotionReveal>

        {/* Related Artists */}
        <MotionReveal delay={1600}>
          <RelatedArtistsSection />
        </MotionReveal>

        {/* Fan Insights */}
        <MotionReveal delay={1800}>
          <FanInsightsSection insights={artist.fanInsights} />
        </MotionReveal>

        {/* Music Videos */}
        <MotionReveal delay={2000}>
          <MusicVideosSection />
        </MotionReveal>

        {/* Live Events */}
        <MotionReveal delay={2200}>
          <LiveEventsSection />
        </MotionReveal>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </Animated.ScrollView>
    </Animated.View>
    </View>
  );
}

// Hero Section Component
const HeroSection = memo(
  ({
    artist,
    onBack,
    onFollow,
  }: {
    artist: ArtistPageData;
    onBack: () => void;
    onFollow: () => void;
  }) => {
    const responsive = useResponsiveMetrics();

    return (
      <View
        style={[
          styles.heroSection,
          { paddingHorizontal: responsive.horizontalPadding },
        ]}
      >
      <View style={styles.heroContent}>
        <View style={styles.heroTopBar}>
          <PressScale
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.heroNavButton}
          >
            <Ionicons name="chevron-back" size={18} color={palette.ink} />
          </PressScale>
          <PressScale
            onPress={onFollow}
            accessibilityRole="button"
            accessibilityLabel="Follow artist"
            style={styles.heroFollowButton}
          >
            <Ionicons name="heart-outline" size={18} color={palette.ink} />
            <AuraText variant="caption" style={styles.heroFollowText}>
              Follow
            </AuraText>
          </PressScale>
        </View>

        {/* Artist Image */}
        <View style={styles.heroImageContainer}>
          <Image
            source={{ uri: artist.image }}
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
            placeholder={palette.backgroundRaised}
          />
          <LinearGradient
            colors={["transparent", "rgba(7,7,12,0.8)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroImageOverlay}
          />
        </View>

        {/* Artist Info */}
        <View style={styles.heroInfo}>
          {artist.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={palette.primary}
              />
              <AuraText variant="caption" style={styles.verifiedText}>
                Verified Artist
              </AuraText>
            </View>
          )}

          <AuraText
            variant="display"
            style={styles.artistName}
            numberOfLines={2}
          >
            {artist.name}
          </AuraText>

          <AuraText variant="body" style={styles.monthlyListeners}>
            {artist.monthlyListeners} monthly listeners
          </AuraText>

          {artist.genres && (
            <View style={styles.genresContainer}>
              {artist.genres.map((genre, index) => (
                <AuraText key={genre} variant="caption" style={styles.genre}>
                  {genre}
                  {index < artist.genres!.length - 1 ? " • " : ""}
                </AuraText>
              ))}
            </View>
          )}

          {artist.tagline && (
            <AuraText
              variant="headline"
              style={styles.tagline}
              numberOfLines={2}
            >
              {artist.tagline}
            </AuraText>
          )}
        </View>
      </View>
    </View>
  );
});

// Floating Controls Component
const FloatingControls = memo(
  ({
    onPlay,
    onShuffle,
    onFollow,
    onShare,
    onLike,
  }: {
    onPlay: () => void;
    onShuffle: () => void;
    onFollow: () => void;
    onShare: () => void;
    onLike: () => void;
  }) => {
    const responsive = useResponsiveMetrics();

    return (
      <View
        style={[
          styles.floatingControls,
          { paddingHorizontal: responsive.horizontalPadding },
        ]}
      >
        <LiquidGlass
          borderRadius={radius.xl}
          style={styles.controlsContainer}
          contentStyle={styles.controlsStack}
        >
          <View style={styles.primaryControls}>
            <PressScale
              scaleTo={0.94}
              onPress={onPlay}
              accessibilityRole="button"
              accessibilityLabel="Play artist"
              style={[styles.controlButton, styles.primaryButton]}
            >
              <Ionicons name="play" size={18} color={palette.ink} />
              <AuraText variant="headline" style={styles.controlText}>
                Play
              </AuraText>
            </PressScale>

            <PressScale
              scaleTo={0.94}
              onPress={onShuffle}
              accessibilityRole="button"
              accessibilityLabel="Shuffle artist"
              style={[styles.controlButton, styles.primaryButton]}
            >
              <Ionicons name="shuffle" size={18} color={palette.ink} />
              <AuraText variant="headline" style={styles.controlText}>
                Shuffle
              </AuraText>
            </PressScale>
          </View>

          <View style={styles.secondaryControls}>
            <PressScale
              scaleTo={0.92}
              onPress={onFollow}
              accessibilityRole="button"
              accessibilityLabel="Follow artist"
              style={styles.iconButton}
            >
              <Ionicons name="person-add" size={18} color={palette.ink} />
            </PressScale>

            <PressScale
              scaleTo={0.92}
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Share artist"
              style={styles.iconButton}
            >
              <Ionicons name="share-social" size={18} color={palette.ink} />
            </PressScale>

            <PressScale
              scaleTo={0.92}
              onPress={onLike}
              accessibilityRole="button"
              accessibilityLabel="Like artist"
              style={styles.iconButton}
            >
              <Ionicons name="heart" size={18} color={palette.primary} />
            </PressScale>
          </View>
        </LiquidGlass>
      </View>
    );
  },
);

// Quick Stats Component
const QuickStats = memo(({ artist }: { artist: ArtistPageData }) => {
  const responsive = useResponsiveMetrics();

  const stats = [
    { label: "Monthly Listeners", value: artist.monthlyListeners || "0" },
    { label: "Total Plays", value: "2.1B" },
    { label: "Followers", value: artist.followers || "0" },
    { label: "Trending", value: "#12" },
    { label: "Match", value: "98%" },
  ];

  return (
    <View
      style={[
        styles.statsSection,
        { paddingHorizontal: responsive.horizontalPadding },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsContainer}
      >
        {stats.map((stat, index) => (
          <MotionReveal key={stat.label} delay={index * 100}>
            <LiquidGlass
              borderRadius={radius.lg}
              style={styles.statCard}
              contentStyle={styles.statContent}
            >
              <AuraText variant="caption" style={styles.statLabel}>
                {stat.label}
              </AuraText>
              <AuraText variant="title" style={styles.statValue}>
                {stat.value}
              </AuraText>
            </LiquidGlass>
          </MotionReveal>
        ))}
      </ScrollView>
    </View>
  );
});

// Top Tracks Section
const TopTracksSection = memo(
  ({
    tracks,
    currentTrack,
    isPlaying,
    onTrackPress,
  }: {
    tracks: CatalogTrack[];
    currentTrack: any;
    isPlaying: boolean;
    onTrackPress: (track: CatalogTrack) => void;
  }) => {
    const responsive = useResponsiveMetrics();

    return (
      <View
        style={[
          styles.section,
          { paddingHorizontal: responsive.horizontalPadding },
        ]}
      >
        <SectionHeader title="Top Tracks" actionLabel="See all" />

        <View style={styles.tracksList}>
          {tracks.map((track, index) => (
            <MotionReveal key={track.id} delay={index * 50}>
              <MediaListItem
                title={track.title}
                subtitle={track.artist}
                image={track.art}
                meta={track.duration}
                active={currentTrack?.id === track.id}
                onPress={() => onTrackPress(track)}
                style={styles.trackItem}
              />
            </MotionReveal>
          ))}
        </View>
      </View>
    );
  },
);

// Popular Releases Section
const PopularReleasesSection = memo(() => {
  const responsive = useResponsiveMetrics();

  return (
    <View
      style={[
        styles.section,
        { paddingHorizontal: responsive.horizontalPadding },
      ]}
    >
      <SectionHeader title="Popular Releases" actionLabel="See all" />

      {/* Placeholder for popular releases */}
      <View style={styles.placeholder}>
        <AuraText variant="body" muted>
          Popular releases will appear here
        </AuraText>
      </View>
    </View>
  );
});

// Album Showcase Section
const AlbumShowcaseSection = memo(() => {
  const responsive = useResponsiveMetrics();

  return (
    <View
      style={[
        styles.section,
        { paddingHorizontal: responsive.horizontalPadding },
      ]}
    >
      <SectionHeader title="Albums" actionLabel="See all" />

      {/* Placeholder for album showcase */}
      <View style={styles.placeholder}>
        <AuraText variant="body" muted>
          Album showcase will appear here
        </AuraText>
      </View>
    </View>
  );
});

// About Artist Section
const AboutArtistSection = memo(({ artist }: { artist: ArtistPageData }) => {
  const responsive = useResponsiveMetrics();
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      style={[
        styles.section,
        { paddingHorizontal: responsive.horizontalPadding },
      ]}
    >
      <SectionHeader title="About" />

      <LiquidGlass
        borderRadius={radius.lg}
        style={styles.aboutCard}
        contentStyle={styles.aboutContent}
      >
        <AuraText variant="body" style={styles.biography}>
          {expanded
            ? artist.biography
            : `${artist.biography?.slice(0, 150)}...`}
        </AuraText>

        <PressScale scaleTo={0.98} onPress={() => setExpanded(!expanded)}>
          <AuraText variant="caption" style={styles.expandText}>
            {expanded ? "Show less" : "Show more"}
          </AuraText>
        </PressScale>

        <View style={styles.aboutDetails}>
          {artist.origin && (
            <View style={styles.detailRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={palette.inkDim}
              />
              <AuraText variant="caption" style={styles.detailText}>
                {artist.origin}
              </AuraText>
            </View>
          )}

          {artist.influences && (
            <View style={styles.detailRow}>
              <Ionicons
                name="musical-notes-outline"
                size={16}
                color={palette.inkDim}
              />
              <AuraText variant="caption" style={styles.detailText}>
                Influences: {artist.influences.join(", ")}
              </AuraText>
            </View>
          )}
        </View>
      </LiquidGlass>
    </View>
  );
});

// Collaborators Section
const CollaboratorsSection = memo(
  ({ collaborators }: { collaborators: string[] }) => {
    const responsive = useResponsiveMetrics();

    if (!collaborators.length) return null;

    return (
      <View
        style={[
          styles.section,
          { paddingHorizontal: responsive.horizontalPadding },
        ]}
      >
        <SectionHeader title="Collaborators" />

        <LiquidGlass
          borderRadius={radius.lg}
          style={styles.collaboratorsCard}
          contentStyle={styles.collaboratorsContent}
        >
          {collaborators.map((collaborator, index) => (
            <AuraText
              key={collaborator}
              variant="body"
              style={styles.collaborator}
            >
              {collaborator}
              {index < collaborators.length - 1 ? ", " : ""}
            </AuraText>
          ))}
        </LiquidGlass>
      </View>
    );
  },
);

// Related Artists Section
const RelatedArtistsSection = memo(() => {
  const responsive = useResponsiveMetrics();

  return (
    <View
      style={[
        styles.section,
        { paddingHorizontal: responsive.horizontalPadding },
      ]}
    >
      <SectionHeader title="Related Artists" actionLabel="See all" />

      {/* Placeholder for related artists */}
      <View style={styles.placeholder}>
        <AuraText variant="body" muted>
          Related artists will appear here
        </AuraText>
      </View>
    </View>
  );
});

// Fan Insights Section
const FanInsightsSection = memo(
  ({ insights }: { insights?: ArtistPageData["fanInsights"] }) => {
    const responsive = useResponsiveMetrics();

    if (!insights) return null;

    return (
      <View
        style={[
          styles.section,
          { paddingHorizontal: responsive.horizontalPadding },
        ]}
      >
        <SectionHeader title="Fan Insights" />

        <LiquidGlass
          borderRadius={radius.lg}
          style={styles.insightsCard}
          contentStyle={styles.insightsContent}
        >
          <View style={styles.insightRow}>
            <AuraText variant="headline" style={styles.insightLabel}>
              Popularity Score
            </AuraText>
            <AuraText variant="title" style={styles.insightValue}>
              {insights.popularityScore}%
            </AuraText>
          </View>
        </LiquidGlass>
      </View>
    );
  },
);

// Music Videos Section
const MusicVideosSection = memo(() => {
  const responsive = useResponsiveMetrics();

  return (
    <View
      style={[
        styles.section,
        { paddingHorizontal: responsive.horizontalPadding },
      ]}
    >
      <SectionHeader title="Music Videos" actionLabel="See all" />

      {/* Placeholder for music videos */}
      <View style={styles.placeholder}>
        <AuraText variant="body" muted>
          Music videos will appear here
        </AuraText>
      </View>
    </View>
  );
});

// Live Events Section
const LiveEventsSection = memo(() => {
  const responsive = useResponsiveMetrics();

  return (
    <View
      style={[
        styles.section,
        { paddingHorizontal: responsive.horizontalPadding },
      ]}
    >
      <SectionHeader title="Live Events" actionLabel="See all" />

      {/* Placeholder for live events */}
      <View style={styles.placeholder}>
        <AuraText variant="body" muted>
          Live events will appear here
        </AuraText>
      </View>
    </View>
  );
});

// Skeleton Components
const HeroSkeleton = memo(() => (
  <View style={styles.heroSkeleton}>
    <SkeletonBlock style={styles.heroImageSkeleton} />
    <View style={styles.heroInfoSkeleton}>
      <SkeletonBlock style={styles.verifiedSkeleton} />
      <SkeletonBlock style={styles.nameSkeleton} />
      <SkeletonBlock style={styles.listenersSkeleton} />
      <SkeletonBlock style={styles.genresSkeleton} />
    </View>
  </View>
));

const ControlsSkeleton = memo(() => (
  <View style={styles.controlsSkeleton}>
    <SkeletonBlock style={styles.controlsSkeletonBlock} />
  </View>
));

const StatsSkeleton = memo(() => (
  <View style={styles.statsSkeleton}>
    {Array.from({ length: 5 }).map((_, i) => (
      <SkeletonBlock key={i} style={styles.statSkeleton} />
    ))}
  </View>
));

const TracksSkeleton = memo(() => (
  <View style={styles.tracksSkeleton}>
    {Array.from({ length: 4 }).map((_, i) => (
      <SkeletonBlock key={i} style={styles.trackSkeleton} />
    ))}
  </View>
));

export default memo(ArtistPage);

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 0,
  },
  loadingContent: {
    paddingTop: 0,
  },

  // Sticky Header
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyHeaderGlass: {
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  stickyHeaderContent: {
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backButtonWrapper: {
    marginRight: spacing.sm,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  stickyTitleGroup: {
    flex: 1,
    justifyContent: "center",
  },
  stickyTitle: {
    flex: 1,
  },
  stickySubtitle: {
    color: palette.inkMuted,
  },

  // Hero Section
  heroSection: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: spacing.xxl,
  },
  heroContainer: {
    alignItems: "center",
  },
  pageTransition: {
    flex: 1,
  },
  heroTopBar: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  heroNavButton: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroFollowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroFollowText: {
    color: palette.ink,
  },
  heroContent: {
    alignItems: "center",
  },
  heroImageContainer: {
    position: "relative",
    marginBottom: spacing.xl,
  },
  heroImage: {
    width: 280,
    height: 280,
    borderRadius: radius.xl,
    backgroundColor: palette.backgroundRaised,
  },
  heroImageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    borderRadius: radius.xl,
  },
  heroInfo: {
    alignItems: "center",
    maxWidth: 320,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  verifiedText: {
    color: palette.primary,
  },
  artistName: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  monthlyListeners: {
    color: palette.inkMuted,
    marginBottom: spacing.md,
  },
  genresContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  genre: {
    color: palette.inkDim,
  },
  tagline: {
    textAlign: "center",
    color: palette.inkMuted,
    fontStyle: "italic",
  },

  // Floating Controls
  floatingControls: {
    marginBottom: spacing.xxl,
  },
  controlsContainer: {
    marginHorizontal: spacing.md,
  },
  controlsStack: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  primaryControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  secondaryControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    minHeight: 48,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  controlText: {
    fontSize: 15,
  },
  controlDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.border,
  },

  // Stats Section
  statsSection: {
    marginBottom: spacing.xxl,
  },
  statsContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    minWidth: 120,
    height: 80,
  },
  statContent: {
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    color: palette.inkDim,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: palette.primary,
  },

  // Section
  section: {
    marginBottom: spacing.xxl,
  },
  tracksList: {
    gap: spacing.xs,
  },
  trackItem: {
    marginHorizontal: spacing.md,
  },

  // About Section
  aboutCard: {
    marginHorizontal: spacing.md,
  },
  aboutContent: {
    padding: spacing.lg,
  },
  biography: {
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  expandText: {
    color: palette.primary,
    marginBottom: spacing.lg,
  },
  aboutDetails: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  detailText: {
    color: palette.inkMuted,
  },

  // Collaborators
  collaboratorsCard: {
    marginHorizontal: spacing.md,
  },
  collaboratorsContent: {
    padding: spacing.lg,
  },
  collaborator: {
    color: palette.inkMuted,
  },

  // Insights
  insightsCard: {
    marginHorizontal: spacing.md,
  },
  insightsContent: {
    padding: spacing.lg,
  },
  insightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  insightLabel: {
    color: palette.inkMuted,
  },
  insightValue: {
    color: palette.primary,
  },

  // Placeholder
  placeholder: {
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    alignItems: "center",
  },

  // Bottom Spacing
  bottomSpacing: {
    height: spacing.xxl * 2,
  },

  // Skeletons
  heroSkeleton: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: "center",
  },
  heroImageSkeleton: {
    width: 280,
    height: 280,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
  },
  heroInfoSkeleton: {
    alignItems: "center",
    maxWidth: 320,
  },
  verifiedSkeleton: {
    width: 100,
    height: 20,
    marginBottom: spacing.md,
  },
  nameSkeleton: {
    width: 200,
    height: 42,
    marginBottom: spacing.sm,
  },
  listenersSkeleton: {
    width: 150,
    height: 16,
    marginBottom: spacing.md,
  },
  genresSkeleton: {
    width: 120,
    height: 14,
  },

  controlsSkeleton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  controlsSkeletonBlock: {
    height: 60,
    borderRadius: radius.pill,
  },

  statsSkeleton: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  statSkeleton: {
    width: 120,
    height: 80,
    borderRadius: radius.lg,
  },

  tracksSkeleton: {
    marginHorizontal: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.xxl,
  },
  trackSkeleton: {
    height: 70,
    borderRadius: radius.md,
  },
});
