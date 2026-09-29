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
  useMemo,
  useRef,
  useState
} from "react";
import { MotionTiming, MotionSpring, MotionEasing } from "@/src/design/motion";
import { ScrollPhysics } from "@/src/design/scroll-physics";
import {
  ActivityIndicator,
  Dimensions,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  withTiming,
  Easing as REasing,
  interpolate,
  Extrapolation,
  runOnJS,
  SharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaybackInsets } from "@/src/hooks/use-playback-insets";

// Core imports
import { useMusicActions, usePlaybackState, useNowPlayingTrack } from "@/src/context/MusicContext";
import { useReducedMotionPreference } from "@/src/hooks/use-accessibility-preferences";
import { useMusicNavigation } from "@/src/navigation/music-navigation";
import { musicService } from "@/src/services/api/music";

// Design system
import { glass, motion, palette, radius, spacing } from "@/src/design/tokens";

// Utils
import { parseDuration, formatDuration } from "@/src/utils/time";
import { getTrackArtwork, getArtworkUrl } from "@/src/features/player/utils/track-identity";
import { resolveArtwork } from "@/src/features/player/utils/artwork-resolver";
import { requestIdleTask } from "@/src/utils/idle-task";

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
import { AuraArtwork } from "@/src/components/ui/aura-artwork";

// Types
import { AlbumDetails, MusicTrack } from "@/src/types/music";

const CACHE_PREFIX = "album_cache_";
const IN_MEMORY_CACHE: Record<string, AlbumDetails> = {};

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as any;

function AlbumScreen() {
  const params = useLocalSearchParams();
  const { bottomPadding } = usePlaybackInsets();
  const router = useRouter();
  const width = SCREEN_WIDTH;
  const height = SCREEN_HEIGHT;
  const reduceMotion = useReducedMotionPreference();
  const navigation = useMusicNavigation("album");
  const { isPlaying, isShuffle } = usePlaybackState();
  const currentTrack = useNowPlayingTrack();
  const { setQueue, toggleShuffle } = useMusicActions();

  const albumId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [album, setAlbum] = useState<AlbumDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const pageOpacity = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  // Page enter animation
  useEffect(() => {
    if (reduceMotion) {
      pageOpacity.value = 1;
      return;
    }
    pageOpacity.value = withTiming(1, {
      duration: motion.duration.base,
      easing: REasing.out(REasing.cubic),
    });
  }, [pageOpacity, reduceMotion]);

  // Data Fetching
  const resolveLocalAlbum = useCallback((id: string): AlbumDetails | null => {
    try {
      const decodedName = decodeURIComponent(id.replace("local-album-", "")).toLowerCase().trim();
      
      const { useDownloadStore } = require("@/src/features/download/store/download.store");
      const downloaded = Object.values(useDownloadStore.getState().downloadedTracks || {}) as any[];

      const { usePlaylistStore } = require("@/src/features/playlist/store/playlist.store");
      const playlists = usePlaylistStore.getState().playlists || [];
      const playlistTracks: any[] = [];
      playlists.forEach((pl: any) => {
        if (Array.isArray(pl.tracks)) playlistTracks.push(...pl.tracks);
      });

      const { useAnalyticsStore } = require("@/src/features/analytics/store/analytics.store");
      const history = (useAnalyticsStore.getState().history || []).map((h: any) => h.trackSnapshot || h);

      const allTracks = [...downloaded, ...playlistTracks, ...history];
      const seenIds = new Set<string>();
      const albumTracks: any[] = [];

      for (const t of allTracks) {
        if (!t || !t.id) continue;
        const tAlbum = (t.album || "").toLowerCase().trim();
        const tAlbumId = (t.albumId || "").toLowerCase().trim();

        const matchById = tAlbumId && (tAlbumId === id.toLowerCase() || id.toLowerCase() === tAlbumId);
        const matchByName = tAlbum && (
          tAlbum === decodedName ||
          (decodedName.length > 2 && tAlbum.includes(decodedName)) ||
          (tAlbum.length > 2 && decodedName.includes(tAlbum))
        );

        if (matchById || matchByName) {
          if (!seenIds.has(t.id)) {
            seenIds.add(t.id);
            albumTracks.push(t);
          }
        }
      }

      if (albumTracks.length === 0) return null;

      const first = albumTracks[0];
      return {
        id: id,
        title: first.album || decodeURIComponent(id.replace("local-album-", "")),
        artist: first.artist || "Unknown Artist",
        year: first.year || new Date(first.downloadedAt || Date.now()).getFullYear().toString(),
        thumbnail: first.art || "",
        trackCount: albumTracks.length,
        tracks: albumTracks.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist || first.artist,
          art: t.art || first.art,
          album: t.album || first.album,
          duration: String(t.duration || "0:00"),
          source: t.source || "local"
        }))
      };
    } catch (e) {
      console.warn("[Album Page] Local album resolution error:", e);
      return null;
    }
  }, []);

  const fetchAlbumData = useCallback(async (id: string, useCache = true) => {
    if (!id) return;

    // Use requestIdleTask to ensure the transition animation completes before starting heavy work
    requestIdleTask(async () => {
      // 1. Check local prefix or local match
      if (id.startsWith("local-album-")) {
        setIsLoading(true);
        const localAlbum = resolveLocalAlbum(id);
        if (localAlbum) {
          setAlbum(localAlbum);
          setIsLoading(false);
          setError(null);
          return;
        } else {
          setError("Local album has no downloaded tracks.");
          setIsLoading(false);
          return;
        }
      }

      // 2. Check Memory Cache
      if (useCache && IN_MEMORY_CACHE[id]) {
        setAlbum(IN_MEMORY_CACHE[id]);
        setIsLoading(false);
        return;
      }

      // 3. Check AsyncStorage Cache
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

      // 4. Check Network Status
      const { useNetworkStore } = require("@/src/features/network/store/network.store");
      const isOnline = useNetworkStore.getState().isOnline;

      if (!isOnline) {
        const local = resolveLocalAlbum(id);
        if (local) {
          setAlbum(local);
          IN_MEMORY_CACHE[id] = local;
          setIsLoading(false);
          setError(null);
          return;
        } else {
          setAlbum(null);
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      try {
        let targetBrowseId = id;
        let data = null;

        if (targetBrowseId.startsWith("MPREb_") || targetBrowseId.startsWith("FEmusic_") || targetBrowseId.startsWith("VL")) {
          data = await musicService.getAlbumDetails(targetBrowseId);
        } else {
          // If id is an album title, look up the album browseId first
          const albumEntity = await musicService.lookupAlbumByName(targetBrowseId);
          if (albumEntity?.id) {
            targetBrowseId = albumEntity.id;
            data = await musicService.getAlbumDetails(targetBrowseId);
          }
        }

        // Fallback: If not found yet and id wasn't an MPREb_ browseId, try lookupAlbumByName
        if (!data && !id.startsWith("MPREb_")) {
          const albumEntity = await musicService.lookupAlbumByName(id);
          if (albumEntity?.id) {
            data = await musicService.getAlbumDetails(albumEntity.id);
          }
        }

        if (data) {
          setAlbum(data);
          IN_MEMORY_CACHE[id] = data;
          IN_MEMORY_CACHE[targetBrowseId] = data;
          await AsyncStorage.setItem(CACHE_PREFIX + id, JSON.stringify(data));
        } else {
          const local = resolveLocalAlbum(id);
          if (local) {
            setAlbum(local);
            setError(null);
          } else {
            setError("Album not found.");
          }
        }
      } catch (e: any) {
        console.warn("[Album Page] Remote fetch failed, trying local resolution:", e?.message || e);
        const local = resolveLocalAlbum(id);
        if (local) {
          setAlbum(local);
          setError(null);
        } else {
          setError(e?.message || "Unable to load album details.");
        }
      } finally {
        setIsLoading(false);
      }
    });
  }, [resolveLocalAlbum]);

  useEffect(() => {
    fetchAlbumData(albumId as string);
  }, [albumId, fetchAlbumData]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useAnimatedReaction(
    () => scrollY.value > 100,
    (isSticky, wasSticky) => {
      if (isSticky !== wasSticky) {
        runOnJS(setShowSticky)(isSticky);
      }
    }
  );

  const handlePlayTrack = useCallback(
    (track: MusicTrack, index: number) => {
      if (!album || !album.tracks) return;
      setQueue(
        album.tracks.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist || album.artist,
          art: t.art || album.thumbnail,
          url: "",
          duration: parseDuration(t.duration),
          source: t.source || "album",
          album: album.title,
          albumId: album.id,
          artistId: (t as any).artistId || (album as any).artistId,
        })),
        index,
      );
    },
    [album, setQueue],
  );

  const handlePlayAlbum = useCallback(() => {
    if (!album || !album.tracks || album.tracks.length === 0) return;
    handlePlayTrack(album.tracks[0], 0);
  }, [album, handlePlayTrack]);

  const albumTracksForDownload: any[] = useMemo(() => {
    if (!album || !album.tracks) return [];
    return album.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist || album.artist,
      art: t.art || album.thumbnail || "",
      url: t.url || "",
      duration: parseDuration(t.duration),
      album: album.title,
      albumId: album.id,
      artistId: (t as any).artistId || (album as any).artistId,
      source: "album",
    }));
  }, [album]);

  const stickyHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 160], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [80, 160],
          [-10, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const headerOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 100], [1, 0], Extrapolation.CLAMP),
  }));

  const pageStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
    transform: [
      {
        scale: interpolate(
          pageOpacity.value,
          [0, 1],
          [0.98, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const renderTrackItem = useCallback(
    ({ item, index }: { item: MusicTrack; index: number }) => (
      <Materialise delay={index * 40} style={styles.trackItemWrapper}>
        <MediaListItem
          title={item.title}
          subtitle={item.artist}
          image={item.art || album?.thumbnail || ""}
          meta={formatDuration(parseDuration(item.duration))}
          active={currentTrack?.id === item.id}
          onPress={() => handlePlayTrack(item, index)}
          downloadable
          track={{
             id: item.id,
             title: item.title,
             artist: item.artist,
             art: item.art || album?.thumbnail || "",
             url: item.url || "",
             duration: parseDuration(item.duration),
             album: album?.title,
             albumId: album?.id,
             artistId: (item as any).artistId || (album as any)?.artistId,
          }}
        />
      </Materialise>
    ),
    [currentTrack?.id, handlePlayTrack, album],
  );

  const renderSkeleton = () => (
    <View style={styles.heroSkeleton}>
      <SkeletonBlock
        style={{
          width: width * 0.65,
          height: width * 0.65,
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

  if (error) {
    return (
      <View style={styles.container}>
        <AtmosphericBackground />
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={palette.primary}
          />
          <AuraText variant="headline" style={styles.errorText}>
            {error}
          </AuraText>
          <TouchableOpacity
            onPress={() => fetchAlbumData(albumId as string)}
            style={styles.retryButton}
          >
            <AuraText variant="body" style={styles.retryText}>
              Retry
            </AuraText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!album && isLoading) {
    return (
      <View style={styles.container}>
        <AtmosphericBackground />
        {renderSkeleton()}
      </View>
    );
  }

  if (!album) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="disc-outline" size={48} color="#ffffff80" />
        <AuraText variant="headline" style={{ color: '#fff', marginTop: 16 }}>Album unavailable</AuraText>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#ffffff20', borderRadius: 24 }}>
          <AuraText variant="body" style={{ color: '#fff' }}>Return Home</AuraText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AtmosphericBackground colors={album.tracks && album.tracks.length > 0 ? album.tracks[0]?.dominantColors : undefined} />

      {/* Floating Header Overlay (Back Button) */}
      <Animated.View
        style={[styles.headerOverlay, headerOverlayStyle]}
        pointerEvents={showSticky ? "none" : "auto"}
      >
        <PressScale
          onPress={() => router.back()}
          style={styles.headerGlassButton}
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color={palette.ink} />
        </PressScale>
      </Animated.View>

      {/* Sticky Header */}
      <Animated.View
        style={[styles.stickyHeader, stickyHeaderStyle]}
        pointerEvents={showSticky ? "auto" : "none"}
      >
        <LiquidGlass
          intensity={glass.navBlur}
          borderRadius={radius.xl}
          gradient
          style={styles.stickyHeaderGlass}
          contentStyle={styles.stickyHeaderContent}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={palette.ink} />
          </TouchableOpacity>
          <AuraText variant="headline" numberOfLines={1} style={styles.stickyTitle}>
            {album.title}
          </AuraText>
          <View style={{ width: 44 }} />
        </LiquidGlass>
      </Animated.View>

      <Animated.View style={[styles.pageTransition, pageStyle]}>
        <AnimatedFlashList
          data={album.tracks || []}
          renderItem={renderTrackItem}
          keyExtractor={(item: any) => item.id}
          onScroll={scrollHandler}
          {...ScrollPhysics.STANDARD}
          ListHeaderComponent={
            <>
              <HeroSection album={album} scrollY={scrollY} />
              <ActionButtons
                onPlay={handlePlayAlbum}
                onShuffle={() => toggleShuffle()}
                isShuffle={isShuffle}
                tracks={albumTracksForDownload}
              />
            </>
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
  ({ album, scrollY }: { album: AlbumDetails; scrollY: SharedValue<number> }) => {
    const heroSize = SCREEN_WIDTH * 0.65;

    const heroStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: interpolate(scrollY.value, [-100, 0, 150], [1.1, 1, 0.9], Extrapolation.CLAMP) },
        { translateY: interpolate(scrollY.value, [0, 200], [0, 40], Extrapolation.CLAMP) }
      ]
    }));

    return (
      <View style={styles.heroSection}>
        <Animated.View
          style={[
            styles.heroImageContainer,
            {
              width: heroSize,
              height: heroSize,
            },
            heroStyle
          ]}
        >
          <AuraArtwork
            source={resolveArtwork({ art: album.thumbnail, title: album.title }, 'album')}
            entityName={album.title}
            entityType="album"
            style={styles.heroImage}
            contentFit="cover"
            transition={400}
            cachePolicy="memory-disk"
            borderRadius={radius.xl}
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
            {album.type?.toUpperCase() || 'ALBUM'} • {album.year} • {album.trackCount}{" "}
            SONGS
          </AuraText>
        </View>
      </View>
    );
  },
);

const ActionButtons = memo(({ onPlay, onShuffle, isShuffle, tracks }: any) => (
  <LiquidGlass
    borderRadius={radius.xl}
    intensity={glass.surfaceBlur}
    style={styles.controlPanel}
    contentStyle={styles.controlPanelInner}
  >
    <PressScale
      onPress={onPlay}
      wrapperStyle={styles.playButton}
      style={styles.innerButton}
      accessibilityLabel="Play album"
    >
      <Ionicons name="play" size={20} color={palette.background} />
      <AuraText variant="headline" style={styles.playButtonText}>
        Play
      </AuraText>
    </PressScale>
    <PressScale
      onPress={onShuffle}
      wrapperStyle={[styles.iconButton, isShuffle && styles.activeIconButton]}
      style={styles.innerButton}
      accessibilityLabel="Shuffle album"
    >
      <Ionicons
        name="shuffle"
        size={20}
        color={isShuffle ? palette.primary : palette.ink}
      />
    </PressScale>
    <DownloadAlbumButton
        tracks={tracks}
        style={styles.downloadButton}
    />
  </LiquidGlass>
));

const CreditsSection = memo(({ album }: { album: AlbumDetails }) => (
  <View style={styles.creditsSection}>
    <AuraText variant="caption" muted style={styles.creditsTitle}>
      ALBUM CREDITS
    </AuraText>
    <AuraText variant="body" muted style={styles.creditsText}>
      Released by {album.artist} • © {album.year} AuraMusic Cinematic
    </AuraText>
  </View>
));

const Materialise = ({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      style={style}
    >
      {children}
    </Animated.View>
  );
};

import { FadeInDown } from "react-native-reanimated";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  pageTransition: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 40,
    paddingHorizontal: 0,
  },
  heroImageContainer: {
    borderRadius: radius.xl,
    backgroundColor: palette.backgroundRaised,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    marginBottom: 32,
  },
  heroImage: {
    flex: 1,
  },
  heroInfo: {
    alignItems: "center",
  },
  albumTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  artistLink: {
    marginBottom: 12,
  },
  artistName: {
    color: palette.primary,
  },
  albumMeta: {
    letterSpacing: 1.5,
  },
  controlPanel: {
    marginHorizontal: 0,
    marginBottom: 32,
  },
  controlPanelInner: {
    flexDirection: "row",
    padding: 8,
    gap: 8,
  },
  playButton: {
    flex: 2,
    height: 52,
    backgroundColor: palette.primary,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  playButtonText: {
    color: palette.background,
  },
  iconButton: {
    flex: 1,
    height: 52,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  activeIconButton: {
    backgroundColor: "rgba(191,90,242,0.15)",
  },
  downloadButton: {
    // Manually adjust the width / flex of the download button here:
    flex: 1, // Set to 0 if you want a fixed width (e.g. width: 52)
    width: undefined, // E.g. set to 52 for a fixed-width button
    height: 52,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  innerButton: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
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
    backgroundColor: "rgba(10,10,18,0.44)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  creditsSection: {
    paddingVertical: 24,
    opacity: 0.6,
  },
  trackItemWrapper: {
    marginBottom: 10,
  },
  creditsTitle: {
    marginBottom: 8,
    letterSpacing: 1.2,
  },
  creditsText: {
    lineHeight: 20,
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 48 : 32,
    paddingBottom: 8,
  },
  stickyHeaderGlass: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    elevation: 12,
  },
  stickyHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyTitle: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    marginTop: 20,
    textAlign: "center",
    opacity: 0.8,
  },
  retryButton: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: palette.primary,
    borderRadius: 24,
  },
  retryText: {
    color: palette.background,
    fontWeight: "700",
  },
  heroSkeleton: {
    paddingTop: 80,
    alignItems: "center",
    marginBottom: 32,
  },
});

export default memo(AlbumScreen);
