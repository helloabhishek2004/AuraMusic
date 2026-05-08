import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, ScrollView, Share, StatusBar, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AtmosphericBackground } from '@/src/components/ui/atmospheric-background';
import { LiquidGlass } from '@/src/components/ui/liquid-glass';
import { PressScale } from '@/src/components/ui/press-scale';
import { AuraText, MediaListItem, MotionReveal, SectionHeader } from '@/src/components/ui/aura-primitives';
import { getAlbumById } from '@/src/data/music-catalog';
import { useMusicActions } from '@/src/context/MusicContext';
import { glass, palette, radius, spacing } from '@/src/design/tokens';
import { useResponsiveMetrics } from '@/src/hooks/use-responsive-metrics';
import { openArtist } from '@/src/navigation/music-navigation';
import { hexToRgba } from '@/src/utils/color';

export default function AlbumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const metrics = useResponsiveMetrics();
  const { id } = useLocalSearchParams();
  const album = getAlbumById(id);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { play } = useMusicActions();

  const heroSize = Math.min(metrics.contentWidth * (metrics.isTablet ? 0.44 : 0.68), 300);
  const accent = album.dominantColors[0] ?? palette.primary;
  const accentDeep = album.dominantColors[1] ?? palette.primaryDeep;

  const headerOpacity = scrollY.interpolate({
    inputRange: [heroSize * 0.45, heroSize * 0.9],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-90, 0, heroSize],
    outputRange: [1.08, 1, 0.94],
    extrapolate: 'clamp',
  });

  const tracks = useMemo(() => album.tracks, [album.tracks]);

  const handlePlayTrack = useCallback(
    async (track = tracks[0]) => {
      if (!track) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await play({
        id: track.id,
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        title: track.title,
        artist: track.artist,
        art: track.art,
        duration: track.durationSec ?? 240,
        dominantColors: track.dominantColors,
      });
    },
    [play, tracks]
  );

  const handleShare = useCallback(async () => {
    await Share.share({ message: `Listen to ${album.title} by ${album.artist} on Aura Music` }).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [album.artist, album.title]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AtmosphericBackground intensity={0.9} />
      <LinearGradient
        pointerEvents="none"
        colors={[hexToRgba(accent, 0.38), hexToRgba(accentDeep, 0.14), 'transparent']}
        style={styles.heroWash}
      />

      <Animated.View style={[styles.header, { paddingTop: insets.top + 8, opacity: headerOpacity }]}>
        <LiquidGlass dense intensity={glass.navBlur} borderRadius={radius.pill} style={styles.headerGlass} contentStyle={styles.headerInner}>
          <PressScale scaleTo={0.9} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.headerIcon}>
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </PressScale>
          <AuraText variant="headline" numberOfLines={1} style={styles.headerTitle}>{album.title}</AuraText>
          <PressScale scaleTo={0.9} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share album" style={styles.headerIcon}>
            <Ionicons name="share-outline" size={20} color={palette.ink} />
          </PressScale>
        </LiquidGlass>
      </Animated.View>

      <Animated.ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingHorizontal: metrics.horizontalPadding,
            paddingBottom: insets.bottom + 190,
          },
        ]}
      >
        <MotionReveal>
          <PressScale scaleTo={0.985} onPress={() => handlePlayTrack()} accessibilityRole="button" accessibilityLabel={`Play ${album.title}`}>
            <Animated.View style={[styles.artWrap, { width: heroSize, height: heroSize, transform: [{ scale: imageScale }] }]}>
              <Image source={{ uri: album.image }} style={styles.art} contentFit="cover" transition={220} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.44)']} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </PressScale>
        </MotionReveal>

        <MotionReveal delay={70} style={styles.titleBlock}>
          <AuraText variant="display" style={[styles.title, metrics.isSmallPhone && styles.smallTitle]}>{album.title}</AuraText>
          <PressScale scaleTo={0.97} onPress={() => openArtist(router, album.artistId, { origin: 'album' })} accessibilityRole="button" accessibilityLabel={`Open ${album.artist}`}>
            <AuraText variant="headline" style={styles.artist}>{album.artist}</AuraText>
          </PressScale>
          <AuraText variant="body" style={styles.description}>{album.description}</AuraText>
        </MotionReveal>

        <MotionReveal delay={120}>
          <View style={styles.actions}>
            <PressScale scaleTo={0.95} onPress={() => handlePlayTrack()} accessibilityRole="button" accessibilityLabel="Play album" style={styles.primaryAction}>
              <LinearGradient colors={[accent, accentDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="play" size={20} color={palette.ink} style={styles.playOffset} />
              <AuraText variant="headline" style={styles.primaryActionText}>Play</AuraText>
            </PressScale>
            <PressScale scaleTo={0.94} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share album" style={styles.secondaryAction}>
              <Ionicons name="share-outline" size={20} color={palette.ink} />
            </PressScale>
            <PressScale scaleTo={0.94} accessibilityRole="button" accessibilityLabel="More album options" style={styles.secondaryAction}>
              <Ionicons name="ellipsis-horizontal" size={22} color={palette.ink} />
            </PressScale>
          </View>
        </MotionReveal>

        <MotionReveal delay={170} style={styles.trackSection}>
          <SectionHeader title="Tracks" />
          {tracks.map((track, index) => (
            <MediaListItem
              key={track.id}
              title={track.title}
              subtitle={track.artist}
              image={track.art}
              meta={track.duration}
              active={index === 0}
              onPress={() => handlePlayTrack(track)}
              onSubtitlePress={() => openArtist(router, track.artistId, { origin: 'album-track' })}
              style={styles.trackItem}
            />
          ))}
        </MotionReveal>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  heroWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  header: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 20,
  },
  headerGlass: {
    minHeight: 54,
  },
  headerInner: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: spacing.sm,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
  },
  artWrap: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: palette.backgroundRaised,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 18 },
      },
      android: {
        elevation: 14,
      },
    }),
  },
  art: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    width: '100%',
    maxWidth: 680,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  smallTitle: {
    fontSize: 34,
    lineHeight: 40,
  },
  artist: {
    marginTop: spacing.xs,
    color: palette.primary,
    textAlign: 'center',
  },
  description: {
    marginTop: spacing.sm,
    maxWidth: 520,
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryAction: {
    minWidth: 132,
    height: 52,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  primaryActionText: {
    color: palette.ink,
  },
  playOffset: {
    marginLeft: 2,
  },
  secondaryAction: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackSection: {
    width: '100%',
    maxWidth: 720,
    marginTop: spacing.xl,
  },
  trackItem: {
    marginBottom: spacing.sm,
  },
});
