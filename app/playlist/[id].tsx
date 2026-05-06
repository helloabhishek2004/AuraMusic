import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { openArtistByName, openNowPlaying } from '@/src/navigation/music-navigation';

const { width, height } = Dimensions.get('window');

// ── Design Tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  primary:            '#BF5AF2',
  primaryMid:         '#9B38DA',
  primaryDeep:        '#7B2FBE',
  primaryContainer:   '#6200EE',
  surface:            'rgba(18,18,22,0.72)',
  surfaceMid:         'rgba(28,28,36,0.68)',
  onSurface:          '#FFFFFF',
  onSurfaceVariant:   'rgba(170,170,185,0.65)',
  borderGlass:        'rgba(255,255,255,0.09)',
  borderHighlight:    'rgba(255,255,255,0.18)',
  topEdgeLight:       'rgba(255,255,255,0.13)',
  accent:             '#46f5e0',
};

const MOTION = {
  SLIDE:    { tension: 60,  friction: 9  },
  POP:      { tension: 200, friction: 8  },
  SHEET:    { tension: 45,  friction: 11 },
};

// ── Mock Data (unchanged) ────────────────────────────────────────────────────
const PLAYLIST_DATA = {
  id: 'late-night-drive',
  title: 'Late Night Drive',
  description: 'Moody synthwave and deep club tracks for the open road.',
  stats: '34 songs • 2h 14m • Updated 3 days ago',
  art: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=800',
  tracks: [
    { id: '1', title: 'Midnight City',  artist: 'M83',         duration: '4:03', active: true,  art: 'https://picsum.photos/seed/m83/200'        },
    { id: '2', title: 'Starboy',        artist: 'The Weeknd',  duration: '3:50', active: false, art: 'https://picsum.photos/seed/starboy/200'     },
    { id: '3', title: 'Nightcall',      artist: 'Kavinsky',    duration: '4:18', active: false, art: 'https://picsum.photos/seed/kavinsky/200'    },
    { id: '4', title: 'After Hours',    artist: 'The Weeknd',  duration: '6:02', active: false, art: 'https://picsum.photos/seed/afterhours/200'  },
    { id: '5', title: 'Resonance',      artist: 'HOME',        duration: '3:32', active: false, art: 'https://picsum.photos/seed/resonance/200'   },
  ],
  suggested: [
    { id: 's1', title: 'Blinding Lights', artist: 'The Weeknd', art: 'https://picsum.photos/seed/blinding/200' },
    { id: 's2', title: 'Save Your Tears', artist: 'The Weeknd', art: 'https://picsum.photos/seed/save/200'     },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const hexToRgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── Liquid Glass Card — 4-layer system ────────────────────────────────────────
const GlassPane = ({
  children, style, borderRadius = 20, blurIntensity = 60,
  accentGlow = false, accentColor = COLORS.primary,
}: any) => (
  <View style={[{
    borderRadius,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  }, style]}>
    {/* Layer 1 — Blur base */}
    <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
    {/* Layer 2 — Specular top edge */}
    <View style={{
      position: 'absolute', top: 0,
      left: borderRadius * 0.5, right: borderRadius * 0.5,
      height: 1.5, backgroundColor: 'rgba(255,255,255,0.22)', zIndex: 10,
    }} />
    {/* Layer 2 — Specular left strip */}
    <View style={{
      position: 'absolute', left: 7, top: 10, bottom: 10,
      width: 2.5, backgroundColor: 'rgba(255,255,255,0.14)',
      transform: [{ skewX: '-8deg' }], zIndex: 10,
    }} />
    {/* Optional accent glow tint */}
    {accentGlow && (
      <View style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: hexToRgba(accentColor, 0.07),
        borderRadius,
      }} />
    )}
    {/* Layer 4 — Refraction overlay */}
    <View style={{
      ...StyleSheet.absoluteFillObject, borderRadius,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
      backgroundColor: 'rgba(255,255,255,0.03)',
    }} />
    {children}
  </View>
);

// ── Materialise wrapper ───────────────────────────────────────────────────────
const Materialise = ({ children, delay = 0, style }: any) => {
  const scale   = useRef(new Animated.Value(0.93)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, ...MOTION.SLIDE, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 360,   useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ── Press-scale helper ────────────────────────────────────────────────────────
const usePressScale = (target = 0.94) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scale, { toValue: target, ...MOTION.POP, useNativeDriver: true }).start();
  };
  const onOut = () => Animated.spring(scale, { toValue: 1, ...MOTION.POP, useNativeDriver: true }).start();
  return { scale, onIn, onOut };
};

// ── Track Row ─────────────────────────────────────────────────────────────────
const TrackRow = ({ item, index, router }: any) => {
  const press = usePressScale();
  return (
    <Materialise delay={220 + index * 45}>
      <Animated.View style={{ transform: [{ scale: press.scale }] }}>
        <TouchableOpacity
          style={[styles.trackRow, item.active && styles.activeTrackRow]}
          onPressIn={press.onIn}
          onPressOut={press.onOut}
          activeOpacity={1}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openNowPlaying(router, item.id, 'playlist');
          }}
          onLongPress={() => openArtistByName(router, item.artist, { origin: 'playlist-track' })}
          accessibilityRole="button"
          accessibilityLabel={`Play ${item.title} by ${item.artist}`}
        >
          {/* Active row glass tint */}
          {item.active && (
            <>
              <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
              {/* Active accent left bar */}
              <View style={styles.activeAccentBar} />
            </>
          )}

          <View style={styles.trackIndexContainer}>
            {item.active
              ? <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
              : <Text style={styles.trackIndex}>{(index + 1).toString().padStart(2, '0')}</Text>
            }
          </View>

          <View style={styles.trackArtWrapper}>
            <Image source={{ uri: item.art }} style={styles.trackArt} />
            {item.active && (
              <View style={styles.trackArtPlayOverlay}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 10, borderWidth: 1, borderColor: hexToRgba(COLORS.primary, 0.35), backgroundColor: hexToRgba(COLORS.primary, 0.15) }} />
                <Ionicons name="volume-medium" size={14} color={COLORS.primary} />
              </View>
            )}
          </View>

          <View style={styles.trackInfo}>
            <Text style={[styles.trackName, item.active && { color: COLORS.primary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
          </View>

          <View style={styles.trackMeta}>
            <Ionicons
              name="heart"
              size={16}
              color={item.active ? COLORS.primary : 'rgba(255,255,255,0.12)'}
            />
            <Text style={styles.trackDuration}>{item.duration}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Materialise>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PlaylistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id }  = useLocalSearchParams();

  const [downloadStatus, setDownloadStatus] = useState<'none' | 'checking' | 'updated'>('none');
  const downloadSpin  = useRef(new Animated.Value(0)).current;
  const scrollY       = useRef(new Animated.Value(0)).current;

  // Glow pulse for play button
  const glowPulse  = useRef(new Animated.Value(0.5)).current;
  const glowScale  = useRef(new Animated.Value(1.0)).current;

  const shufflePress   = usePressScale();
  const playPress      = usePressScale();
  const downloadPress  = usePressScale();
  const sharePress     = usePressScale();
  const backPress      = usePressScale();

  // Sticky header visibility
  const headerOpacity = scrollY.interpolate({ inputRange: [60, 160], outputRange: [0, 1], extrapolate: 'clamp' });
  // Hero art parallax
  const artParallax = scrollY.interpolate({ inputRange: [0, 300], outputRange: [0, -60], extrapolate: 'clamp' });
  // Hero text fade on scroll
  const heroFade = scrollY.interpolate({ inputRange: [0, 200], outputRange: [1, 0], extrapolate: 'clamp' });

  useEffect(() => {
    // Play button glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.3, duration: 900, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleDownload = () => {
    if (downloadStatus === 'none') {
      setDownloadStatus('checking');
      Animated.loop(
        Animated.timing(downloadSpin, { toValue: 1, duration: 1000, useNativeDriver: true })
      ).start();
      setTimeout(() => {
        downloadSpin.stopAnimation();
        setDownloadStatus('updated');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 2500);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── BACKGROUND ──────────────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#08080d' }]} />
        {/* Ambient colour blobs */}
        <View style={[styles.glowBlob, { top: '-5%', left: '-25%', backgroundColor: '#2a0053' }]} />
        <View style={[styles.glowBlob, { bottom: '15%', right: '-30%', backgroundColor: '#003731' }]} />
        <View style={[styles.glowBlob, { top: '40%', left: '-15%', width: width * 0.5, height: width * 0.5, backgroundColor: '#1a0038', opacity: 0.2 }]} />
        {/* Dark vignette overlay */}
        <LinearGradient
          colors={['rgba(8,8,13,0)', 'rgba(8,8,13,0.70)', '#08080d']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ── STICKY HEADER — liquid glass ────────────────────────────────────── */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top, opacity: headerOpacity }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        {/* top edge highlight */}
        <View style={styles.stickyTopEdge} />
        {/* refraction */}
        <View style={{ ...StyleSheet.absoluteFillObject, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }} />
        <View style={styles.stickyHeaderInner}>
          <Animated.View style={{ transform: [{ scale: backPress.scale }] }}>
            <TouchableOpacity
              onPress={() => router.back()}
              onPressIn={backPress.onIn} onPressOut={backPress.onOut}
              activeOpacity={1} style={styles.headerBtn}
            >
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.stickyTitle} numberOfLines={1}>{PLAYLIST_DATA.title}</Text>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── SCROLLABLE CONTENT ──────────────────────────────────────────────── */}
      <Animated.ScrollView
        contentInsetAdjustmentBehavior="automatic"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── NAV HEADER ────────────────────────────────────────────────────── */}
        <Materialise delay={0}>
          <View style={styles.navHeader}>
            <Animated.View style={{ transform: [{ scale: backPress.scale }] }}>
              <TouchableOpacity
                onPress={() => router.back()}
                onPressIn={backPress.onIn} onPressOut={backPress.onOut}
                activeOpacity={1}
                style={styles.backBtnCircle}
              >
                <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }} />
                <Ionicons name="chevron-back" size={22} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.moreCircle}>
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }} />
              <Ionicons name="ellipsis-vertical" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </Materialise>

        {/* ── HERO SECTION ──────────────────────────────────────────────────── */}
        <Materialise delay={60}>
          <View style={styles.heroSection}>
            {/* Album art with parallax */}
            <Animated.View style={[styles.artWrapper, { transform: [{ translateY: artParallax }] }]}>
              {/* Ambient glow behind art */}
              <View style={styles.artAmbientGlow} />
              <View style={styles.artAmbientGlowInner} />

              {/* Art glass frame — 4 layers */}
              <View style={styles.artGlassFrame}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                {/* specular top */}
                <View style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1.5, backgroundColor: 'rgba(255,255,255,0.22)', zIndex: 10 }} />
                {/* specular left */}
                <View style={{ position: 'absolute', left: 8, top: 12, bottom: 12, width: 3, backgroundColor: 'rgba(255,255,255,0.14)', transform: [{ skewX: '-8deg' }], zIndex: 10 }} />
                <Image source={{ uri: PLAYLIST_DATA.art }} style={styles.heroArt} />
                {/* refraction */}
                <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.03)' }} />
              </View>

              {/* ENHANCED badge */}
              <GlassPane style={styles.enhancedBadge} borderRadius={20} blurIntensity={50}>
                <View style={styles.badgeContent}>
                  <View style={styles.badgeDot} />
                  <Ionicons name="sparkles" size={11} color={COLORS.primary} style={{ marginRight: 5 }} />
                  <Text style={styles.badgeText}>ENHANCED</Text>
                </View>
              </GlassPane>
            </Animated.View>

            {/* Text + actions */}
            <Animated.View style={[styles.heroTextContainer, { opacity: heroFade }]}>
              <Text style={styles.heroTitle}>{PLAYLIST_DATA.title}</Text>
              <Text style={styles.heroDescription}>{PLAYLIST_DATA.description}</Text>
              <Text style={styles.heroStats}>{PLAYLIST_DATA.stats}</Text>

              <View style={styles.heroActions}>
                {/* Download */}
                <Animated.View style={{ transform: [{ scale: downloadPress.scale }] }}>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPressIn={downloadPress.onIn} onPressOut={downloadPress.onOut}
                    onPress={handleDownload}
                  >
                    <GlassPane style={styles.actionBtn} borderRadius={28} blurIntensity={60}
                      accentGlow={downloadStatus === 'updated'} accentColor={COLORS.accent}
                    >
                      {downloadStatus === 'checking' ? (
                        <Animated.View style={{ transform: [{ rotate: downloadSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                          <Ionicons name="sync" size={22} color={COLORS.primary} />
                        </Animated.View>
                      ) : (
                        <Ionicons
                          name={downloadStatus === 'updated' ? 'cloud-done' : 'download-outline'}
                          size={22}
                          color={downloadStatus === 'updated' ? COLORS.accent : '#FFF'}
                        />
                      )}
                    </GlassPane>
                  </TouchableOpacity>
                </Animated.View>

                {/* Share */}
                <Animated.View style={{ transform: [{ scale: sharePress.scale }] }}>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPressIn={sharePress.onIn} onPressOut={sharePress.onOut}
                  >
                    <GlassPane style={styles.actionBtn} borderRadius={28} blurIntensity={60}>
                      <Ionicons name="share-outline" size={22} color="#FFF" />
                    </GlassPane>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </Animated.View>
          </View>
        </Materialise>

        {/* ── CONTROLS — Shuffle + Play ──────────────────────────────────────── */}
        <Materialise delay={140}>
          <View style={styles.controlSection}>
            {/* Shuffle — full liquid glass gradient pill */}
            <Animated.View style={[styles.shuffleBtnOuter, { transform: [{ scale: shufflePress.scale }] }]}>
              <TouchableOpacity
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
                onPressIn={shufflePress.onIn} onPressOut={shufflePress.onOut}
                activeOpacity={1}
                style={{ flex: 1 }}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryMid, COLORS.primaryDeep]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.shuffleGradient}
                >
                  {/* specular top */}
                  <View style={{ position: 'absolute', top: 3, left: 20, right: 20, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' }} />
                  {/* specular left */}
                  <View style={{ position: 'absolute', left: 10, top: 8, bottom: 8, width: 28, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', transform: [{ skewX: '-8deg' }] }} />
                  {/* refraction border */}
                  <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)' }} />
                  <Ionicons name="shuffle" size={28} color="#FFF" style={{ zIndex: 2 }} />
                  <Text style={styles.shuffleLabel}>Shuffle All</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Play button — full 4-layer glass circle */}
            <View style={styles.playBtnWrapper}>
              {/* Ambient glow */}
              <Animated.View style={[
                styles.playBtnGlow,
                {
                  backgroundColor: COLORS.primary,
                  opacity: glowPulse.interpolate({ inputRange: [0.4, 1], outputRange: [0.20, 0.40] }),
                  transform: [{ scale: glowScale }],
                }
              ]} />
              <Animated.View style={[
                styles.playBtnGlowRing,
                {
                  borderColor: hexToRgba(COLORS.primary, 0.22),
                  transform: [{ scale: glowScale }],
                }
              ]} />

              <Animated.View style={{ transform: [{ scale: playPress.scale }] }}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={playPress.onIn} onPressOut={playPress.onOut}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    router.push({ pathname: '/now_playing', params: { trackId: PLAYLIST_DATA.tracks[0].id } });
                  }}
                  style={styles.playBtnShell}
                >
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                  {/* gradient fill */}
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryMid, COLORS.primaryDeep]}
                    start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* specular */}
                  <View style={{ position: 'absolute', top: 4, left: 14, right: 14, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.30)', zIndex: 4 }} />
                  <View style={{ position: 'absolute', left: 8, top: 10, width: 22, bottom: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.16)', transform: [{ skewX: '-8deg' }], zIndex: 4 }} />
                  {/* refraction */}
                  <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', backgroundColor: 'rgba(255,255,255,0.04)', zIndex: 3 }} />
                  <Ionicons name="play" size={34} color="#FFF" style={{ marginLeft: 4, zIndex: 5 }} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </Materialise>

        {/* ── TRACK LIST ───────────────────────────────────────────────────── */}
        <View style={styles.trackListSection}>
          {PLAYLIST_DATA.tracks.map((item, index) => (
            <TrackRow key={item.id} item={item} index={index} router={router} />
          ))}
        </View>

        {/* ── SUGGESTED SONGS ──────────────────────────────────────────────── */}
        <Materialise delay={480}>
          <View style={styles.suggestedHeader}>
            <View style={styles.suggestedTitleRow}>
              <View style={styles.suggestedAccentBar} />
              <Text style={styles.suggestedTitle}>Suggested Songs</Text>
            </View>
            <TouchableOpacity onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </Materialise>

        <View style={styles.suggestedList}>
          {PLAYLIST_DATA.suggested.map((item, idx) => (
            <Materialise key={item.id} delay={500 + idx * 60}>
              <GlassPane style={styles.suggestedCard} borderRadius={18} blurIntensity={50}>
                <View style={styles.suggestedCardContent}>
                  <Image source={{ uri: item.art }} style={styles.suggestedArt} />
                  <View style={styles.suggestedInfo}>
                    <Text style={styles.suggestedName} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.suggestedArtist} numberOfLines={1}>{item.artist}</Text>
                  </View>
                   <TouchableOpacity 
                    style={styles.addBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                  >
                    <LinearGradient
                      colors={[hexToRgba(COLORS.primary, 0.20), hexToRgba(COLORS.primaryDeep, 0.15)]}
                      style={styles.addBtnGrad}
                    >
                      <Text style={styles.addBtnText}>+ Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </GlassPane>
            </Materialise>
          ))}
        </View>

      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080d' },

  // Background blobs
  glowBlob: {
    position: 'absolute',
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.425,
    opacity: 0.14,
  },

  // Sticky header
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 100, overflow: 'hidden',
    backgroundColor: 'rgba(18,18,22,0.01)',
  },
  stickyTopEdge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', zIndex: 10,
  },
  stickyHeaderInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56,
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  stickyTitle: {
    color: '#FFF', fontSize: 16, fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: -0.3,
  },

  // Nav header
  navHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, marginBottom: 28,
  },
  backBtnCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  moreCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  navAppTitle: {
    color: '#FFF', fontSize: 21, fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: -0.5,
  },

  // Hero
  heroSection: {
    flexDirection: 'column', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 32,
  },
  artWrapper: {
    width: width * 0.76, aspectRatio: 1,
    borderRadius: 24, marginBottom: 28,
    ...Platform.select({
      ios: { shadowColor: '#9B38DA', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.55, shadowRadius: 36 },
      android: { elevation: 24 },
    }),
  },
  artAmbientGlow: {
    position: 'absolute', inset: -20,
    borderRadius: 44,
    backgroundColor: hexToRgba(COLORS.primary, 0.00),
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 40 },
    }),
  },
  artAmbientGlowInner: {
    position: 'absolute', top: -12, left: -12, right: -12, bottom: -12,
    borderRadius: 36,
    backgroundColor: hexToRgba(COLORS.primaryDeep, 0.00),
    ...Platform.select({
      ios: { shadowColor: COLORS.primaryDeep, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.40, shadowRadius: 28 },
    }),
  },
  artGlassFrame: {
    flex: 1, borderRadius: 24, overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  heroArt: { flex: 1, borderRadius: 24 },
  enhancedBadge: {
    position: 'absolute', bottom: 14, left: 14,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  badgeContent: { flexDirection: 'row', alignItems: 'center' },
  badgeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 6,
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowRadius: 4, shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 } },
    }),
  },
  badgeText: {
    color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  heroTextContainer: { width: '100%' },
  heroTitle: {
    color: '#FFF', fontSize: 44, fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: -1.5, lineHeight: 46, marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  heroDescription: {
    color: 'rgba(170,170,185,0.55)', fontSize: 14, fontWeight: '400',
    marginBottom: 6, lineHeight: 20,
  },
  heroStats: {
    color: COLORS.onSurfaceVariant, fontSize: 13, fontWeight: '500',
    marginBottom: 22, letterSpacing: 0.3,
  },
  heroActions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    width: 56, height: 56,
    justifyContent: 'center', alignItems: 'center',
  },

  // Controls
  controlSection: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingHorizontal: 20, marginBottom: 28,
  },
  shuffleBtnOuter: {
    flex: 1, height: 62, borderRadius: 32, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.50, shadowRadius: 14 },
      android: { elevation: 12 },
    }),
  },
  shuffleGradient: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  shuffleLabel: {
    color: '#FFF', fontSize: 17, fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    zIndex: 2,
  },
  playBtnWrapper: {
    width: 62, height: 62,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtnGlow: {
    position: 'absolute', width: 62, height: 62, borderRadius: 31, zIndex: 0,
  },
  playBtnGlowRing: {
    position: 'absolute', width: 74, height: 74, borderRadius: 37,
    borderWidth: 1.5, zIndex: 0,
  },
  playBtnShell: {
    width: 62, height: 62, borderRadius: 31,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', zIndex: 2,
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },

  // Tracks
  trackListSection: { gap: 2, marginBottom: 36, paddingHorizontal: 12 },
  trackRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: 16, overflow: 'hidden',
    position: 'relative',
  },
  activeTrackRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: hexToRgba(COLORS.primary, 0.18),
  },
  activeAccentBar: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2,
    backgroundColor: COLORS.primary,
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowRadius: 6, shadowOpacity: 0.7, shadowOffset: { width: 0, height: 0 } },
    }),
  },
  trackIndexContainer: { width: 28, justifyContent: 'center', alignItems: 'center' },
  trackIndex: {
    color: COLORS.onSurfaceVariant, fontSize: 12, fontWeight: '700',
    fontFamily: 'monospace',
  },
  trackArtWrapper: { width: 48, height: 48, borderRadius: 10, marginRight: 14, position: 'relative', overflow: 'hidden' },
  trackArt: { width: 48, height: 48, borderRadius: 10 },
  trackArtPlayOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  trackInfo: { flex: 1 },
  trackName: {
    color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  trackArtist: { color: COLORS.onSurfaceVariant, fontSize: 13, marginTop: 2 },
  trackMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackDuration: {
    color: COLORS.onSurfaceVariant, fontSize: 12, fontWeight: '600',
    width: 38, textAlign: 'right', fontFamily: 'monospace',
  },

  // Suggested
  suggestedHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, marginBottom: 14,
  },
  suggestedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestedAccentBar: {
    width: 4, height: 22, borderRadius: 2,
    backgroundColor: COLORS.primary,
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowRadius: 6, shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 } },
    }),
  },
  suggestedTitle: {
    color: '#FFF', fontSize: 22, fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  refreshText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  suggestedList: { paddingHorizontal: 20, gap: 12 },
  suggestedCard: {},
  suggestedCardContent: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  suggestedArt: { width: 54, height: 54, borderRadius: 12 },
  suggestedInfo: { flex: 1, marginLeft: 14 },
  suggestedName: {
    color: '#FFF', fontSize: 15, fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  suggestedArtist: { color: COLORS.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  addBtn: { borderRadius: 20, overflow: 'hidden' },
  addBtnGrad: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: hexToRgba(COLORS.primary, 0.30) },
  addBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },

  // Mini player
  floatingMiniPlayerOuter: {
    position: 'absolute', left: 16, right: 16,
    height: 76, zIndex: 1000,
  },
  miniPlayerGlow: {
    position: 'absolute', top: 4, left: '10%', right: '10%', height: 28,
    bottom: -18,
  },
  miniPlayerSurface: { flex: 1 },
  miniProgressTrack: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2.5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2,
  },
  miniProgressFill: { height: '100%', borderRadius: 1 },
  miniPlayerContent: {
    flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 14,
  },
  miniArtWrapper: {
    width: 48, height: 48, borderRadius: 12,
    position: 'relative',
  },
  miniArt: { width: 48, height: 48, borderRadius: 12 },
  miniArtRing: {
    ...StyleSheet.absoluteFillObject, borderRadius: 12,
    borderWidth: 1.5, borderColor: hexToRgba(COLORS.primary, 0.45),
  },
  miniMeta: { flex: 1, marginLeft: 12 },
  miniTitle: {
    color: '#FFF', fontSize: 14, fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  miniArtist: { color: COLORS.onSurfaceVariant, fontSize: 11, marginTop: 2 },
  miniControls: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  miniCtrlBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
