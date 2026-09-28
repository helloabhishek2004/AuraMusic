import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedReanimated, {
  Easing as EasingReanimated,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { usePlaybackInsets } from '@/src/hooks/use-playback-insets';
import { usePressScale } from '@/src/components/ui/press-scale';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import { resolveArtwork } from '@/src/features/player/utils/artwork-resolver';
import { ScrollPhysics } from '@/src/design/scroll-physics';
import {
  CachedConnectedPlaylist,
  ConnectedPlaylist,
  ExternalTrack,
  hydrateConnectedPlaylist,
  isPlaylistCacheStale,
  PROVIDER_METAS,
  useConnectedLibrariesStore,
} from '@/src/features/connected-libraries';
import { useMusicControls } from '@/src/context/MusicContext';
import { usePlayerStore } from '@/src/features/player/store/player.store';
import { useLikesStore } from '@/src/features/likes/store/likes.store';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import { PlayerTrack } from '@/src/features/player/types/player';
import { formatDuration } from '@/src/utils/time';

const AnimatedFlashList = AnimatedReanimated.createAnimatedComponent(
  FlashList
) as any;

const { width: SW } = Dimensions.get('window');

const C = {
  primary: '#BF5AF2',
  primaryMid: '#9B38DA',
  primaryDeep: '#7B2FBE',
  accent: '#46f5e0',
  bg: '#08080D',
  text: '#FFFFFF',
  muted: 'rgba(170,170,185,0.65)',
  surface: 'rgba(18,16,26,0.85)',
  surfaceDense: 'rgba(24,20,36,0.92)',
  border: 'rgba(255,255,255,0.08)',
} as const;

const GLASS = {
  frost: 'rgba(255,255,255,0.07)',
  frostMid: 'rgba(255,255,255,0.11)',
  borderSubtle: 'rgba(255,255,255,0.10)',
  specularTop: 'rgba(255,255,255,0.28)',
  specularLeft: 'rgba(255,255,255,0.18)',
  refractionTint: 'rgba(191,90,242,0.06)',
};

const hexToRgba = (color: string, a: number) => {
  if (!color) return `rgba(255,255,255,${a})`;
  if (color.startsWith('rgba')) return color.replace(/[\d\.]+\)$/g, `${a})`);
  if (color.startsWith('rgb')) return color.replace('rgb', 'rgba').replace(')', `, ${a})`);
  const hex = color.replace('#', '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return `rgba(255,255,255,${a})`;
};

// ── Flagship Liquid Glass Surface Matching [id].tsx ──────────────────────────
const LiquidGlassSurface = memo(
  ({
    style,
    children,
    borderRadius = 20,
    blurIntensity = 55,
    glowColor = C.primary,
    glowOpacity = 0,
    showLeftGlow = false,
  }: {
    style?: any;
    children?: React.ReactNode;
    borderRadius?: number;
    blurIntensity?: number;
    glowColor?: string;
    glowOpacity?: number;
    showLeftGlow?: boolean;
    enableRipple?: boolean;
  }) => {
    return (
      <View
        style={[
          glassStyles.surface,
          {
            borderRadius,
            borderColor: GLASS.borderSubtle,
            borderWidth: 1,
          },
          style,
        ]}
      >
        <BlurView
          intensity={blurIntensity}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius, backgroundColor: GLASS.refractionTint },
          ]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[GLASS.frostMid, GLASS.frost, 'rgba(255,255,255,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          pointerEvents="none"
        />
        <View
          style={[
            glassStyles.topSpecular,
            { borderTopLeftRadius: borderRadius, borderTopRightRadius: borderRadius },
          ]}
          pointerEvents="none"
        />
        {showLeftGlow && (
          <View
            style={[
              glassStyles.leftGlowCore,
              {
                borderTopLeftRadius: borderRadius,
                borderBottomLeftRadius: borderRadius,
                backgroundColor: glowColor,
                opacity: glowOpacity || 0.35,
              },
            ]}
            pointerEvents="none"
          />
        )}
        {children}
      </View>
    );
  }
);

// ── Track Row Item with Intentional Staggered Entry Animation & Download Icon ─
const ConnectedTrackRowItem = memo(
  ({
    track,
    index,
    isCurrent,
    isPlaying,
    liked,
    isDownloaded,
    isDownloading,
    onPress,
    onLike,
    onDownload,
  }: {
    track: PlayerTrack;
    index: number;
    isCurrent: boolean;
    isPlaying: boolean;
    liked: boolean;
    isDownloaded: boolean;
    isDownloading: boolean;
    onPress: (track: PlayerTrack, index: number) => void;
    onLike: (track: PlayerTrack) => void;
    onDownload: (track: PlayerTrack) => void;
  }) => {
    const enterAnim = useSharedValue(0);

    useEffect(() => {
      // Stagger only the first 14 visible rows for instant, snappy entrance
      const delay = Math.min(index * 22, 280);
      enterAnim.value = withDelay(
        delay,
        withSpring(1, { damping: 20, stiffness: 220 })
      );
    }, [index, enterAnim]);

    const rowStyle = useAnimatedStyle(() => ({
      opacity: enterAnim.value,
      transform: [
        {
          translateY: interpolate(enterAnim.value, [0, 1], [14, 0], Extrapolation.CLAMP),
        },
      ],
    }));

    return (
      <AnimatedReanimated.View style={rowStyle}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onPress(track, index)}
          style={[styles.trackRow, isCurrent && styles.trackRowActive]}
        >
          {/* Track index or animated equalizer icon */}
          <View style={styles.indexCol}>
            {isPlaying && isCurrent ? (
              <Ionicons name="volume-high" size={16} color={C.primary} />
            ) : (
              <Text
                style={[
                  styles.indexText,
                  isCurrent && { color: C.primary, fontWeight: '700' },
                ]}
              >
                {index + 1}
              </Text>
            )}
          </View>

          {/* Thumbnail artwork */}
          <View style={styles.trackThumbFrame}>
            <AuraArtwork
              source={resolveArtwork(track, 'card')}
              entityName={track.title}
              entityType="song"
              style={styles.trackThumb}
              borderRadius={10}
            />
          </View>

          {/* Title & Artist */}
          <View style={styles.trackInfoCol}>
            <Text
              numberOfLines={1}
              style={[styles.trackTitle, isCurrent && { color: C.primary }]}
            >
              {track.title}
            </Text>
            <Text numberOfLines={1} style={styles.trackArtist}>
              {track.artist}
            </Text>
          </View>

          {/* Duration */}
          {track.duration ? (
            <Text style={styles.durationText}>
              {formatDuration(Math.round(track.duration / 1000))}
            </Text>
          ) : null}

          {/* Download button with status */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onDownload(track)}
            style={styles.actionIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isDownloading ? (
              <ActivityIndicator
                size="small"
                color={C.accent}
                style={{ transform: [{ scale: 0.75 }] }}
              />
            ) : (
              <Ionicons
                name={isDownloaded ? 'cloud-done' : 'arrow-down-circle-outline'}
                size={18}
                color={isDownloaded ? C.accent : 'rgba(255,255,255,0.35)'}
              />
            )}
          </TouchableOpacity>

          {/* Like button with soft intentional haptics */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onLike(track)}
            style={styles.actionIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={18}
              color={liked ? C.primary : 'rgba(255,255,255,0.3)'}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </AnimatedReanimated.View>
    );
  }
);

// ── Hero & Header Sub-component ───────────────────────────────────────────────
const ConnectedPlaylistHeader = memo(
  ({
    playlist,
    meta,
    gradientColors,
    trackCount,
    playableCount,
    isSyncing,
    isLoading,
    error,
    hasResolvedTracks,
    isCurrentPlaylistPlaying,
    isShuffle,
    downloadStatus,
    downloadPress,
    downloadSpinStyle,
    shufflePress,
    playPress,
    playGlowStyle,
    playGlowRingStyle,
    onDownloadPlaylist,
    onPlayAll,
    onRetry,
  }: {
    playlist: ConnectedPlaylist;
    meta: any;
    gradientColors: [string, string];
    trackCount: number;
    playableCount: number;
    isSyncing: boolean;
    isLoading: boolean;
    error: string | null;
    hasResolvedTracks: boolean;
    isCurrentPlaylistPlaying: boolean;
    isShuffle: boolean;
    downloadStatus: 'none' | 'downloading' | 'updated';
    downloadPress: any;
    downloadSpinStyle: any;
    shufflePress: any;
    playPress: any;
    playGlowStyle: any;
    playGlowRingStyle: any;
    onDownloadPlaylist: () => void;
    onPlayAll: (shuffle: boolean) => void;
    onRetry: () => void;
  }) => {
    return (
      <View style={styles.heroSection}>
        {/* Artwork Card with Ambient Glow */}
        <View style={styles.artWrapper}>
          <View
            style={[
              styles.artAmbientGlow,
              {
                backgroundColor: gradientColors[0],
                shadowColor: gradientColors[0],
              },
            ]}
            pointerEvents="none"
          />
          <View style={styles.artGlassFrame}>
            {playlist.coverUrl ? (
              <Image
                source={{ uri: playlist.coverUrl }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={250}
              />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, styles.artPlaceholder]}>
                <Ionicons name="musical-notes" size={54} color="rgba(255,255,255,0.25)" />
              </View>
            )}

            {/* Specular overlay */}
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'transparent', 'rgba(0,0,0,0.6)']}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        </View>

        {/* Provider Badge */}
        <View
          style={[
            styles.providerBadge,
            { borderColor: meta.brandBorderColor, backgroundColor: meta.brandBgColor },
          ]}
        >
          <View style={[styles.providerDot, { backgroundColor: meta.brandColor }]} />
          <Text style={styles.providerBadgeText}>{meta.name}</Text>
        </View>

        {/* Playlist Title */}
        <Text style={styles.playlistTitle}>{playlist.title}</Text>

        {/* Metadata Subtitle */}
        <View style={styles.metaRow}>
          <Text style={styles.playlistSub}>
            {trackCount > 0 ? `${trackCount} tracks` : `${playlist.trackCount} tracks`}
            {playableCount > 0 && playableCount !== trackCount
              ? ` · ${playableCount} playable`
              : ''}
          </Text>

          {/* Non-blocking Syncing Badge */}
          {isSyncing && (
            <View style={styles.syncingBadge}>
              <ActivityIndicator
                size="small"
                color={C.accent}
                style={{ transform: [{ scale: 0.7 }], marginRight: 4 }}
              />
              <Text style={styles.syncingBadgeText}>Updating...</Text>
            </View>
          )}
        </View>

        {/* Re-used Exact AuraMusic Control Section: Download + Shuffle All + Play */}
        {hasResolvedTracks && (
          <View style={[styles.controlSection, { paddingHorizontal: 0, marginTop: 10, marginBottom: 12 }]}>
            {/* Playlist Download Button */}
            <AnimatedReanimated.View style={[styles.downloadBtnOuter, downloadPress.style]}>
              <TouchableOpacity
                onPress={onDownloadPlaylist}
                onPressIn={downloadPress.onIn}
                onPressOut={downloadPress.onOut}
                activeOpacity={1}
                style={{ flex: 1 }}
              >
                <LiquidGlassSurface
                  style={styles.downloadSurface}
                  borderRadius={31}
                  glowColor={downloadStatus === 'updated' ? C.accent : C.primary}
                  glowOpacity={downloadStatus === 'updated' ? 0.25 : 0}
                  showLeftGlow={downloadStatus === 'updated'}
                >
                  {downloadStatus === 'downloading' ? (
                    <AnimatedReanimated.View style={downloadSpinStyle}>
                      <Ionicons name="sync" size={24} color={C.accent} />
                    </AnimatedReanimated.View>
                  ) : (
                    <Ionicons
                      name={downloadStatus === 'updated' ? 'cloud-done' : 'download-outline'}
                      size={24}
                      color={downloadStatus === 'updated' ? C.accent : '#FFF'}
                    />
                  )}
                </LiquidGlassSurface>
              </TouchableOpacity>
            </AnimatedReanimated.View>

            {/* Shuffle All Button */}
            <AnimatedReanimated.View style={[styles.shuffleBtnOuter, shufflePress.style]}>
              <TouchableOpacity
                onPress={() => onPlayAll(true)}
                onPressIn={shufflePress.onIn}
                onPressOut={shufflePress.onOut}
                activeOpacity={1}
                style={{ flex: 1 }}
              >
                <LiquidGlassSurface
                  style={styles.shuffleSurface}
                  borderRadius={31}
                  glowColor={isShuffle ? gradientColors[0] : C.primary}
                  glowOpacity={isShuffle ? 0.25 : 0}
                  showLeftGlow={isShuffle}
                >
                  {isShuffle && (
                    <LinearGradient
                      colors={[
                        hexToRgba(gradientColors[0], 0.55),
                        hexToRgba(gradientColors[0], 0.3),
                        'transparent',
                      ]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Ionicons
                    name="shuffle"
                    size={28}
                    color={isShuffle ? '#FFF' : 'rgba(255,255,255,0.35)'}
                  />
                  <Text
                    style={[
                      styles.shuffleLabel,
                      !isShuffle && { color: 'rgba(255,255,255,0.35)' },
                    ]}
                  >
                    Shuffle All
                  </Text>
                </LiquidGlassSurface>
              </TouchableOpacity>
            </AnimatedReanimated.View>

            {/* Flagship Play Button */}
            <View style={styles.playBtnWrapper}>
              <AnimatedReanimated.View
                style={[
                  styles.playBtnGlow,
                  { backgroundColor: gradientColors[0] },
                  playGlowStyle,
                ]}
              />
              <AnimatedReanimated.View
                style={[
                  styles.playBtnGlowRing,
                  { borderColor: hexToRgba(gradientColors[0], 0.22) },
                  playGlowRingStyle,
                ]}
              />
              <AnimatedReanimated.View style={playPress.style}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={playPress.onIn}
                  onPressOut={playPress.onOut}
                  onPress={() => onPlayAll(false)}
                  style={styles.playBtnShell}
                >
                  <LinearGradient
                    colors={[gradientColors[0], C.primaryMid, C.primaryDeep]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons
                    name={isCurrentPlaylistPlaying ? 'pause' : 'play'}
                    size={34}
                    color="#FFF"
                    style={{ marginLeft: isCurrentPlaylistPlaying ? 0 : 4 }}
                  />
                </TouchableOpacity>
              </AnimatedReanimated.View>
            </View>
          </View>
        )}

        {/* Loading Spinner for Uncached First Open */}
        {isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>Importing {meta.name} playlist...</Text>
          </View>
        )}

        {/* Error View */}
        {error && !isLoading && !hasResolvedTracks && (
          <View style={styles.errorWrap}>
            <Ionicons
              name="alert-circle-outline"
              size={32}
              color="#F87171"
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onRetry}
              style={styles.retryBtn}
            >
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
);

interface ConnectedPlaylistViewProps {
  playlist: ConnectedPlaylist;
  onBack: () => void;
}

export const ConnectedPlaylistView = memo(function ConnectedPlaylistView({
  playlist,
  onBack,
}: ConnectedPlaylistViewProps) {
  const insets = useSafeAreaInsets();
  const { bottomPadding } = usePlaybackInsets();
  const { setQueue, toggleShuffle, isShuffle, isPlaying, pause, play } = useMusicControls();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const activeContext = usePlayerStore((s) => s.activeContext);
  const isCurrentPlaylistActive =
    activeContext?.type === 'playlist' && activeContext?.id === playlist.externalId;
  const isCurrentPlaylistPlaying = isCurrentPlaylistActive && isPlaying;

  const meta = PROVIDER_METAS[playlist.providerId] || PROVIDER_METAS.ytmusic;
  const gradientColors: [string, string] = useMemo(
    () => [meta.brandColor || C.primary, C.primaryDeep],
    [meta.brandColor]
  );

  // Download store state & subscriptions
  const downloadedTracks = useDownloadStore((s) => s.downloadedTracks);
  const activeTasks = useDownloadStore((s) => s.activeTasks);

  // Cached state from store (instant synchronous load)
  const getCachedPlaylist = useConnectedLibrariesStore((s) => s.getCachedPlaylist);
  const cachedData = useMemo(
    () => getCachedPlaylist(playlist.providerId, playlist.externalId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playlist.providerId, playlist.externalId]
  );

  const [rawExternalTracks, setRawExternalTracks] = useState<ExternalTrack[]>(
    () => cachedData?.externalTracks || playlist.tracks || []
  );
  const [resolvedTracks, setResolvedTracks] = useState<PlayerTrack[]>(
    () => cachedData?.resolvedTracks || []
  );
  const [isLoading, setIsLoading] = useState(
    () => !cachedData && !playlist.tracks?.length
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced back navigation to guarantee single-click exit
  const isGoingBackRef = useRef(false);
  const handleBack = useCallback(() => {
    if (isGoingBackRef.current) return;
    isGoingBackRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onBack();
    setTimeout(() => {
      isGoingBackRef.current = false;
    }, 600);
  }, [onBack]);

  const likedTrackIds = useLikesStore((s) => s.likedTrackIds);
  const toggleLike = useLikesStore((s) => s.toggleLike);
  const isLiked = useCallback((id: string) => !!likedTrackIds[id], [likedTrackIds]);

  // Overall playlist download status
  const downloadStatus: 'none' | 'downloading' | 'updated' = useMemo(() => {
    if (!resolvedTracks || resolvedTracks.length === 0) return 'none';
    const isAllDownloaded = resolvedTracks.every((t) => !!downloadedTracks[t.id]);
    if (isAllDownloaded) return 'updated';
    const isAnyDownloading = resolvedTracks.some(
      (t) => !!activeTasks[t.id] && activeTasks[t.id].status !== 'failed'
    );
    if (isAnyDownloading) return 'downloading';
    return 'none';
  }, [resolvedTracks, downloadedTracks, activeTasks]);

  // Animated values for scroll, controls and download
  const scrollY = useSharedValue(0);
  const glowPulse = useSharedValue(0.5);
  const glowScale = useSharedValue(1.0);
  const downloadSpin = useSharedValue(0);

  const shufflePress = usePressScale();
  const playPress = usePressScale();
  const downloadPress = usePressScale();

  useEffect(() => {
    glowPulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    glowScale.value = withRepeat(withTiming(1.3, { duration: 900 }), -1, true);
  }, [glowPulse, glowScale]);

  useEffect(() => {
    if (downloadStatus === 'downloading') {
      downloadSpin.value = withRepeat(
        withTiming(1, { duration: 1000, easing: EasingReanimated.linear }),
        -1,
        false
      );
    } else {
      downloadSpin.value = 0;
    }
  }, [downloadStatus, downloadSpin]);

  const downloadSpinStyle = useAnimatedStyle(() => {
    const rotate = interpolate(downloadSpin.value, [0, 1], [0, 360], Extrapolation.CLAMP);
    return { transform: [{ rotate: `${rotate}deg` }] };
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const heroBackButtonStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [40, 110], [1, 0], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [40, 110], [0, -8], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const headerOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [90, 160], [0, 1], Extrapolation.CLAMP);
    return { opacity };
  });

  const playGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0.4, 1], [0.18, 0.38], Extrapolation.CLAMP),
    transform: [{ scale: glowScale.value }],
  }));

  const playGlowRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  // Perform hydration following SWR strategy
  const executeHydration = useCallback(
    async (forceRefresh = false) => {
      const currentCache = getCachedPlaylist(playlist.providerId, playlist.externalId);
      const isStale = isPlaylistCacheStale(currentCache);

      // If we already have fresh cached data and forceRefresh is false, no network needed
      if (!forceRefresh && currentCache && !isStale) {
        setRawExternalTracks(currentCache.externalTracks);
        setResolvedTracks(currentCache.resolvedTracks);
        setIsLoading(false);
        return;
      }

      // If we have cached data (even stale), display it immediately without blocking
      if (currentCache) {
        setRawExternalTracks(currentCache.externalTracks);
        setResolvedTracks(currentCache.resolvedTracks);
        setIsLoading(false);
        setIsSyncing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const result = await hydrateConnectedPlaylist(playlist, { forceRefresh });
        if (result.cachedPlaylist) {
          setRawExternalTracks(result.cachedPlaylist.externalTracks);
          setResolvedTracks(result.cachedPlaylist.resolvedTracks);
        }
        if (!result.success && !currentCache) {
          setError(result.error || 'Failed to load playlist tracks.');
        }
      } catch (err: any) {
        if (!currentCache) {
          setError(err?.message || 'Failed to load tracks.');
        }
      } finally {
        setIsLoading(false);
        setIsSyncing(false);
        setIsRefreshing(false);
      }
    },
    [playlist, getCachedPlaylist]
  );

  // Mount effect: load tracks using SWR
  useEffect(() => {
    executeHydration(false);
  }, [executeHydration]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsRefreshing(true);
    executeHydration(true);
  }, [executeHydration]);

  const handlePlayAll = useCallback(
    async (shuffle = false) => {
      if (resolvedTracks.length === 0) {
        Alert.alert(playlist.title, 'No playable tracks available in this playlist yet.', [
          { text: 'OK' },
        ]);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const store = usePlayerStore.getState();
      store.setActiveContext({
        type: 'playlist',
        id: playlist.externalId,
        name: playlist.title,
      });

      if (isCurrentPlaylistActive) {
        if (shuffle) {
          await toggleShuffle();
        } else {
          isPlaying ? await pause() : await play();
        }
        return;
      }

      if (shuffle && !store.isShuffle) {
        await toggleShuffle();
      }

      await setQueue(resolvedTracks, 0, {
        sourceId: playlist.externalId,
        sourceType: 'playlist',
        generatedAt: Date.now(),
      });
    },
    [
      resolvedTracks,
      isCurrentPlaylistActive,
      isPlaying,
      toggleShuffle,
      pause,
      play,
      setQueue,
      playlist.externalId,
      playlist.title,
    ]
  );

  const handlePlayTrack = useCallback(
    async (track: PlayerTrack, index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      const store = usePlayerStore.getState();
      if (store.currentTrack?.id === track.id) {
        isPlaying ? await pause() : await play();
        return;
      }

      if (isCurrentPlaylistActive && store.queue.length === resolvedTracks.length) {
        await store.jumpToQueueIndex(index);
      } else {
        await setQueue(resolvedTracks, index, {
          sourceId: playlist.externalId,
          sourceType: 'playlist',
          generatedAt: Date.now(),
        });
        store.setActiveContext({
          type: 'playlist',
          id: playlist.externalId,
          name: playlist.title,
        });
      }
    },
    [
      resolvedTracks,
      isCurrentPlaylistActive,
      isPlaying,
      pause,
      play,
      setQueue,
      playlist.externalId,
      playlist.title,
    ]
  );

  const handleTrackLike = useCallback(
    (track: PlayerTrack) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      toggleLike(track);
    },
    [toggleLike]
  );

  // Individual Track Download Handler
  const handleTrackDownload = useCallback((track: PlayerTrack) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const { enqueueDownload, downloadedTracks: dlMap, activeTasks: taskMap } =
      useDownloadStore.getState();

    if (dlMap[track.id]) {
      Alert.alert(track.title, 'This track is already downloaded and available offline.');
      return;
    }
    if (taskMap[track.id] && taskMap[track.id].status !== 'failed') {
      Alert.alert(track.title, 'This track is currently downloading.');
      return;
    }

    enqueueDownload(track, 'HIGH');
  }, []);

  // Playlist Batch Download Handler
  const handleDownloadPlaylist = useCallback(async () => {
    if (!resolvedTracks || resolvedTracks.length === 0) {
      Alert.alert(playlist.title, 'No playable tracks available to download yet.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const { enqueueDownload, downloadedTracks: dlMap } = useDownloadStore.getState();
    const unDownloaded = resolvedTracks.filter((t: PlayerTrack) => !dlMap[t.id]);

    if (unDownloaded.length === 0) {
      Alert.alert('Downloaded', 'All playable tracks in this playlist are already downloaded.');
      return;
    }

    unDownloaded.forEach((track: PlayerTrack) => {
      enqueueDownload(track, 'NORMAL');
    });
  }, [resolvedTracks, playlist.title]);

  const renderTrackItem = useCallback(
    ({ item, index }: { item: PlayerTrack; index: number }) => {
      const isTrackCurrent = currentTrack?.id === item.id;
      const isTrackPlaying = isTrackCurrent && isPlaying;
      const liked = isLiked(item.id);
      const isDownloaded = !!downloadedTracks[item.id];
      const isDownloading =
        !!activeTasks[item.id] && activeTasks[item.id].status !== 'failed';

      return (
        <ConnectedTrackRowItem
          track={item}
          index={index}
          isCurrent={isTrackCurrent}
          isPlaying={isTrackPlaying}
          liked={liked}
          isDownloaded={isDownloaded}
          isDownloading={isDownloading}
          onPress={handlePlayTrack}
          onLike={handleTrackLike}
          onDownload={handleTrackDownload}
        />
      );
    },
    [
      currentTrack?.id,
      isPlaying,
      isLiked,
      downloadedTracks,
      activeTasks,
      handlePlayTrack,
      handleTrackLike,
      handleTrackDownload,
    ]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Atmospheric Sonic Nebula Canvas Background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#08080d' }]} />
        <View
          style={[
            styles.glowBlob,
            { top: '-5%', left: '-25%', backgroundColor: gradientColors[0] },
          ]}
        />
        <View
          style={[
            styles.glowBlob,
            { bottom: '15%', right: '-30%', backgroundColor: gradientColors[1] },
          ]}
        />
        <LinearGradient
          colors={['rgba(8,8,13,0)', 'rgba(8,8,13,0.70)', '#08080d']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Sticky Compact Header (Fades in smoothly on scroll past hero) */}
      <AnimatedReanimated.View
        style={[styles.stickyHeader, { paddingTop: insets.top }, headerOpacityStyle]}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.stickyHeaderInner}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.stickyTitle} numberOfLines={1}>
            {playlist.title}
          </Text>
          <TouchableOpacity
            onPress={() => handlePlayAll(false)}
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isCurrentPlaylistPlaying ? 'pause' : 'play'}
              size={22}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
      </AnimatedReanimated.View>

      {/* Hero Initial Floating Back Button (Fades out when scrolling) */}
      <AnimatedReanimated.View
        style={[styles.floatingHeader, { top: insets.top + 16 }, heroBackButtonStyle]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtnCircle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
      </AnimatedReanimated.View>

      {/* High-Performance Virtualized Animated FlashList */}
      <AnimatedFlashList
        data={resolvedTracks}
        renderItem={renderTrackItem}
        keyExtractor={(item: any, idx: number) => `${item.id}-${idx}`}
        estimatedItemSize={72}
        extraData={`${currentTrack?.id}-${isPlaying ? '1' : '0'}-${Object.keys(activeTasks).length}-${Object.keys(downloadedTracks).length}`}
        onScroll={scrollHandler}
        {...ScrollPhysics.STANDARD}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: bottomPadding + 36,
          paddingHorizontal: 20,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
            progressViewOffset={insets.top + 20}
          />
        }
        ListHeaderComponent={
          <ConnectedPlaylistHeader
            playlist={playlist}
            meta={meta}
            gradientColors={gradientColors}
            trackCount={rawExternalTracks.length}
            playableCount={resolvedTracks.length}
            isSyncing={isSyncing}
            isLoading={isLoading}
            error={error}
            hasResolvedTracks={resolvedTracks.length > 0}
            isCurrentPlaylistPlaying={isCurrentPlaylistPlaying}
            isShuffle={isShuffle && isCurrentPlaylistActive}
            downloadStatus={downloadStatus}
            downloadPress={downloadPress}
            downloadSpinStyle={downloadSpinStyle}
            shufflePress={shufflePress}
            playPress={playPress}
            playGlowStyle={playGlowStyle}
            playGlowRingStyle={playGlowRingStyle}
            onDownloadPlaylist={handleDownloadPlaylist}
            onPlayAll={handlePlayAll}
            onRetry={() => executeHydration(true)}
          />
        }
        ListEmptyComponent={
          !isLoading && !error && rawExternalTracks.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="musical-notes-outline" size={44} color="rgba(255,255,255,0.25)" />
              <Text style={styles.emptyTitle}>Playlist is empty</Text>
              <Text style={styles.emptySub}>
                No tracks were found in this {meta.name} playlist.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
});

const glassStyles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,24,0.45)',
  },
  topSpecular: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
    backgroundColor: GLASS.specularTop,
  },
  leftGlowCore: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  glowBlob: {
    position: 'absolute',
    width: SW * 1.1,
    height: SW * 1.1,
    borderRadius: (SW * 1.1) / 2,
    opacity: 0.22,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 110,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  stickyHeaderInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  stickyTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 120,
  },
  backBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(18,18,24,0.3)',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  artWrapper: {
    width: SW * 0.72,
    aspectRatio: 1,
    borderRadius: 24,
    marginBottom: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artAmbientGlow: {
    position: 'absolute',
    inset: -14,
    borderRadius: 36,
    opacity: 0.35,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 36,
    shadowOpacity: 0.6,
  },
  artGlassFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,22,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  artPlaceholder: {
    backgroundColor: 'rgba(24,20,36,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  providerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  providerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  playlistTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  playlistSub: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  syncingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(70,245,224,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(70,245,224,0.25)',
  },
  syncingBadgeText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  controlSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  downloadBtnOuter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
  },
  downloadSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffleBtnOuter: {
    flex: 1,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
  },
  shuffleSurface: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shuffleLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  playBtnWrapper: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnGlow: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  playBtnShell: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  playBtnGlowRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: C.muted,
    fontSize: 14,
    marginTop: 14,
    fontWeight: '500',
  },
  errorWrap: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 4,
  },
  trackRowActive: {
    backgroundColor: 'rgba(191,90,242,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.25)',
  },
  indexCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: 'rgba(170,170,185,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  trackThumbFrame: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
  },
  trackThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  trackInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackArtist: {
    color: C.muted,
    fontSize: 12,
  },
  durationText: {
    color: 'rgba(170,170,185,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  actionIconBtn: {
    padding: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
