import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  AppState,
  AppStateStatus,
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
import { minimumHitSlop } from '@/src/hooks/use-responsive-metrics';

import { Dimensions } from 'react-native';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isLandscape = SCREEN_WIDTH > SCREEN_HEIGHT;
const isTablet = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) >= 720;
const NAV_WIDTH = Math.min(SCREEN_WIDTH - 32, isTablet ? 620 : isLandscape ? 560 : SCREEN_WIDTH - 32);
import { useMusicControls, useNowPlayingTrack } from '@/src/context/MusicContext';
import { usePlayerStore } from '../features/player/store/player.store';
import { impact } from '@/src/utils/haptics';
import { openNowPlaying } from '@/src/navigation/music-navigation';
import { playbackProgress } from '@/src/features/player/services/playback-progress';
import { getTrackArtwork, getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { resolveArtwork } from '@/src/features/player/utils/artwork-resolver';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import { Marquee } from '@/src/components/ui/marquee';
import { MotionTiming, MotionSpring, MotionEasing } from '@/src/design/motion';
import { getBottomOffset } from '@/src/constants/navigation';

const DEFAULT_ACCENT = '#BF5AF2';

const formatArtistDisplay = (artistStr?: string): string => {
  if (!artistStr || typeof artistStr !== 'string' || artistStr.trim() === '') return "—";
  return artistStr.trim();
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
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (appState !== 'active') return undefined;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [anim, appState]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.55] });
  return <Animated.View style={[{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 6, opacity }, style]} />;
});
Shimmer.displayName = 'Shimmer';

const EdgeGlow = memo(({ color }: { color: string }) => (
  <View pointerEvents="none" style={[styles.edgeGlow, { backgroundColor: color }]}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.5, borderRadius: 4 }]} />
  </View>
));
EdgeGlow.displayName = 'EdgeGlow';

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

  // Presence state for smooth entry/exit animations when playback starts/stops
  const presence = useSharedValue(0);
  useEffect(() => {
    if (track) {
      presence.value = withSpring(1, MotionSpring.STANDARD);
    } else {
      presence.value = withSpring(0, MotionSpring.STANDARD);
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
  const bottom = bottomOffset ?? getBottomOffset(true, insets);

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
          <BlurView
            intensity={Platform.OS === 'ios' ? 70 : 45}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassBase]} />
          <LinearGradient
            colors={['rgba(28, 22, 42, 0.76)', 'rgba(14, 11, 22, 0.90)']}
            start={{ x: 0.5, y: 0.0 }}
            end={{ x: 0.5, y: 1.0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View pointerEvents="none" style={styles.glassSpecularTop} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.glassSpecularBorder]} />
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
          <AuraArtwork 
            key={track?.id ? `mini-${track.id}` : 'mini-empty'}
            source={resolveArtwork(track, 'card')} 
            entityName={track.title}
            entityType="song"
            style={styles.art} 
            contentFit="cover" 
            transition={MotionTiming.QUICK}
            cachePolicy="memory-disk"
          />
          {isBuffering && <View style={[StyleSheet.absoluteFill, styles.bufferingOverlay]}><ActivityIndicator size="small" color={accent} /></View>}
          {status === 'error' && <View style={[StyleSheet.absoluteFill, styles.errorOverlay]}><Ionicons name="alert-circle" size={20} color="#FFF" /></View>}
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.artRim]} />
        </Reanimated.View>
        <View style={styles.meta}>
          <Marquee style={{ width: '100%' }}>
            <Text allowFontScaling maxFontSizeMultiplier={1.25} style={styles.title} numberOfLines={1}>{track.title}</Text>
          </Marquee>
          <Marquee style={{ width: '100%', marginTop: 2 }}>
            <Text allowFontScaling maxFontSizeMultiplier={1.25} style={styles.artist} numberOfLines={1}>
              {formatArtistDisplay(track.artist || (track as any)?.artistName || (track as any)?.author)}
            </Text>
          </Marquee>
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
      <View style={styles.glassContainer}>
        {/* ── Layer 1: Native Backdrop Blur (iOS & Android) ── */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 70 : 45}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]}
        />

        {/* ── Layer 2: Deep Obsidian Liquid Glass Base (Matches FloatingNavBar, No White-Wash) ── */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassBase]} />

        {/* ── Layer 3: Natural Dark Tint Gradient (Matches FloatingNavBar / GlassSurface) ── */}
        <LinearGradient
          colors={['rgba(28, 22, 42, 0.76)', 'rgba(14, 11, 22, 0.90)']}
          start={{ x: 0.5, y: 0.0 }}
          end={{ x: 0.5, y: 1.0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Layer 4: Ambient Dynamic Accent / Violet Glow Rim ── */}
        <LinearGradient
          colors={[h2r(accent, 0.14), 'transparent']}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 1.0, y: 1.0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Layer 5: Diagonal Caustic Refraction Sheen (Simulating Liquid Optical Distortion) ── */}
        <LinearGradient
          colors={[
            'rgba(191, 90, 242, 0.18)',
            'rgba(70, 245, 224, 0.09)',
            'transparent',
            'rgba(255, 255, 255, 0.06)',
            'transparent',
            'rgba(191, 90, 242, 0.06)',
          ]}
          locations={[0.0, 0.22, 0.42, 0.58, 0.78, 1.0]}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 1.0, y: 1.0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Layer 6: Subtle Top Specular Catch Line ── */}
        <View pointerEvents="none" style={styles.glassSpecularTop} />

        {/* ── Layer 7: Chromatic Caustic Glass Border ── */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.glassSpecularBorder,
            { borderTopColor: h2r(accent, 0.35) },
          ]}
        />
        <EdgeGlow color={accent} />

        {/* ── Layer 8: Interactive Player Content ── */}
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
    <Reanimated.View style={[styles.container, { bottom, width: NAV_WIDTH }, miniPlayerStyle]}>
      {renderContent()}
    </Reanimated.View>
  );
}

export default memo(MiniPlayer);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 40,
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
  },
  pressArea: { width: '100%' },
  glassContainer: {
    minHeight: 68,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  glassBase: {
    backgroundColor: 'rgba(16, 12, 24, 0.72)',
    borderRadius: 28,
  },
  glassSpecularTop: {
    position: 'absolute',
    top: 0.5,
    left: 24,
    right: 24,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 1,
    zIndex: 10,
  },
  glassSpecularBorder: {
    borderRadius: 28,
    borderWidth: 1.2,
    borderTopColor: 'rgba(191, 90, 242, 0.35)',
    borderLeftColor: 'rgba(70, 245, 224, 0.22)',
    borderRightColor: 'rgba(255, 255, 255, 0.10)',
    borderBottomColor: 'rgba(0, 0, 0, 0.65)',
    backgroundColor: 'transparent',
    zIndex: 11,
  },
  edgeGlow: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2, opacity: 0.82, zIndex: 10 },
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
  underlightGradient: { borderRadius: 28, pointerEvents: 'none' },
  underlight: { position: 'absolute', left: 32, right: 32, bottom: -8, height: 16, opacity: 0.20, borderRadius: 8, elevation: 0 },
  skeletonShell: { minHeight: 68, borderRadius: 28, overflow: 'hidden', width: '100%' },
  skeletonContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 11, minHeight: 68 },
  skeletonArt: { width: 48, height: 48, borderRadius: 13 },
  skeletonMeta: { flex: 1, gap: 7 },
  skeletonTitle: { height: 13, borderRadius: 4, width: '70%' },
  skeletonArtist: { height: 11, borderRadius: 4, width: '45%' },
  skeletonBtn: { width: 38, height: 38, borderRadius: 19 },
});
