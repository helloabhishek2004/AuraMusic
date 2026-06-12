import { DownloadAlbumButton } from "@/src/components/ui/download-album-button";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaybackInsets } from "@/src/hooks/use-playback-insets";

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
import { getTrackArtwork } from "@/src/features/player/utils/track-identity";

// Components
import { AtmosphericBackground } from "@/src/components/ui/atmospheric-background";
import {
  AuraText,
  MediaListItem,
  SectionHeader,
  SkeletonBlock
} from "@/src/components/ui/aura-primitives";
import { LiquidGlass } from "@/src/components/ui/liquid-glass";
import { PressScale } from "@/src/components/ui/press-scale";

// Types
import { AlbumDetails, MusicTrack } from "@/src/types/music";

const CACHE_PREFIX = "album_cache_";
const IN_MEMORY_CACHE: Record<string, AlbumDetails> = {};

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as unknown as typeof FlashList;

function AlbumScreen() {
  const params = useLocalSearchParams();
  const { bottomPadding } = usePlaybackInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const responsive = useResponsiveMetrics();
  const reduceMotion = useReducedMotionPreference();
  const navigation = useMusicNavigation("album");
  const { currentTrack, isPlaying, isShuffle } = usePlaybackState();
  const { setQueue, toggleShuffle } = useMusicActions();

  const albumId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [album, setAlbum] = useState<AlbumDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const pageOpacity = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isLeaving, setIsLeaving] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  // Sticky header threshold
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const threshold = height * 0.22;
      if (value > threshold) {
        if (!showSticky) setShowSticky(true);
      } else {
        if (showSticky) setShowSticky(false);
      }
    });
    return () => scrollY.removeListener(id);
  }, [height, scrollY, showSticky]);

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
  const fetchAlbumData = useCallback(async (id: string, useCache = true) => {
    if (!id) return;

    if (id.startsWith("local-album-")) {
      setIsLoading(true);
      try {
        const decodedName = decodeURIComponent(id.replace("local-album-", ""));
        const { useDownloadStore } = await import("@/src/features/download/store/download.store");
        const downloaded = Object.values(useDownloadStore.getState().downloadedTracks);
        const albumTracks = downloaded.filter(t => t.album === decodedName);

        if (albumTracks.length > 0) {
          const localAlbum: AlbumDetails = {
            id: id,
            title: decodedName,
            artist: albumTracks[0].artist || "Unknown Artist",
            year: new Date(albumTracks[0].downloadedAt || Date.now()).getFullYear().toString(),
            thumbnail: albumTracks[0].art || "",
            trackCount: albumTracks.length,
            tracks: albumTracks.map(t => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              art: t.art,
              album: t.album || decodedName,
              duration: String(t.duration || "0:00"),
              source: t.source || "local"
            }))
          };
          setAlbum(localAlbum);
          setIsLoading(false);
          setError(null);
          return;
        } else {
          setError("Local album has no downloaded tracks.");
          setIsLoading(false);
          return;
        }
      } catch (e: any) {
        console.error("[Album Page] Local album load failed:", e);
        setError("Unable to load offline album.");
        setIsLoading(false);
        return;
      }
    }

    if (useCache && IN_MEMORY_CACHE[id]) {
      setAlbum(IN_MEMORY_CACHE[id]);
      setIsLoading(false);
      return;
    }

    if (useCache) {
      try {
        const cachedData = await AsyncStorage.getItem(CACHE_PREFIX + id);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          setAlbum(parsed);
          IN_MEMORY_CACHE[id] = parsed;
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn("[Album Page] Cache read failed:", e);
      }
    }

    setIsLoading(true);
    try {
      const data = await musicService.getAlbumDetails(id);
      if (data) {
        setAlbum(data);
        IN_MEMORY_CACHE[id] = data;
        await AsyncStorage.setItem(CACHE_PREFIX + id, JSON.stringify(data));
      } else {
        setError("Album not found.");
      }
    } catch (e: any) {
      console.error("[Album Page] Fetch failed:", e);
      setError(e?.message || "Unable to load album details.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlbumData(albumId);
  }, [albumId, fetchAlbumData]);

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

  const handleShare = useCallback(async () => {
    if (!album) return;
    await Share.share({
      message: `Listen to ${album.title} by ${album.artist} on Aura Music`,
    }).catch(() => undefined);
  }, [album]);

  const handlePlayAlbum = useCallback(
    async (shuffle = false) => {
      if (!album?.tracks?.length) return;

      // Toggle shuffle if requested but different from current state
      if (shuffle !== isShuffle) {
        await toggleShuffle();
      }

      const tracksToPlay = album.tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        art: track.art || album.thumbnail,
        album: album.title,
        url: "",
        duration: parseDuration(track.duration),
      }));

      await setQueue(tracksToPlay, 0, {
        sourceId: album.id,
        sourceType: "album",
        generatedAt: Date.now()
      });
      navigation.goNowPlaying(tracksToPlay[0].id);
    },
    [album, setQueue, navigation, isShuffle, toggleShuffle],
  );

  const handleTrackPress = useCallback(
    async (track: MusicTrack) => {
      if (!album?.tracks) return;
      const index = album.tracks.findIndex((t) => t.id === track.id) ?? 0;
      const tracksToPlay = album.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        art: t.art || album.thumbnail,
        album: album.title,
        url: "",
        duration: parseDuration(t.duration),
      }));
      await setQueue(tracksToPlay, index, {
        sourceId: album.id,
        sourceType: "album",
        generatedAt: Date.now()
      });
      navigation.goNowPlaying(track.id);
    },
    [album, setQueue, navigation],
  );

  // Animations
  const headerOverlayOpacity = scrollY.interpolate({
    inputRange: [height * 0.1, height * 0.2],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [height * 0.22, height * 0.32],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const stickyHeaderTranslateY = scrollY.interpolate({
    inputRange: [height * 0.22, height * 0.32],
    outputRange: [-12, 0],
    extrapolate: "clamp",
  });

  const renderTrackItem = useCallback(
    ({ item }: { item: MusicTrack }) => (
      <MediaListItem
        title={item.title}
        subtitle={item.artist}
        image={getTrackArtwork(item)}
        meta={item.duration}
        active={currentTrack?.id === item.id}
        onPress={() => handleTrackPress(item)}
        style={styles.trackItem}
      />
    ),
    [currentTrack?.id, handleTrackPress],
  );

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <AtmosphericBackground />
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={palette.coral}
          />
          <AuraText variant="title" style={styles.errorTitle}>
            Album Unavailable
          </AuraText>
          <AuraText variant="body" style={styles.errorText}>
            {error}
          </AuraText>
          <PressScale
            onPress={() => fetchAlbumData(albumId, false)}
            style={styles.retryButton}
          >
            <AuraText variant="headline" style={styles.retryText}>
              Try Again
            </AuraText>
          </PressScale>
          <TouchableOpacity onPress={handleBackPress} style={styles.errorBack}>
            <AuraText variant="caption">Go Back</AuraText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading || !album) {
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
          <TracksSkeleton />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AtmosphericBackground />

      {/* Floating Header */}
      <Animated.View
        style={[styles.headerOverlay, { opacity: headerOverlayOpacity }]}
        pointerEvents={showSticky ? "none" : "auto"}
      >
        <PressScale
          onPress={handleBackPress}
          style={styles.headerGlassButton}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={palette.ink} />
        </PressScale>
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* Sticky Header */}
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
          <PressScale onPress={handleBackPress} style={styles.stickyBackButton}>
            <Ionicons name="chevron-back" size={18} color={palette.ink} />
          </PressScale>

          <View style={styles.stickyHeaderInfo}>
            <AuraText
              variant="headline"
              numberOfLines={1}
              style={styles.stickyTitle}
            >
              {album.title}
            </AuraText>
          </View>

          <PressScale
            onPress={() => handlePlayAlbum(false)}
            style={styles.stickyPlayButton}
            accessibilityLabel="Play album"
          >
            <Ionicons name="play" size={16} color={palette.ink} />
          </PressScale>
        </LiquidGlass>
      </Animated.View>

      <Animated.View style={[styles.pageTransition, { opacity: pageOpacity }]}>
        <AnimatedFlashList
          data={album.tracks}
          renderItem={renderTrackItem}
          keyExtractor={(item: any) => item.id}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          ListHeaderComponent={
            <View>
              <HeroSection album={album} scrollY={scrollY} />
              <ActionButtons
                onPlay={() => handlePlayAlbum(false)}
                onShuffle={() => handlePlayAlbum(true)}
                onShare={handleShare}
                isShuffle={isShuffle}
                tracks={album.tracks}
                albumTitle={album.title}
                albumId={album.id}
              />
              <SectionHeader title="Tracks" style={styles.sectionHeader} />
            </View>
          }

          ListFooterComponent={<CreditsSection album={album} />}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
          scrollIndicatorInsets={{ bottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </View>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

const HeroSection = memo(
  ({ album, scrollY }: { album: AlbumDetails; scrollY: Animated.Value }) => {
    const { width } = useWindowDimensions();
    const heroSize = width * 0.65;

    const imageScale = scrollY.interpolate({
      inputRange: [-100, 0, 150],
      outputRange: [1.1, 1, 0.9],
      extrapolate: "clamp",
    });

    const imageTranslateY = scrollY.interpolate({
      inputRange: [0, 200],
      outputRange: [0, 40],
      extrapolate: "clamp",
    });

    return (
      <View style={styles.heroSection}>
        <Animated.View
          style={[
            styles.heroImageContainer,
            {
              width: heroSize,
              height: heroSize,
              transform: [
                { scale: imageScale },
                { translateY: imageTranslateY },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: album.thumbnail }}
            style={styles.heroImage}
            contentFit="cover"
            transition={400}
          />
        </Animated.View>

        <View style={styles.heroInfo}>
          <AuraText variant="display" style={styles.albumTitle}>
            {album.title}
          </AuraText>
          <TouchableOpacity onPress={() => {}} style={styles.artistLink}>
            <AuraText variant="headline" style={styles.artistName}>
              {album.artist}
            </AuraText>
          </TouchableOpacity>
          <AuraText variant="caption" muted style={styles.albumMeta}>
            {album.type?.toUpperCase()} • {album.year} • {album.trackCount}{" "}
            SONGS
          </AuraText>
        </View>
      </View>
    );
  },
);

const ActionButtons = memo(({ onPlay, onShuffle, onShare, isShuffle, tracks, albumTitle, albumId }: any) => (
  <LiquidGlass
    borderRadius={radius.xl}
    intensity={glass.surfaceBlur}
    style={styles.controlPanel}
    contentStyle={styles.controlPanelInner}
  >
    <PressScale
      onPress={onPlay}
      style={styles.playButton}
      accessibilityLabel="Play album"
    >
      <Ionicons name="play" size={20} color={palette.background} />
      <AuraText variant="headline" style={styles.playButtonText}>
        Play
      </AuraText>
    </PressScale>
    <PressScale
      onPress={onShuffle}
      style={[styles.iconButton, isShuffle && styles.activeIconButton]}
      accessibilityLabel="Shuffle album"
    >
      <Ionicons
        name="shuffle"
        size={20}
        color={isShuffle ? palette.primary : palette.ink}
      />
    </PressScale>
    <PressScale
      onPress={onShare}
      style={styles.iconButton}
      accessibilityLabel="Share album"
    >
      <Ionicons name="share-social-outline" size={20} color={palette.ink} />
    </PressScale>
    <DownloadAlbumButton
      tracks={tracks.map((t: any) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        art: t.art || "",
        album: albumTitle,
        albumId: albumId,
        url: "",
        duration: parseDuration(t.duration),
      }))}
    />
  </LiquidGlass>
));

const CreditsSection = memo(({ album }: { album: AlbumDetails }) => (
  <View style={styles.creditsContainer}>
    <View style={styles.creditsDivider} />
    <AuraText variant="caption" muted style={styles.creditsText}>
      Released {album.year}
    </AuraText>
    <AuraText variant="caption" muted style={styles.creditsText}>
      © {album.year} {album.artist}
    </AuraText>
    <View style={styles.bottomSpacing} />
  </View>
));

// ─── Skeletons ────────────────────────────────────────────────────────────────

const HeroSkeleton = () => {
  const { width } = useWindowDimensions();
  const heroSize = width * 0.65;
  return (
    <View style={styles.heroSkeleton}>
      <SkeletonBlock
        style={{
          width: heroSize,
          height: heroSize,
          borderRadius: radius.xl,
          marginBottom: 24,
        }}
      />
      <SkeletonBlock
        style={{
          width: width * 0.5,
          height: 32,
          borderRadius: 8,
          marginBottom: 12,
        }}
      />
      <SkeletonBlock
        style={{ width: width * 0.3, height: 20, borderRadius: 6 }}
      />
    </View>
  );
};

const ControlsSkeleton = () => (
  <View style={styles.actionRow}>
    <SkeletonBlock style={{ flex: 2, height: 54, borderRadius: 27 }} />
    <SkeletonBlock style={{ flex: 1, height: 54, borderRadius: 27 }} />
    <SkeletonBlock style={{ width: 54, height: 54, borderRadius: 27 }} />
  </View>
);

const TracksSkeleton = () => (
  <View style={{ paddingHorizontal: 20, gap: 10, marginTop: 24 }}>
    {Array.from({ length: 6 }).map((_, i) => (
      <SkeletonBlock key={i} style={{ height: 72, borderRadius: radius.md }} />
    ))}
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scrollView: { flex: 1 },
  pageTransition: { flex: 1 },
  contentContainer: { paddingBottom: 100 },
  loadingContent: { paddingTop: 60, alignItems: "center" },

  headerOverlay: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
    left: 18,
    right: 18,
    zIndex: 120,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  headerGlassButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  headerSpacer: {
    width: 46,
    height: 46,
  },

  stickyHeader: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 30 : 24,
  },
  stickyHeaderGlass: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    elevation: 10,
    backgroundColor: "rgba(18,17,28,0.72)",
  },
  stickyHeaderContent: {
    paddingTop: Platform.OS === "ios" ? 28 : 20,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  },
  stickyTitle: { fontSize: 15, fontWeight: "700", letterSpacing: -0.3 },
  stickyPlayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  heroSection: { paddingTop: 80, alignItems: "center", marginBottom: 32 },
  heroImageContainer: {
    borderRadius: radius.xl,
    overflow: "hidden",
    marginBottom: 28,
    backgroundColor: palette.backgroundRaised,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
  },
  heroImage: { width: "100%", height: "100%" },
  heroInfo: { alignItems: "center", paddingHorizontal: 32 },
  albumTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  artistLink: { marginBottom: 10 },
  artistName: { color: palette.primary, fontSize: 18, fontWeight: "600" },
  albumMeta: { letterSpacing: 1 },

  controlPanel: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(22,21,34,0.6)",
  },
  controlPanelInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  playButton: {
    flex: 1.9,
    minHeight: 56,
    borderRadius: 29,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  playButtonText: {
    color: palette.background,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconButton: {
    backgroundColor: "rgba(191,90,242,0.15)",
    borderColor: "rgba(191,90,242,0.3)",
  },

  sectionHeader: { paddingHorizontal: 24, marginBottom: 16 },
  trackItem: { paddingHorizontal: 12, marginBottom: 4 },

  creditsContainer: { paddingHorizontal: 24, marginTop: 32 },
  creditsDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 20,
  },
  creditsText: { marginBottom: 4 },
  bottomSpacing: { height: 160 },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorTitle: { marginTop: 20, marginBottom: 10 },
  errorText: { textAlign: "center", marginBottom: 30, opacity: 0.7 },
  retryButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginBottom: 20,
  },
  retryText: { color: palette.ink, fontWeight: "700" },
  errorBack: { padding: 10 },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 32,
  },
  heroSkeleton: { paddingTop: 80, alignItems: "center", marginBottom: 32 },
});

export default memo(AlbumScreen);
