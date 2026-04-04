import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// ── Responsive Dimensions ────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const isTablet = SCREEN_W >= 768;
const isSmall = SCREEN_H < 700;
const BASE_PAD = isTablet ? 32 : 20;
const HERO_H = isSmall ? 180 : isTablet ? 280 : 220;
const BENTO_H = isSmall ? 130 : isTablet ? 200 : 160;
const GRID_COLS = isTablet ? 3 : 2;
const GRID_GAP = isTablet ? 20 : 16;
const GRID_ART_W = (SCREEN_W - BASE_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  primary: '#BF5AF2',
  primaryMid: '#9B38DA',
  primaryDeep: '#7B2FBE',
  accent: '#46f5e0',
  bg: '#08080D',
  surface: 'rgba(18,18,22,0.72)',
  surfaceMid: 'rgba(28,28,36,0.68)',
  border: 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.18)',
  topEdge: 'rgba(255,255,255,0.13)',
  text: '#FFFFFF',
  textMuted: 'rgba(170,170,185,0.60)',
  textSub: 'rgba(255,255,255,0.75)',
};

const MOTION = {
  SLIDE: { tension: 60, friction: 9 },
  POP: { tension: 200, friction: 8 },
  SHEET: { tension: 45, friction: 11 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const hex2rgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── 4-Layer Liquid Glass Card ─────────────────────────────────────────────────
const Glass = ({
  children, style, radius = 22, blur = 65,
  glow = false, glowColor = C.primary,
}: any) => (
  <View style={[{
    borderRadius: radius, overflow: 'hidden',
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  }, style]}>
    {/* L1 — Blur */}
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    {/* L2 — Specular top */}
    <View style={{
      position: 'absolute', top: 0,
      left: radius * 0.45, right: radius * 0.45,
      height: 1.5, backgroundColor: 'rgba(255,255,255,0.22)', zIndex: 8,
    }} />
    {/* L2 — Specular left strip */}
    <View style={{
      position: 'absolute', left: 7, top: 10, bottom: 10,
      width: 2.5, backgroundColor: 'rgba(255,255,255,0.13)',
      transform: [{ skewX: '-8deg' }], zIndex: 8,
    }} />
    {/* L3 — optional glow tint */}
    {glow && (
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius, backgroundColor: hex2rgba(glowColor, 0.06) }} />
    )}
    {/* L4 — Refraction */}
    <View style={{
      ...StyleSheet.absoluteFillObject, borderRadius: radius,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
      backgroundColor: 'rgba(255,255,255,0.025)',
    }} />
    {children}
  </View>
);

// ── Materialise (staggered entrance) ─────────────────────────────────────────
const Mat = ({ children, delay = 0, style }: any) => {
  const sc = useRef(new Animated.Value(0.92)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, ...MOTION.SLIDE, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <Animated.View style={[{ opacity: op, transform: [{ scale: sc }] }, style]}>{children}</Animated.View>;
};

// ── Press-scale hook ──────────────────────────────────────────────────────────
const usePress = () => {
  const sc = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(sc, { toValue: 0.88, ...MOTION.POP, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(sc, { toValue: 1.0, ...MOTION.POP, useNativeDriver: true }).start();
  return { sc, onIn, onOut };
};

// ── Track Row ─────────────────────────────────────────────────────────────────
const TrackRow = ({ track, delay }: any) => {
  const p = usePress();
  const router = useRouter();
  return (
    <Mat delay={delay}>
      <Animated.View style={{ transform: [{ scale: p.sc }] }}>
        <TouchableOpacity
          style={ss.trackRow}
          onPressIn={p.onIn} onPressOut={p.onOut}
          activeOpacity={1}
          onPress={() => router.push({ pathname: '/now_playing', params: { trackId: track.id } })}
        >
          <Glass style={ss.trackCard} radius={16} blur={40}>
            <View style={ss.trackInner}>
              <Image
                source={{ uri: `https://picsum.photos/seed/${track.id * 17}/200` }}
                style={ss.trackArt}
                contentFit="cover"
                transition={200}
              />
              <View style={ss.trackCenter}>
                <View style={ss.trackNameRow}>
                  <Text style={ss.trackName} numberOfLines={1}>{track.title}</Text>
                  <Ionicons name="checkmark-circle" size={14} color={C.accent} />
                </View>
                <Text style={ss.trackArtist} numberOfLines={1}>{track.artist} • Night Mix</Text>
              </View>
              <Text style={ss.trackDuration}>{track.time}</Text>
              <Ionicons name="ellipsis-vertical" size={18} color={C.textMuted} />
            </View>
          </Glass>
        </TouchableOpacity>
      </Animated.View>
    </Mat>
  );
};

// ── Playlist Grid Cell ────────────────────────────────────────────────────────
const PlaylistCell = ({ item, delay, router }: any) => {
  const p = usePress();
  return (
    <Mat delay={delay}>
      <Animated.View style={[ss.gridCell, { width: GRID_ART_W, transform: [{ scale: p.sc }] }]}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
          onPressIn={p.onIn} onPressOut={p.onOut}
          activeOpacity={1}
        >
          {/* Art frame with glass border */}
          <View style={[ss.gridArtFrame, { borderRadius: isTablet ? 26 : 22 }]}>
            <Image
              source={{ uri: item.art }}
              style={[ss.gridArt, { borderRadius: isTablet ? 26 : 22 }]}
              contentFit="cover"
              transition={300}
            />
            {/* Glass refraction on art */}
            <View style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: isTablet ? 26 : 22,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            }} />
            {/* Specular arc top */}
            <View style={{
              position: 'absolute', top: 0, left: 20, right: 20,
              height: 1.5, backgroundColor: 'rgba(255,255,255,0.18)',
            }} />
          </View>
          <Text style={ss.gridName} numberOfLines={1}>{item.name}</Text>
          <Text style={ss.gridCount}>{item.count}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Mat>
  );
};

// ── Data ──────────────────────────────────────────────────────────────────────
const TRACKS = [
  { id: '1', title: 'Midnight City', artist: 'M83', time: '04:03' },
  { id: '2', title: 'Starboy', artist: 'The Weeknd', time: '03:50' },
  { id: '3', title: 'Nightcall', artist: 'Kavinsky', time: '04:18' },
];

const PLAYLISTS = [
  { id: 'late-night-mix', name: 'Late Night Mix', count: '45 Songs', art: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80' },
  { id: 'focus-flow', name: 'Focus Flow', count: '120 Songs', art: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80' },
  { id: 'late-drive', name: 'Late Drive', count: '34 Songs', art: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80' },
];

const TABS = ['Playlists', 'Albums', 'Artists', 'Songs', 'Downloaded'];

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Playlists');

  // Tab pill animation
  const [layouts, setLayouts] = useState<any>({});
  const tabSlide = useRef(new Animated.Value(14)).current; // Initial padded X
  const tabWidth = useRef(new Animated.Value(80)).current;
  const tabPillScale = useRef(new Animated.Value(1)).current;
  const initialSet = useRef(false);

  // Animated BG gradient — slowly shifts between 3 colour states
  const bgPhase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgPhase, { toValue: 1, duration: 5000, useNativeDriver: false }),
        Animated.timing(bgPhase, { toValue: 2, duration: 5000, useNativeDriver: false }),
        Animated.timing(bgPhase, { toValue: 0, duration: 5000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  // Interpolated glow positions — moves the blobs slowly
  const blob1X = bgPhase.interpolate({ inputRange: [0, 1, 2], outputRange: ['-25%', '-10%', '-30%'] });
  const blob1Y = bgPhase.interpolate({ inputRange: [0, 1, 2], outputRange: ['8%', '18%', '5%'] });
  const blob2X = bgPhase.interpolate({ inputRange: [0, 1, 2], outputRange: ['-20%', '-35%', '-15%'] });
  const blob2Y = bgPhase.interpolate({ inputRange: [0, 1, 2], outputRange: ['55%', '45%', '60%'] });
  const blob1Op = bgPhase.interpolate({ inputRange: [0, 1, 2], outputRange: [0.14, 0.20, 0.12] });
  const blob2Op = bgPhase.interpolate({ inputRange: [0, 1, 2], outputRange: [0.10, 0.14, 0.18] });

  // Settings btn press
  const settingsPress = usePress();
  const heroPress = usePress();

  const handleTabLayout = (idx: number, e: any) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev: any) => ({ ...prev, [idx]: { x, width } }));

    // Initialize pill to first tab once layouts are ready
    if (idx === 0 && !initialSet.current) {
      tabSlide.setValue(x + 6);
      tabWidth.setValue(width - 12);
      initialSet.current = true;
    }
  };

  const selectTab = useCallback((tab: string, idx: number) => {
    const layout = layouts[idx];
    if (!layout) return;

    setActiveTab(tab);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(tabPillScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
        Animated.spring(tabPillScale, { toValue: 1, ...MOTION.POP, useNativeDriver: true }),
      ]),
      Animated.spring(tabSlide, { toValue: layout.x + 6, ...MOTION.SLIDE, useNativeDriver: true }),
      Animated.spring(tabWidth, { toValue: layout.width - 12, ...MOTION.SLIDE, useNativeDriver: false }),
    ]).start();
  }, [layouts]);

  return (
    <View style={ss.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── ANIMATED BG ─────────────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Base */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />

        {/* Moving blob 1 — purple */}
        <Animated.View style={[ss.blob, {
          width: SCREEN_W * 0.85, height: SCREEN_W * 0.85,
          backgroundColor: '#2a0053',
          left: blob1X, top: blob1Y,
          opacity: blob1Op,
        }]} />

        {/* Moving blob 2 — teal */}
        <Animated.View style={[ss.blob, {
          width: SCREEN_W * 0.75, height: SCREEN_W * 0.75,
          backgroundColor: '#003731',
          right: blob2X, top: blob2Y,
          opacity: blob2Op,
        }]} />

        {/* Third accent blob — deep purple */}
        <Animated.View style={[ss.blob, {
          width: SCREEN_W * 0.55, height: SCREEN_W * 0.55,
          backgroundColor: '#1a0038',
          left: '-10%', bottom: '20%',
          opacity: bgPhase.interpolate({ inputRange: [0, 1, 2], outputRange: [0.08, 0.16, 0.10] }),
        }]} />

        {/* Overlay vignette */}
        <LinearGradient
          colors={['rgba(8,8,13,0.1)', 'rgba(8,8,13,0.65)', 'rgba(8,8,13,0.92)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <Mat delay={0}>
          <View style={[ss.header, { paddingTop: insets.top + (isTablet ? 24 : 18) }]}>
            <View style={ss.headerLeft}>
              <Text style={ss.headerTitle}>Library</Text>
            </View>

          </View>
        </Mat>

        {/* ── TAB BAR — sticky liquid glass ──────────────────────────────────── */}
        <View style={ss.tabBarOuter}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          {/* top edge */}
          <View style={ss.tabBarTopEdge} />
          {/* bottom border */}
          <View style={ss.tabBarBottomEdge} />
          {/* refraction */}
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.015)' }} />

          <View style={[ss.tabScroll, { width: SCREEN_W }]}>
            {/* Sliding glass pill */}
            <Animated.View
              pointerEvents="none"
              style={[ss.tabActivePill, {
                width: tabWidth,
                transform: [{ translateX: tabSlide }, { scale: tabPillScale }],
              }]}
            >
              <LinearGradient
                colors={[C.primary, C.primaryMid, C.primaryDeep]}
                start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={ss.pillSpecTop} />
              <View style={ss.pillSpecLeft} />
              <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)' }} />
            </Animated.View>

            {TABS.map((tab, idx) => (
              <TouchableOpacity
                key={tab}
                onLayout={(e) => handleTabLayout(idx, e)}
                onPress={() => selectTab(tab, idx)}
                activeOpacity={1}
                style={[ss.tabItem, { flex: 1, alignItems: 'center' }]}
              >
                <Text style={[ss.tabText, activeTab === tab && ss.tabTextActive]}>
                  {tab.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── PAGE CONTENT ──────────────────────────────────────────────────── */}
        <View style={ss.content}>

          {/* ── HERO CARD — Liked Songs ──────────────────────────────────────── */}
          <Mat delay={60}>
            <Animated.View style={{ transform: [{ scale: heroPress.sc }] }}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={heroPress.onIn} onPressOut={heroPress.onOut}
                onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: 'liked-songs' } })}
              >
                <Glass style={[ss.heroCard, { height: HERO_H }]} radius={24} blur={55}>
                  <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80' }}
                    style={StyleSheet.absoluteFill}
                    imageStyle={{ opacity: 0.55, borderRadius: 24 }}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                  />
                  <View style={ss.heroContent}>
                    {/* Heart icon with glow */}
                    <View style={ss.heroHeartWrapper}>
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                      <LinearGradient
                        colors={[C.primary, C.primaryMid]}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={ss.heroHeartSpecular} />
                      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }} />
                      <Ionicons name="heart" size={isTablet ? 36 : 28} color="#FFF" style={{ zIndex: 2 }} />
                    </View>
                    <View>
                      <Text style={ss.heroTitle}>Liked Songs</Text>
                      <Text style={ss.heroSub}>1,248 tracks • Updated 2m ago</Text>
                    </View>
                  </View>
                </Glass>
              </TouchableOpacity>
            </Animated.View>
          </Mat>

          {/* ── BENTO ROW ────────────────────────────────────────────────────── */}
          <Mat delay={100}>
            <View style={[ss.bentoRow, { height: BENTO_H }]}>

              {/* Create Playlist */}
              <Glass style={ss.bentoHalf} radius={22} blur={60}>
                <TouchableOpacity 
                  style={ss.bentoTouchable} 
                  activeOpacity={0.85}
                  onPress={() => router.push('/create_playlist')}
                >
                  <View style={ss.createInner}>
                    {/* Dashed border area */}
                    <View style={ss.dashedBorder}>
                      <View style={ss.plusCircle}>
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} />
                        <Ionicons name="add" size={22} color={C.text} />
                      </View>
                    </View>
                    <Text style={ss.createLabel}>CREATE{'\n'}PLAYLIST</Text>
                  </View>
                </TouchableOpacity>
              </Glass>

              {/* Downloads */}
              <Glass style={ss.bentoHalf} radius={22} blur={60} glow glowColor={C.accent}>
                <TouchableOpacity
                  style={ss.bentoTouchable}
                  onPress={() => router.push('/downloads')}
                  activeOpacity={0.85}
                >
                  <View style={ss.dlModule}>
                    <View style={ss.dlTop}>
                      <View style={ss.dlIconRing}>
                        <Ionicons name="checkmark-done" size={18} color={C.accent} />
                      </View>
                      {/* Live pill */}
                      <View style={ss.livePill}>
                        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 12, borderWidth: 1, borderColor: hex2rgba(C.accent, 0.25), backgroundColor: hex2rgba(C.accent, 0.08) }} />
                        <View style={ss.liveDot} />
                        <Text style={ss.liveText}>LIVE</Text>
                      </View>
                    </View>
                    <View>
                      <Text style={ss.dlTitle}>Downloads</Text>
                      <Text style={ss.dlMeta}>84 GB Available</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Glass>

            </View>
          </Mat>

          {/* ── RECENT DOWNLOADS SECTION ─────────────────────────────────────── */}
          <Mat delay={160}>
            <View style={ss.sectionHeader}>
              <View style={ss.sectionTitleRow}>
                <View style={[ss.accentBar, {
                  backgroundColor: C.primary,
                  ...Platform.select({ ios: { shadowColor: C.primary, shadowRadius: 6, shadowOpacity: 0.7, shadowOffset: { width: 0, height: 0 } } })
                }]} />
                <Text style={ss.sectionTitle}>Recent Downloads</Text>
              </View>
              <TouchableOpacity>
                <Text style={ss.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
          </Mat>

          <View style={ss.trackList}>
            {TRACKS.map((track, idx) => (
              <TrackRow key={track.id} track={track} delay={190 + idx * 45} />
            ))}
          </View>

          {/* ── MY PLAYLISTS SECTION ─────────────────────────────────────────── */}
          <Mat delay={340}>
            <View style={[ss.sectionHeader, { marginTop: 32 }]}>
              <View style={ss.sectionTitleRow}>
                <View style={[ss.accentBar, {
                  backgroundColor: C.accent,
                  ...Platform.select({ ios: { shadowColor: C.accent, shadowRadius: 6, shadowOpacity: 0.7, shadowOffset: { width: 0, height: 0 } } })
                }]} />
                <Text style={ss.sectionTitle}>My Playlists</Text>
              </View>
            </View>
          </Mat>

          {/* Responsive grid — 2 cols on phone, 3 on tablet */}
          <View style={ss.playlistGrid}>
            {PLAYLISTS.slice(0, GRID_COLS * 2).map((item, idx) => (
              <PlaylistCell key={item.id} item={item} delay={370 + idx * 50} router={router} />
            ))}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // BG blobs
  blob: {
    position: 'absolute',
    borderRadius: SCREEN_W * 0.5,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BASE_PAD, paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: {
    fontSize: isTablet ? 38 : 32,
    fontWeight: '800', color: C.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  settingsCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },

  // Tab bar
  tabBarOuter: {
    height: 54, overflow: 'hidden',
    backgroundColor: 'rgba(14,14,18,0.5)',
  },
  tabBarTopEdge: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 0.5, backgroundColor: 'rgba(255,255,255,0.10)', zIndex: 10,
  },
  tabBarBottomEdge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 0.5, backgroundColor: 'rgba(255,255,255,0.07)', zIndex: 10,
  },
  tabScroll: {
    paddingHorizontal: BASE_PAD - 6,
    alignItems: 'center', flexDirection: 'row',
    height: 54, position: 'relative',
  },
  tabActivePill: {
    position: 'absolute',
    height: 36, borderRadius: 18,
    top: 9, left: 0,
    overflow: 'hidden', zIndex: 0,
  },
  pillSpecTop: {
    position: 'absolute', top: 2, left: 12, right: 12,
    height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)',
  },
  pillSpecLeft: {
    position: 'absolute', left: 8, top: 5, bottom: 5,
    width: 20, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ skewX: '-8deg' }],
  },
  tabItem: {
    height: 54, justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  tabText: {
    fontSize: isTablet ? 13 : 12, fontWeight: '600',
    color: C.textMuted, letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  tabTextActive: { color: C.text, fontWeight: '700' },

  // Content
  content: { paddingHorizontal: BASE_PAD, paddingTop: 20 },

  // Hero
  heroCard: { marginBottom: 18, overflow: 'hidden' },
  heroContent: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  heroHeartWrapper: {
    width: isTablet ? 64 : 56, height: isTablet ? 64 : 56,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: C.primary, shadowRadius: 14, shadowOpacity: 0.7, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
    }),
  },
  heroHeartSpecular: {
    position: 'absolute', top: 3, left: 10, right: 10,
    height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.30)', zIndex: 3,
  },
  heroTitle: {
    fontSize: isTablet ? 28 : 24, fontWeight: '800', color: C.text,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 },
  },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.70)', marginTop: 3 },

  // Bento
  bentoRow: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  bentoHalf: { flex: 1 },
  bentoTouchable: { flex: 1 },
  createInner: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  dashedBorder: {
    borderStyle: 'dashed', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)', borderRadius: 18,
    padding: 14, alignItems: 'center',
  },
  plusCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  createLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: isSmall ? 10 : 11,
    fontWeight: '700', textAlign: 'center', letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  dlModule: { flex: 1, padding: isSmall ? 14 : 18, justifyContent: 'space-between' },
  dlTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dlIconRing: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: hex2rgba('#46f5e0', 0.10),
    borderWidth: 1, borderColor: hex2rgba('#46f5e0', 0.20),
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, overflow: 'hidden',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#46f5e0',
    ...Platform.select({ ios: { shadowColor: '#46f5e0', shadowRadius: 4, shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 } } }),
  },
  liveText: { fontSize: 9, fontWeight: '800', color: C.accent, letterSpacing: 0.5 },
  dlTitle: { fontSize: isTablet ? 20 : 17, fontWeight: '700', color: C.text },
  dlMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accentBar: { width: 4, height: 22, borderRadius: 2 },
  sectionTitle: {
    fontSize: isTablet ? 22 : 19, fontWeight: '800', color: C.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  viewAll: { fontSize: 13, fontWeight: '600', color: C.primary },

  // Track list
  trackList: { gap: 10, marginBottom: 4 },
  trackRow: {},
  trackCard: {},
  trackInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14, gap: 14,
  },
  trackArt: {
    width: isTablet ? 62 : 52,
    height: isTablet ? 62 : 52,
    borderRadius: 12,
  },
  trackCenter: { flex: 1 },
  trackNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackName: {
    fontSize: isTablet ? 17 : 15, fontWeight: '600', color: C.text,
    flex: 1,
  },
  trackArtist: { fontSize: 13, color: C.textMuted, marginTop: 3 },
  trackDuration: {
    fontSize: 12, color: 'rgba(170,170,185,0.45)', marginRight: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Playlist grid
  playlistGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: GRID_GAP, marginTop: 4,
  },
  gridCell: {},
  gridArtFrame: {
    width: GRID_ART_W, height: GRID_ART_W,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.40, shadowRadius: 16 },
      android: { elevation: 10 },
    }),
  },
  gridArt: { width: GRID_ART_W, height: GRID_ART_W },
  gridName: {
    fontSize: isTablet ? 17 : 15, fontWeight: '700', color: C.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  gridCount: { fontSize: 12, color: C.textMuted, marginTop: 3 },
});