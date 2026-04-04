import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Platform,
  Share,
  StatusBar,
  PanResponder,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

// ── Motion constants ──────────────────────────────────────────────────────────
const MOTION = {
  SLIDE: { tension: 60, friction: 9 },
  POP: { tension: 200, friction: 8 },
  SHEET: { tension: 45, friction: 11 },
};

// ── Track data ────────────────────────────────────────────────────────────────
const tracks = [
  {
    id: 'nebula',
    title: 'Nebula Drift',
    artist: 'Lumina Synthetics',
    durationSec: 222,
    art: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDvPx_cacsyYoMUH_pNgGcRi4uEGEaZclAzYYTxP8ay88S1AGyEJzlo-cwY2a6vZpRxUqjOFJw8VVM6XorKQgOWTk9FbTnPrm8W8zvJtr_cDobTY0PBpm8a2VfZfcWgNzo9pkQ9KXfJUkwnW95tzuNJRV-0kfiHpAbzv1fgRb92yKUgDA_1wbr6etz41zwCt3BIh0_PCA8pdp3keJxQiVlohG_nAlmNZy3lBQc2e6uYRHW9W9sBR3js83IaO9EFfNUAYDjheUgRFE',
    dominantColors: ['#bf5af2', '#7b2fbe'],
  },
  {
    id: 'neon',
    title: 'Neon Nights',
    artist: 'Synthwave Collective',
    durationSec: 255,
    art: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=320',
    dominantColors: ['#46f5e0', '#005950'],
  },
  {
    id: 'solar',
    title: 'Solar Flare',
    artist: 'Cosmic Echo',
    durationSec: 178,
    art: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=320',
    dominantColors: ['#ffb4ab', '#93000a'],
  },
  {
    id: '1',
    title: 'Midnight City',
    artist: 'M83',
    durationSec: 243,
    art: 'https://picsum.photos/seed/m83/800',
    dominantColors: ['#46f5e0', '#003731'],
  },
  {
    id: '2',
    title: 'Starboy',
    artist: 'The Weeknd',
    durationSec: 230,
    art: 'https://picsum.photos/seed/starboy/800',
    dominantColors: ['#ff4d4d', '#330000'],
  },
  {
    id: '3',
    title: 'Nightcall',
    artist: 'Kavinsky',
    durationSec: 258,
    art: 'https://picsum.photos/seed/kavinsky/800',
    dominantColors: ['#BF5AF2', '#1a0033'],
  },
  {
    id: '4',
    title: 'After Hours',
    artist: 'The Weeknd',
    durationSec: 362,
    art: 'https://picsum.photos/seed/afterhours/800',
    dominantColors: ['#ffb4ab', '#93000a'],
  },
  {
    id: '5',
    title: 'Resonance',
    artist: 'HOME',
    durationSec: 212,
    art: 'https://picsum.photos/seed/resonance/800',
    dominantColors: ['#46f5e0', '#003731'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ── Liquid Glass Card shell ───────────────────────────────────────────────────
const GlassCard = ({ children, style, borderRadius = 20, blurIntensity = 65 }: any) => (
  <View style={[{
    borderRadius,
    overflow: 'hidden',
    backgroundColor: 'rgba(28,28,36,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  }, style]}>
    <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
    {/* specular top edge */}
    <View style={{
      position: 'absolute', top: 0, left: borderRadius * 0.4,
      right: borderRadius * 0.4, height: 1.5,
      backgroundColor: 'rgba(255,255,255,0.22)', zIndex: 10,
    }} />
    {/* specular left strip */}
    <View style={{
      position: 'absolute', left: 8, top: 10, bottom: 10,
      width: 2.5, backgroundColor: 'rgba(255,255,255,0.13)',
      transform: [{ skewX: '-8deg' }], zIndex: 10,
    }} />
    {/* refraction overlay */}
    <View style={{
      ...StyleSheet.absoluteFillObject, borderRadius,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
      backgroundColor: 'rgba(255,255,255,0.03)',
    }} />
    {children}
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NowPlayingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Find initial track from params
  const findTrackIndex = (id: string | string[]) => {
    const idx = tracks.findIndex(t => t.id === id);
    return idx === -1 ? 0 : idx;
  };

  // State
  const [currentTrackIndex, setCurrentTrackIndex] = useState(findTrackIndex(params.trackId as string));
  
  // Update track when params change
  useEffect(() => {
    if (params.trackId) {
      const idx = findTrackIndex(params.trackId as string);
      if (idx !== currentTrackIndex) {
        setCurrentTrackIndex(idx);
        setElapsedSec(0);
        progressBarAnim.setValue(0);
      }
    }
  }, [params.trackId]);
  const [prevTrackIndex, setPrevTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(true);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState('none');
  const [elapsedSec, setElapsedSec] = useState(93); // start at 02:14 demo
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [scrubberWidth, setScrubberWidth] = useState(0);
  const [volumeWidth, setVolumeWidth] = useState(0);
  const [currentVolume, setCurrentVolume] = useState(0.65);

  const currentTrack = tracks[currentTrackIndex];
  const prevTrack = tracks[prevTrackIndex];
  const progress = elapsedSec / currentTrack.durationSec;

  // ── Animated values ─────────────────────────────────────────────────────────
  const scrubberAnim = useRef(new Animated.Value(progress)).current;
  const volumeAnim = useRef(new Animated.Value(0.65)).current;
  const artScaleAnim = useRef(new Animated.Value(0.93)).current;
  const artTranslateX = useRef(new Animated.Value(0)).current;
  const backgroundProgress = useRef(new Animated.Value(1)).current;
  const iconRowOpacity = useRef(new Animated.Value(0)).current;
  const iconRowScale = useRef(new Animated.Value(0.93)).current;
  const glowPulse = useRef(new Animated.Value(0.5)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const pageEntrance = useRef(new Animated.Value(0)).current;
  const pageScale = useRef(new Animated.Value(0.93)).current;
  const artBreathScale = useRef(new Animated.Value(1.0)).current;
  const progressBarAnim = useRef(new Animated.Value(progress)).current;
  const thumbGlowPulse = useRef(new Animated.Value(0.6)).current;
  const scrubberThumbScale = useRef(new Animated.Value(1)).current;

  // individual press scales
  const prevBtnScale = useRef(new Animated.Value(1)).current;
  const nextBtnScale = useRef(new Animated.Value(1)).current;
  const playBtnScale = useRef(new Animated.Value(1)).current;
  const likeBtnScale = useRef(new Animated.Value(1)).current;
  const lyricsBtnScale = useRef(new Animated.Value(1)).current;
  const dlBtnScale = useRef(new Animated.Value(1)).current;
  const shareBtnScale = useRef(new Animated.Value(1)).current;
  const infoBtnScale = useRef(new Animated.Value(1)).current;
  const settingsBtnScale = useRef(new Animated.Value(1)).current;
  const shuffleBtnScale = useRef(new Animated.Value(1)).current;
  const repeatBtnScale = useRef(new Animated.Value(1)).current;
  const castBtnScale = useRef(new Animated.Value(1)).current;

  // ── Loops & entrance ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Page materialise
    Animated.parallel([
      Animated.spring(pageEntrance, { toValue: 1, ...MOTION.SLIDE, useNativeDriver: true }),
      Animated.timing(pageScale, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    // Art materialise
    Animated.spring(artScaleAnim, { toValue: isPlaying ? 1.03 : 0.96, ...MOTION.SHEET, useNativeDriver: true }).start();

    // Icon row — delayed
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(iconRowScale, { toValue: 1, ...MOTION.SLIDE, useNativeDriver: true }),
        Animated.timing(iconRowOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]).start();
    }, 320);

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.28, duration: 700, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    // Thumb glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(thumbGlowPulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
        Animated.timing(thumbGlowPulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Scrubber PanResponder ───────────────────────────────────────────────────
  const scrubberResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsScrubbing(true);
        Animated.spring(scrubberThumbScale, { toValue: 1.5, ...MOTION.POP, useNativeDriver: true }).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        if (scrubberWidth <= 0) return;
        const padding = 28;
        const relativeX = gestureState.moveX - padding;
        const progressVal = Math.max(0, Math.min(1, relativeX / scrubberWidth));
        
        progressBarAnim.setValue(progressVal);
        const newSec = Math.floor(progressVal * currentTrack.durationSec);
        setElapsedSec(newSec);
      },
      onPanResponderRelease: () => {
        setIsScrubbing(false);
        Animated.spring(scrubberThumbScale, { toValue: 1, ...MOTION.POP, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    })
  ).current;

  // ── Volume PanResponder ─────────────────────────────────────────────────────
  const volumeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        if (volumeWidth <= 0) return;
        const padding = 28 + 18 + 14; 
        const relativeX = gestureState.moveX - padding;
        const volVal = Math.max(0, Math.min(1, relativeX / volumeWidth));
        setCurrentVolume(volVal);
        volumeAnim.setValue(volVal);
      },
      onPanResponderRelease: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
    })
  ).current;

  // ── Album art breathing (playing state) ─────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      Animated.spring(artScaleAnim, { toValue: 1.04, ...MOTION.SHEET, useNativeDriver: true }).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(artBreathScale, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
            Animated.timing(artBreathScale, { toValue: 1.04, duration: 2000, useNativeDriver: true }),
          ])
        ).start();
      });
    } else {
      artBreathScale.stopAnimation();
      Animated.spring(artScaleAnim, { toValue: 0.96, ...MOTION.SHEET, useNativeDriver: true }).start();
      artBreathScale.setValue(1.0);
    }
  }, [isPlaying]);

  // ── Progress bar auto-advance ─────────────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && !isScrubbing) {
      interval = setInterval(() => {
        setElapsedSec(prev => {
          const next = prev >= currentTrack.durationSec ? 0 : prev + 1;
          const p = next / currentTrack.durationSec;
          Animated.timing(progressBarAnim, {
            toValue: p,
            duration: 980,
            useNativeDriver: false,
          }).start();
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrackIndex, isScrubbing]);

  // ── Track change ─────────────────────────────────────────────────────────────
  const handleTrackChange = (nextIndex: number, direction: 'next' | 'prev') => {
    setPrevTrackIndex(currentTrackIndex);
    setCurrentTrackIndex(nextIndex);
    setElapsedSec(0);
    progressBarAnim.setValue(0);
    backgroundProgress.setValue(0);
    Animated.timing(backgroundProgress, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    const shift = direction === 'next' ? -30 : 30;
    Animated.timing(artTranslateX, { toValue: shift, duration: 120, useNativeDriver: true }).start(() => {
      artTranslateX.setValue(-shift);
      Animated.spring(artTranslateX, { toValue: 0, ...MOTION.POP, useNativeDriver: true }).start();
    });
  };

  const onNext = () => handleTrackChange((currentTrackIndex + 1) % tracks.length, 'next');
  const onPrev = () => handleTrackChange((currentTrackIndex - 1 + tracks.length) % tracks.length, 'prev');

  const onShare = async () => {
    try {
      await Share.share({ message: `Check out ${currentTrack.title} by ${currentTrack.artist}!` });
    } catch { }
  };

  // ── Press helpers ─────────────────────────────────────────────────────────────
  const pressIn = (v: Animated.Value) => Animated.spring(v, { toValue: 0.88, ...MOTION.POP, useNativeDriver: true }).start();
  const pressOut = (v: Animated.Value) => Animated.spring(v, { toValue: 1.0, ...MOTION.POP, useNativeDriver: true }).start();

  // ── Derived animated progress bar width ──────────────────────────────────────
  const barWidth = progressBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const thumbLeft = progressBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const c0 = currentTrack.dominantColors[0];
  const c1 = currentTrack.dominantColors[1];
  const p0 = prevTrack.dominantColors[0];

  return (
    <Animated.View style={[
      styles.container,
      { opacity: pageEntrance, transform: [{ scale: pageScale }] }
    ]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── DYNAMIC ANIMATED BACKGROUND ──────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        {/* Base */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#08080d' }]} />

        {/* Prev track colors fading out */}
        <Animated.View style={[StyleSheet.absoluteFill, {
          opacity: backgroundProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
        }]}>
          <LinearGradient
            colors={[hexToRgba(p0, 0.55), hexToRgba(p0, 0.20), 'transparent']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Radial-style side bloom */}
          <LinearGradient
            colors={[hexToRgba(p0, 0.18), 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Current track colors fading in */}
        <Animated.View style={[StyleSheet.absoluteFill, {
          opacity: backgroundProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
        }]}>
          {/* Top bloom — dominant colour */}
          <LinearGradient
            colors={[hexToRgba(c0, 0.60), hexToRgba(c0, 0.22), 'transparent']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Bottom accent — secondary colour */}
          <LinearGradient
            colors={['transparent', hexToRgba(c1, 0.28), hexToRgba(c1, 0.45)]}
            locations={[0, 0.65, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Side ambient bleed */}
          <LinearGradient
            colors={[hexToRgba(c0, 0.15), 'transparent', hexToRgba(c1, 0.10)]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Always-on dark overlay — keeps everything readable */}
        <LinearGradient
          colors={['rgba(8,8,13,0.48)', 'rgba(8,8,13,0.72)', 'rgba(8,8,13,0.92)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Noise texture feel — very faint grain overlay */}
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: 'transparent',
          borderWidth: 0,
          opacity: 0.03,
        }]} />
      </View>

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      <View style={[styles.mainCanvas, { paddingTop: insets.top + 4 }]}>

        {/* Drag handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Animated.View style={{ transform: [{ scale: likeBtnScale }] }}>
            <TouchableOpacity
              onPress={() => router.back()}
              onPressIn={() => pressIn(likeBtnScale)}
              onPressOut={() => pressOut(likeBtnScale)}
              activeOpacity={1}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-down-outline" size={30} color={c0} />
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.headerCenter}>
            <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
          </View>

          <TouchableOpacity activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-vertical-outline" size={22} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
        </View>

        {/* ── ALBUM ART — glass card ────────────────────────────────────────── */}
        <View style={styles.albumArtSection}>
          <Animated.View style={[
            styles.artOuterGlow,
            {
              shadowColor: c0,
              opacity: glowPulse.interpolate({ inputRange: [0.5, 1], outputRange: [0.5, 0.85] }),
            }
          ]} />

          <Animated.View style={[
            styles.artGlassContainer,
            {
              shadowColor: c0,
              transform: [
                { scale: Animated.multiply(artScaleAnim, artBreathScale) },
                { translateX: artTranslateX },
              ],
            }
          ]}>
            {/* Layer 1: Blur */}
            <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
            {/* Layer 2: Specular top */}
            <View style={styles.specularEdge} />
            {/* Layer 2: Specular left */}
            <View style={styles.specularStrip} />
            {/* Layer 3: Image */}
            <Image
              source={{ uri: currentTrack.art }}
              style={styles.albumImage}
              contentFit="cover"
              transition={300}
            />
            {/* Layer 4: Refraction */}
            <View style={styles.refractionOverlay} />
          </Animated.View>
        </View>

        {/* ── SONG INFO ────────────────────────────────────────────────────── */}
        <View style={styles.songInfoSection}>
          <View style={{ flex: 1 }}>
            <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={styles.artistName} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>
          <Animated.View style={{ transform: [{ scale: likeBtnScale }] }}>
            <TouchableOpacity
              onPress={() => setIsLiked(!isLiked)}
              onPressIn={() => pressIn(likeBtnScale)}
              onPressOut={() => pressOut(likeBtnScale)}
              activeOpacity={1}
              style={styles.likeBtn}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={28}
                color={isLiked ? c0 : 'rgba(180,180,195,0.5)'}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ── SCRUBBER — animated progress ─────────────────────────────────── */}
        <View style={styles.scrubberSection} {...scrubberResponder.panHandlers}>
          {/* Glass track container */}
          <GlassCard style={styles.scrubberCard} borderRadius={8} blurIntensity={30}>
            <View style={styles.scrubberOuter} onLayout={(e) => setScrubberWidth(e.nativeEvent.layout.width)}>
              {/* Filled track */}
              <Animated.View style={[styles.scrubberInnerWrapper, { width: barWidth }]}>
                <LinearGradient
                  colors={[c0, c1] as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Shimmer highlight on filled bar */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.25)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              {/* Thumb */}
              <Animated.View style={[
                styles.scrubberThumbWrapper,
                { left: thumbLeft },
              ]}>
                {/* Glow ring */}
                <Animated.View style={[
                  styles.thumbGlowRing,
                  {
                    shadowColor: c0,
                    opacity: thumbGlowPulse,
                    transform: [{
                      scale: thumbGlowPulse.interpolate({
                        inputRange: [0.4, 1], outputRange: [1, 1.6]
                      })
                    }],
                  }
                ]} />
                {/* Thumb dot */}
                <Animated.View style={[
                  styles.scrubberThumb,
                  {
                    shadowColor: c0,
                    transform: [{ scale: scrubberThumbScale }],
                  }
                ]} />
              </Animated.View>
            </View>
          </GlassCard>

          {/* Time labels */}
          <View style={styles.timeLabels}>
            <Text style={styles.timeLabel}>{formatTime(elapsedSec)}</Text>
            <Text style={styles.timeLabel}>-{formatTime(currentTrack.durationSec - elapsedSec)}</Text>
          </View>
        </View>

        {/* ── PLAYBACK CONTROLS ────────────────────────────────────────────── */}
        <View style={styles.playbackControls}>
          {/* Prev */}
          <Animated.View style={{ transform: [{ scale: prevBtnScale }] }}>
            <TouchableOpacity
              onPress={onPrev}
              onPressIn={() => pressIn(prevBtnScale)}
              onPressOut={() => pressOut(prevBtnScale)}
              activeOpacity={1}
              style={styles.skipBtn}
            >
              <Ionicons name="play-skip-back" size={34} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </Animated.View>

          {/* Play/Pause — full glass treatment */}
          <View style={styles.playButtonWrapper}>
            {/* Ambient glow layer */}
            <Animated.View style={[
              styles.playButtonGlow,
              {
                backgroundColor: c0,
                opacity: glowPulse.interpolate({ inputRange: [0.5, 1], outputRange: [0.18, 0.36] }),
                transform: [{ scale: glowScale }],
              }
            ]} />
            {/* Second glow ring */}
            <Animated.View style={[
              styles.playButtonGlowOuter,
              {
                borderColor: hexToRgba(c0, 0.20),
                transform: [{ scale: glowScale }],
              }
            ]} />

            <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
              <TouchableOpacity
                onPress={() => setIsPlaying(!isPlaying)}
                onPressIn={() => pressIn(playBtnScale)}
                onPressOut={() => pressOut(playBtnScale)}
                activeOpacity={1}
                style={styles.playButtonShell}
              >
                {/* Layer 1: blur */}
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                {/* Layer 3: gradient */}
                <LinearGradient
                  colors={[c0, hexToRgba(c0, 0.75), c1] as [string, string, string]}
                  start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Layer 2: specular top arc */}
                <View style={styles.playSpecularTop} />
                {/* Layer 2: specular left */}
                <View style={styles.playSpecularLeft} />
                {/* Layer 4: refraction */}
                <View style={styles.playRefractionOverlay} />

                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={46}
                  color="#FFF"
                  style={{ marginLeft: isPlaying ? 0 : 5, zIndex: 5 }}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Next */}
          <Animated.View style={{ transform: [{ scale: nextBtnScale }] }}>
            <TouchableOpacity
              onPress={onNext}
              onPressIn={() => pressIn(nextBtnScale)}
              onPressOut={() => pressOut(nextBtnScale)}
              activeOpacity={1}
              style={styles.skipBtn}
            >
              <Ionicons name="play-skip-forward" size={34} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ── SECONDARY CONTROLS ───────────────────────────────────────────── */}
        <View style={styles.secondaryControls}>
          <Animated.View style={{ transform: [{ scale: shuffleBtnScale }] }}>
            <TouchableOpacity
              onPress={() => setActiveFilter(activeFilter === 'shuffle' ? 'none' : 'shuffle')}
              onPressIn={() => pressIn(shuffleBtnScale)}
              onPressOut={() => pressOut(shuffleBtnScale)}
              activeOpacity={1}
            >
              <Ionicons name="shuffle" size={22} color={activeFilter === 'shuffle' ? c0 : 'rgba(180,180,195,0.65)'} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: castBtnScale }] }}>
            <TouchableOpacity
              onPressIn={() => pressIn(castBtnScale)}
              onPressOut={() => pressOut(castBtnScale)}
              activeOpacity={1}
            >
              <Ionicons name="radio-outline" size={22} color="rgba(180,180,195,0.65)" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: repeatBtnScale }] }}>
            <TouchableOpacity
              onPress={() => setActiveFilter(activeFilter === 'repeat' ? 'none' : 'repeat')}
              onPressIn={() => pressIn(repeatBtnScale)}
              onPressOut={() => pressOut(repeatBtnScale)}
              activeOpacity={1}
            >
              <Ionicons name="repeat" size={22} color={activeFilter === 'repeat' ? c0 : 'rgba(180,180,195,0.65)'} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ── ADDITIONAL ICON ROW ───────────────────────────────────────────── */}
        <Animated.View style={[
          styles.additionalIconRow,
          { opacity: iconRowOpacity, transform: [{ scale: iconRowScale }] }
        ]}>
          {[
            { 
              key: 'lyrics', 
              icon: 'chatbubble-ellipses-outline', 
              label: 'LYRICS', 
              scale: lyricsBtnScale, 
              color: 'rgba(255,255,255,0.65)', 
              onPress: () => router.push({
                pathname: '/lyrics',
                params: { trackId: currentTrack.id }
              }) 
            },
            { key: 'download', icon: isDownloaded ? 'checkmark-circle' : 'arrow-down-circle-outline', label: 'DOWNLOAD', scale: dlBtnScale, color: isDownloaded ? '#46f5e0' : 'rgba(255,255,255,0.65)', onPress: () => setIsDownloaded(!isDownloaded) },
            { key: 'share', icon: 'share-outline', label: 'SHARE', scale: shareBtnScale, color: 'rgba(255,255,255,0.65)', onPress: onShare },
            { 
              key: 'info', 
              icon: 'information-circle-outline', 
              label: 'INFO', 
              scale: infoBtnScale, 
              color: 'rgba(255,255,255,0.65)', 
              onPress: () => setIsInfoVisible(true) 
            },
            { 
              key: 'settings', 
              icon: 'settings-outline', 
              label: 'SETTINGS', 
              scale: settingsBtnScale, 
              color: 'rgba(255,255,255,0.65)', 
              onPress: () => router.push('/(tabs)/settings') 
            },
          ].map(item => (
            <View key={item.key} style={styles.iconButtonContainer}>
              <Animated.View style={{ transform: [{ scale: item.scale }] }}>
                <TouchableOpacity
                  onPress={item.onPress}
                  onPressIn={() => pressIn(item.scale)}
                  onPressOut={() => pressOut(item.scale)}
                  activeOpacity={1}
                  style={styles.iconButton}
                >
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.iconLabel}>{item.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── VOLUME SLIDER ────────────────────────────────────────────────── */}
        <View style={styles.volumeSection} {...volumeResponder.panHandlers}>
          <Ionicons name="volume-low" size={18} color="rgba(255,255,255,0.30)" />
          <GlassCard style={styles.volumeCardTrack} borderRadius={4} blurIntensity={25}>
            <View style={styles.volumeTrackInner} onLayout={(e) => setVolumeWidth(e.nativeEvent.layout.width)}>
              <Animated.View style={[styles.volumeFillWrapper, { width: volumeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
                <LinearGradient
                  colors={[c0, c1] as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Shimmer */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.22)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              {/* Volume thumb */}
              <Animated.View style={[
                styles.volumeThumb, 
                { 
                  left: volumeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), 
                  shadowColor: c0 
                }
              ]} />
            </View>
          </GlassCard>
          <Ionicons name="volume-high" size={18} color="rgba(255,255,255,0.30)" />
        </View>

      </View>

      {/* ── INFO MODAL ── */}
      <Modal
        visible={isInfoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsInfoVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsInfoVisible(false)}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          
          <GlassCard style={styles.infoModalContent} borderRadius={30} blurIntensity={80}>
             <View style={styles.infoHeader}>
               <Text style={styles.infoTitle}>Track Details</Text>
               <TouchableOpacity onPress={() => setIsInfoVisible(false)}>
                 <Ionicons name="close-circle-outline" size={28} color="rgba(255,255,255,0.4)" />
               </TouchableOpacity>
             </View>

             <View style={styles.infoDivider} />

             <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Bitrate</Text>
                  <Text style={styles.infoValue}>320kbps (HQ)</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Sample Rate</Text>
                  <Text style={styles.infoValue}>44.1kHz</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Format</Text>
                  <Text style={styles.infoValue}>FLAC</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Length</Text>
                  <Text style={styles.infoValue}>{formatTime(currentTrack.durationSec)}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Genre</Text>
                  <Text style={styles.infoValue}>Synthwave / Retro</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Copyright</Text>
                  <Text style={styles.infoValue}>© 2026 Cosmic Records</Text>
                </View>
             </View>

             <TouchableOpacity 
               style={[styles.infoCloseBtn, { backgroundColor: c0 }]} 
               onPress={() => setIsInfoVisible(false)}
             >
                <Text style={styles.infoCloseText}>DONE</Text>
             </TouchableOpacity>
          </GlassCard>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080d',
  },
  mainCanvas: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 32,
  },

  // Drag handle
  dragHandleContainer: { alignItems: 'center', marginBottom: 16 },
  dragHandle: { width: 36, height: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  nowPlayingLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },

  // Album art
  albumArtSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  artOuterGlow: {
    position: 'absolute',
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 50,
  },
  artGlassContainer: {
    width: width * 0.78,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.65,
    shadowRadius: 40,
    elevation: 20,
    backgroundColor: 'rgba(20,20,28,0.5)',
  },
  specularEdge: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1.5, backgroundColor: 'rgba(255,255,255,0.26)', zIndex: 5,
  },
  specularStrip: {
    position: 'absolute', top: 0, left: -18, width: 38, height: '100%',
    backgroundColor: 'rgba(255,255,255,0.13)',
    transform: [{ skewX: '-8deg' }], zIndex: 5,
  },
  albumImage: { flex: 1, borderRadius: 24 },
  refractionOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.03)', zIndex: 6,
  },

  // Song info
  songInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  trackTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  artistName: {
    fontSize: 16,
    color: 'rgba(170,170,185,0.70)',
    fontWeight: '500',
    marginTop: 4,
  },
  likeBtn: { padding: 6 },

  // Scrubber
  scrubberSection: { marginBottom: 24 },
  scrubberCard: { marginBottom: 10 },
  scrubberOuter: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    position: 'relative',
    overflow: 'visible',
  },
  scrubberInnerWrapper: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scrubberThumbWrapper: {
    position: 'absolute',
    top: '50%',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGlowRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  scrubberThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },

  // Playback
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  skipBtn: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonWrapper: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonGlow: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    zIndex: 0,
  },
  playButtonGlowOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    zIndex: 0,
  },
  playButtonShell: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
    ...Platform.select({
      ios: { shadowColor: '#9B38DA', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.65, shadowRadius: 14 },
      android: { elevation: 14 },
    }),
  },
  playSpecularTop: {
    position: 'absolute', top: 3, left: 14, right: 14,
    height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.32)', zIndex: 4,
  },
  playSpecularLeft: {
    position: 'absolute', left: 8, top: 10, width: 24, bottom: 10,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ skewX: '-8deg' }], zIndex: 4,
  },
  playRefractionOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 39,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(255,255,255,0.04)', zIndex: 3,
  },

  // Secondary
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    marginBottom: 24,
  },

  // Additional icon row
  additionalIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  iconButtonContainer: { alignItems: 'center', width: 52 },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconLabel: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Volume
  volumeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  volumeCardTrack: {
    flex: 1,
    height: 6,
    marginHorizontal: 14,
  },
  volumeTrackInner: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'visible',
  },
  volumeFillWrapper: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    borderRadius: 3,
    overflow: 'hidden',
  },
  volumeThumb: {
    position: 'absolute',
    top: '50%',
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 7,
    backgroundColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  infoModalContent: {
    width: width * 0.88,
    padding: 24,
    marginHorizontal: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 28,
  },
  infoItem: {
    width: '46%',
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  infoCloseBtn: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  infoCloseText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});