import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import Reanimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  interpolate, 
  Extrapolate,
  useAnimatedReaction, 
  runOnJS,
  SharedValue
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { PressScale } from '@/src/components/ui/press-scale';
import { glass, radius } from '@/src/design/tokens';
import { minimumHitSlop, useResponsiveMetrics } from '@/src/hooks/use-responsive-metrics';
import { useMusicControls, useNowPlayingTrack } from '@/src/context/MusicContext';
import { usePlayerStore } from '../features/player/store/player.store';
import { impact } from '@/src/utils/haptics';
import { openNowPlaying } from '@/src/navigation/music-navigation';
import { playbackProgress } from '@/src/features/player/services/playback-progress';
import { getTrackArtwork } from '@/src/features/player/utils/track-identity';

const DEFAULT_ACCENT = '#BF5AF2';

const parseArtists = (artistStr?: string): string[] => {
  if (!artistStr) return [];
  const standardized = artistStr
    .replace(/\s+(featuring|feat\.?|&|\/|with|and)\s+/gi, ", ")
    .replace(/\s*,\s*/g, ", ");
  return standardized.split(",").map(name => name.trim()).filter(name => name.length > 0);
};

const formatArtistDisplay = (artistStr?: string): string => {
  if (!artistStr) return "—";
  const artists = parseArtists(artistStr);
  if (artists.length === 0) return "—";
  if (artists.length === 1) return artists[0];
  if (artists.length === 2) return `${artists[0]} with ${artists[1]}`;
  if (artists.length === 3) return `${artists[0]} with ${artists[1]} and ${artists[2]}`;
  const middle = artists.slice(1, -1).join(", ");
  return `${artists[0]} with ${middle}, and ${artists[artists.length - 1]}`;
};

const h2r = (hex: string, a: number) => {
  const clean = hex.startsWith('#') ? hex : '#' + hex;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const Shimmer = memo(({ style }: { style?: any }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.55] });
  return <Animated.View style={[{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 6, opacity }, style]} />;
});

const EdgeGlow = memo(({ color }: { color: string }) => (
  <View pointerEvents="none" style={[styles.edgeGlow, { backgroundColor: color }]}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.5, borderRadius: 4 }]} />
  </View>
));

interface MiniPlayerProps {
  expandProgress?: SharedValue<number>;
  panGesture?: any;
  bottomOffset?: number;
}

function MiniPlayer({ expandProgress, panGesture, bottomOffset }: MiniPlayerProps) {
  const track = useNowPlayingTrack();
  const { isPlaying, play, pause, next } = useMusicControls();
  const status = usePlayerStore(s => s.status);
  const isBuffering = usePlayerStore(s => s.isBuffering);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const metrics = useResponsiveMetrics();

  // Presence state for smooth entry/exit animations when playback starts/stops
  const presence = useSharedValue(0);
  useEffect(() => {
    if (track) {
      presence.value = withSpring(1, { damping: 20, stiffness: 180 });
    } else {
      presence.value = withSpring(0, { damping: 20, stiffness: 180 });
    }
  }, [track]);

  const progressBarStyle = useAnimatedStyle(() => {
    const pos = playbackProgress.positionMs.value;
    const dur = playbackProgress.durationMs.value;
    const pct = dur > 0 ? Math.min(1, Math.max(0, pos / dur)) : 0;
    const tx = ((pct - 1) * 64) / 2; // W = 64
    return {
      transform: [
        { translateX: tx },
        { scaleX: pct }
      ],
    };
  });

  const miniPlayerStyle = useAnimatedStyle(() => {
    // entry/exit animation: translates down by 100px and fades
    const presenceY = interpolate(presence.value, [0, 1], [100, 0], Extrapolate.CLAMP);
    const presenceOpacity = interpolate(presence.value, [0, 1], [0, 1], Extrapolate.CLAMP);

    // expansion transition: fades out and scales down slightly
    const p = expandProgress ? expandProgress.value : 0;
    const expandOpacity = interpolate(p, [0, 0.25], [1, 0], Extrapolate.CLAMP);
    const expandScale = interpolate(p, [0, 0.25], [1, 0.95], Extrapolate.CLAMP);

    const isHidden = p >= 0.99 || presence.value <= 0.01;

    return {
      opacity: presenceOpacity * expandOpacity,
      transform: [
        { translateY: presenceY },
        { scale: expandScale }
      ],
      display: isHidden ? 'none' : 'flex',
    };
  });

  const miniArtStyle = useAnimatedStyle(() => {
    const p = expandProgress ? expandProgress.value : 0;
    return {
      opacity: interpolate(p, [0, 0.05], [1, 0], Extrapolate.CLAMP),
    };
  });

  const accent = track?.dominantColors?.[0] ?? DEFAULT_ACCENT;
  const bottom = bottomOffset ?? (Math.max(insets.bottom + 14, 24) + 80);

  const handleOpenNowPlaying = useCallback(() => {
    if (!track) return;
    impact(Haptics.ImpactFeedbackStyle.Light);
    openNowPlaying(router, track.id, 'mini-player');
  }, [router, track]);

  const handlePlayPause = useCallback((e: GestureResponderEvent) => {
    e.stopPropagation();
    impact(Haptics.ImpactFeedbackStyle.Medium);
    isPlaying ? pause() : play();
  }, [isPlaying, pause, play]);

  const handleNext = useCallback((e: GestureResponderEvent) => {
    e.stopPropagation();
    impact(Haptics.ImpactFeedbackStyle.Medium);
    next();
  }, [next]);

  const renderContent = () => {
    if (!track) {
      return (
        <View style={styles.skeletonShell}>
          <BlurView intensity={52} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.glassBase]} />
          <View style={[StyleSheet.absoluteFill, styles.glassBorder]} />
          <View style={styles.skeletonContent}>
            <Shimmer style={styles.skeletonArt} />
            <View style={styles.skeletonMeta}>
              <Shimmer style={styles.skeletonTitle} />
              <Shimmer style={styles.skeletonArtist} />
            </View>
            <Shimmer style={styles.skeletonBtn} />
          </View>
        </View>
      );
    }

    const renderInnerContent = () => (
      <>
        <Reanimated.View style={[styles.artWrap, miniArtStyle]}>
          <Image source={{ uri: getTrackArtwork(track) }} style={styles.art} contentFit="cover" transition={180} />
          {isBuffering && <View style={[StyleSheet.absoluteFill, styles.bufferingOverlay]}><ActivityIndicator size="small" color={accent} /></View>}
          {status === 'error' && <View style={[StyleSheet.absoluteFill, styles.errorOverlay]}><Ionicons name="alert-circle" size={20} color="#FFF" /></View>}
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.artRim]} />
        </Reanimated.View>
        <View style={styles.meta}>
          <Text allowFontScaling maxFontSizeMultiplier={1.25} style={styles.title} numberOfLines={1}>{track.title}</Text>
          <Text allowFontScaling maxFontSizeMultiplier={1.25} style={styles.artist} numberOfLines={1}>{formatArtistDisplay(track.artist)}</Text>
        </View>
        <View style={styles.progressRail}>
          <View style={styles.progressTrack}>
            <Reanimated.View style={[styles.progressFill, { backgroundColor: accent, width: 64 }, progressBarStyle]} />
            <Reanimated.View style={[styles.progressGlow, { backgroundColor: accent, width: 64 }, progressBarStyle]} />
          </View>
        </View>
      </>
    );

    return (
      <View style={styles.glassShell}>
        <BlurView intensity={glass.denseBlur ?? 52} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassBase]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: h2r(accent, 0.07), borderRadius: radius.lg }]} />
        <View pointerEvents="none" style={styles.specular} />
        <View pointerEvents="none" style={styles.fresnel} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.glassBorder]} />
        <EdgeGlow color={accent} />
        <View style={styles.content}>
          {panGesture ? (
            <GestureDetector gesture={panGesture}>
              <View style={styles.gestureActiveArea} accessibilityRole="button" accessibilityLabel={`Now Playing: ${track.title} by ${track.artist}. Double tap or drag up to expand.`}>
                {renderInnerContent()}
              </View>
            </GestureDetector>
          ) : (
            <PressScale haptic={false} scaleTo={0.984} style={styles.gestureActiveArea} onPress={handleOpenNowPlaying} accessibilityRole="button" accessibilityLabel={`Now Playing: ${track.title} by ${track.artist}. Tap to expand.`}>
              {renderInnerContent()}
            </PressScale>
          )}
          <View style={styles.controls}>
            <PressScale scaleTo={0.88} hitSlop={minimumHitSlop} onPress={handlePlayPause} style={[styles.playButton, { backgroundColor: accent }]}>
              <View pointerEvents="none" style={styles.playBtnSpec} />
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFF" style={!isPlaying && styles.playIconOffset} />
            </PressScale>
            <PressScale scaleTo={0.88} hitSlop={minimumHitSlop} onPress={handleNext} style={styles.nextButton}>
              <Ionicons name="play-skip-forward" size={20} color="rgba(255,255,255,0.60)" />
            </PressScale>
          </View>
        </View>
        <LinearGradient colors={[h2r(accent, 0.0), h2r(accent, 0.18)]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.underlightGradient]} />
        <View pointerEvents="none" style={[styles.underlight, { backgroundColor: accent }]} />
      </View>
    );
  };

  return (
    <Reanimated.View style={[styles.container, { bottom, width: metrics.navWidth }, miniPlayerStyle]}>
      {renderContent()}
    </Reanimated.View>
  );
}

export default memo(MiniPlayer);

const styles = StyleSheet.create({
  container: { position: 'absolute', alignSelf: 'center', zIndex: 40, elevation: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 22 },
  pressArea: { width: '100%' },
  glassShell: { minHeight: 68, borderRadius: radius.lg ?? 20, overflow: 'hidden' },
  glassBase: { backgroundColor: 'rgba(14,12,22,0.72)', borderRadius: radius.lg ?? 20 },
  glassBorder: { borderRadius: radius.lg ?? 20, borderWidth: 0.75, borderTopColor: 'rgba(255,255,255,0.28)', borderLeftColor: 'rgba(255,255,255,0.08)', borderRightColor: 'rgba(255,255,255,0.06)', borderBottomColor: 'rgba(255,255,255,0.04)', backgroundColor: 'transparent' },
  specular: { position: 'absolute', top: 0, left: 28, right: 28, height: 1, backgroundColor: 'rgba(255,255,255,0.26)', zIndex: 9 },
  fresnel: { position: 'absolute', left: 20, top: 12, bottom: 12, width: 1.5, backgroundColor: 'rgba(255,255,255,0.10)', transform: [{ skewX: '-8deg' }], zIndex: 9 },
  edgeGlow: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, opacity: 0.82, zIndex: 10 },
  content: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 11 },
  gestureActiveArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 48 },
  artWrap: { width: 48, height: 48, borderRadius: 13, overflow: 'hidden', backgroundColor: '#050507', elevation: 4 },
  art: { width: '100%', height: '100%' },
  artRim: { borderRadius: 13, borderWidth: 0.75, borderTopColor: 'rgba(255,255,255,0.22)', borderLeftColor: 'rgba(255,255,255,0.07)', borderRightColor: 'rgba(255,255,255,0.07)', borderBottomColor: 'rgba(255,255,255,0.04)', backgroundColor: 'transparent' },
  bufferingOverlay: { backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'center', alignItems: 'center' },
  errorOverlay: { backgroundColor: 'rgba(0,0,0,0.60)', justifyContent: 'center', alignItems: 'center' },
  meta: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.2 },
  artist: { marginTop: 2, color: 'rgba(255,255,255,0.52)', fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  progressRail: { width: 64 },
  progressTrack: { height: 3, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  progressGlow: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, opacity: 0.38 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 50 },
  playButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 6 },
  playBtnSpec: { position: 'absolute', top: 3, left: 10, right: 10, height: 1, borderRadius: 0.5, backgroundColor: 'rgba(255,255,255,0.30)' },
  playIconOffset: { marginLeft: 2 },
  nextButton: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  underlightGradient: { borderRadius: radius.lg ?? 20, pointerEvents: 'none' },
  underlight: { position: 'absolute', left: 32, right: 32, bottom: -8, height: 16, opacity: 0.20, borderRadius: 8, elevation: 0 },
  skeletonShell: { minHeight: 68, borderRadius: radius.lg ?? 20, overflow: 'hidden', width: '100%' },
  skeletonContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 11, minHeight: 68 },
  skeletonArt: { width: 48, height: 48, borderRadius: 13 },
  skeletonMeta: { flex: 1, gap: 7 },
  skeletonTitle: { height: 13, borderRadius: 4, width: '70%' },
  skeletonArtist: { height: 11, borderRadius: 4, width: '45%' },
  skeletonBtn: { width: 38, height: 38, borderRadius: 19 },
});
