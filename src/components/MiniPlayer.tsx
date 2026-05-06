import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LiquidGlass } from '@/src/components/ui/liquid-glass';
import { PressScale } from '@/src/components/ui/press-scale';
import { glass, palette, radius } from '@/src/design/tokens';
import { minimumHitSlop, useResponsiveMetrics } from '@/src/hooks/use-responsive-metrics';
import { useMusicControls, useMusicProgress, useNowPlayingTrack } from '@/src/context/MusicContext';
import { clamp } from '@/src/utils/color';
import { impact } from '@/src/utils/haptics';
import { openNowPlaying } from '@/src/navigation/music-navigation';

const NAV_HEIGHT = 72;

function MiniPlayer() {
  const track = useNowPlayingTrack();
  const { isPlaying, play, pause, next } = useMusicControls();
  const { progress } = useMusicProgress();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const metrics = useResponsiveMetrics();
  const progressAnim = useRef(new Animated.Value(clamp(progress))).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: clamp(progress),
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const accent = track?.dominantColors?.[0] ?? palette.primary;
  const accentDeep = track?.dominantColors?.[1] ?? palette.primaryDeep;
  const bottom = Math.max(insets.bottom + NAV_HEIGHT + 28, 112);
  const showProgressRail = metrics.width >= 390;

  const handleOpenNowPlaying = useCallback(() => {
    if (!track) return;
    impact(Haptics.ImpactFeedbackStyle.Light);
    openNowPlaying(router, track.id, 'mini-player');
  }, [router, track]);

  const handlePlayPause = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      impact(Haptics.ImpactFeedbackStyle.Medium);
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    },
    [isPlaying, pause, play]
  );

  const handleNext = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      impact(Haptics.ImpactFeedbackStyle.Medium);
      next();
    },
    [next]
  );

  const gradientColors = useMemo(
    () => [accent, accentDeep] as const,
    [accent, accentDeep]
  );

  if (!track) return null;

  return (
    <PressScale
      haptic={false}
      scaleTo={0.985}
      wrapperStyle={[styles.container, { bottom, width: metrics.navWidth }]}
      style={styles.pressArea}
      accessibilityRole="button"
      accessibilityLabel={`Open now playing. ${track.title} by ${track.artist}.`}
      onPress={handleOpenNowPlaying}
    >
      <LiquidGlass
        dense
        gradient
        accentColor={accent}
        accentOpacity={0.07}
        intensity={glass.denseBlur}
        borderRadius={radius.lg}
        style={styles.glass}
        contentStyle={styles.content}
      >
        <View style={styles.artWrap}>
          <Image
            source={{ uri: track.art }}
            style={styles.art}
            contentFit="cover"
            transition={180}
            accessibilityLabel={`${track.title} artwork`}
          />
        </View>

        <View style={styles.meta}>
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.25}
            style={styles.title}
            numberOfLines={1}
          >
            {track.title}
          </Text>
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.25}
            style={styles.artist}
            numberOfLines={1}
          >
            {track.artist}
          </Text>
        </View>

        {showProgressRail && (
          <View style={styles.progressRail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: accent }]} />
              <Animated.View style={[styles.progressGlow, { width: progressWidth, backgroundColor: accent }]} />
            </View>
          </View>
        )}

        <View style={styles.controls}>
          <PressScale
            scaleTo={0.9}
            hitSlop={minimumHitSlop}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause playback' : 'Play current track'}
            onPress={handlePlayPause}
            style={[styles.playButton, { backgroundColor: palette.ink }]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color="#08080d"
              style={!isPlaying && styles.playIconOffset}
            />
          </PressScale>
          <PressScale
            scaleTo={0.9}
            hitSlop={minimumHitSlop}
            accessibilityRole="button"
            accessibilityLabel="Skip to next track"
            onPress={handleNext}
            style={styles.nextButton}
          >
            <Ionicons name="play-skip-forward" size={20} color={palette.inkMuted} />
          </PressScale>
        </View>

        <View pointerEvents="none" style={[styles.underlight, { backgroundColor: gradientColors[0] }]} />
      </LiquidGlass>
    </PressScale>
  );
}

export default memo(MiniPlayer);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 40,
  },
  pressArea: {
    minHeight: 64,
  },
  glass: {
    minHeight: 64,
    boxShadow: '0 14px 32px rgba(0, 0, 0, 0.40)',
  },
  content: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 11,
  },
  artWrap: {
    width: 48,
    height: 48,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#050507',
    borderWidth: 1,
    borderColor: palette.border,
  },
  art: {
    width: '100%',
    height: '100%',
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
  },
  artist: {
    marginTop: 1,
    color: palette.inkDim,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },
  progressRail: {
    width: 72,
  },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressGlow: {
    position: 'absolute',
    height: '100%',
    opacity: 0.42,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconOffset: {
    marginLeft: 2,
  },
  nextButton: {
    width: 34,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  underlight: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: -10,
    height: 18,
    opacity: 0.22,
  },
});
