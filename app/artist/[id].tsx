import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
  ScrollView,
  Share,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const PAD = 20;

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  primary: '#BF5AF2',
  primaryMid: '#9B38DA',
  primaryDeep: '#7B2FBE',
  accent: '#46f5e0',
  accentAlt: '#00D4FF',
  bg: '#0F0F13',
  surface: 'rgba(255,255,255,0.055)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.13)',
  text: '#FFFFFF',
  textSecondary: '#A9A9C0',
  textMuted: '#6C6C80',
};

const SP = { tension: 65, friction: 10 };
const MOTION = { POP: { tension: 200, friction: 8 }, SLIDE: { tension: 60, friction: 9 } };

// ── Data Mapping ─────────────────────────────────────────────────────────────
const ARTISTS_DB: Record<string, any> = {
  'elara': {
    name: 'Elara Vance',
    verified: true,
    monthlyListeners: '12.4M Monthly Listeners',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVPNWk1tlfHYyyWTBZhwh81Z6py-WVfUuxGVj51H72sBRafC8YphQ6KN32w47mVX4Vc_Gilgd9z97W25tKGqRujSEIq2yStVYqau9IUi6SHp1oWk4cXmYzmyTW3FjDYeBq6PdVhXaO0tAWivGBf42atMriqBRDwDtZarzZFB8CXSe6nZ2p5F-dWmhBrdH-IMd3mhHX3Thcn_9L_5R7nIJdFSM0Rglel2NhCZiTz9FL4EQBpTBZwwMZTDDbA8vKdPQ3ErzWfZi8Lqw',
    topSongs: [
      { id: '1', title: 'Neon Pulse', album: 'Synthwave Dreams', year: '2024', duration: '3:42', active: true, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAzO02GNA3l-NDFuwh5GDP4Dnfc8rQOC3KkStCMZb5CR6-ehD1qOMl3pNA6c6FjzXNnwntxnX5lqPMlBElIKUo37SKK6_kcuyxvU9adFkLLm_ZKnb6eCe-0jBpfBz4IbuOOFqLxVpD5gsiJcXy4FV6KeH8zSLLAaJtEndA8J5Jd7VccSyRNQOGFF8GOeIKaYPeOPQ-_EuouUvESnitU-7HNDAputZyzDIeM5eNO8kEFo42zcTZFehnlsRkzwm-QNmVnzqz_kHokjOU' },
      { id: '2', title: 'Ghost Border', album: 'Aura Chronicles', year: '2023', duration: '4:11', active: false, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBACP7jafIOuSRotl0kPN2deZRu-vI8D1D6HyfdgqWmIoGA-IfyOYd_y0slIBNpoI4fBr-onfSxamgCX9Fw6tS-uoOLVAatX9P0-aNa-k7n81_CVBHSXph5znqM6o4x5jB6IhOhYRFrCRBf0ORFNaKF6yNHrLcGxUZJomXYkmUzrA2OpvcLfiOOD17gr8IcVH-Y63YWMRnvV8lBk91_qivfLNv_rLWTB_tTsatZbL5v1ZaVLytQDSqVyqqt8lqQ_z86DNbMr93y_JY' },
      { id: '3', title: 'Velvet Void', album: 'Ethereal Sessions', year: '2023', duration: '5:03', active: false, image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDrWQlttj2sje1aiBrW42cU_zIjVHAPnp03JTN497WR39LhPvX5UUqYZ1KRALgBx4j0c__5DrncFy7VKNGvWdiik_MJ2jxPsOJAjH4Y6utrtRCRyZBYh8MopmEjU-ZnvLzgtvjXKcaR4s90U-1PAgJoQv9i75WEJbOrEhKHFmDd6A1fArxzLaCG8uU-55-HyXXSoUZXcKs2QRsPKfKPAoRsqDse5RF_yFTApMwqA2Q2zwK4-HOL-I4Id76c0R5iKLKxJWhI7_0EzR4' },
    ],
    albums: [
      { id: 'a1', title: 'Aura Chronicles', year: '2023', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAz8RqwcbhogJvQK-XSCa1l9QanY-yGYVO-MAr46oay_iMenqdHTTuWjQENKUvx_FZeVYPeKBMsj-mkWDKW2Sf3detWEjeC7COZXxe58Tnxd3xc_ClprrIG_G2wHfQRqOKkBKUYRafyvKCDMtLUyN-EDpM1HORMK65E_-LfJm21Z7trPYcV12yS999Iy7dguJbhk613b94CLrRaZ_ax4urv7aMvHkLd-X12g42ZiDvDIJC7tvm33rzbQD-hM3SP8IzX5KR3rL0MyLc' },
      { id: 'a2', title: 'Glass Horizons', year: '2022', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7aAtCTxo4i6KCgxAmdUwmgPsmeRlhnXplryYoUyK1tJtrInDD-7xH4B2jQsNSzhbp1vnlHa8uIrpKQAlpOiWWGu7G7hU1db25fRyQVvnQDbdNyQGkyDW-GUmgHeavXBx0faviwux5a1kRyDCAHRuuCk2CMNKg-kMFvRd-aaiJ6dR6al-ANB321xYErz7LdJ6TVd56LNpZp9xgYSdudWs4tspMLz3hltAT0g7v-Q1kzCM35Op_wfq9DLvwgyU8vC8Q--R48rW0pgY' },
      { id: 'a3', title: 'Synthwave Dreams', year: '2024', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAzO02GNA3l-NDFuwh5GDP4Dnfc8rQOC3KkStCMZb5CR6-ehD1qOMl3pNA6c6FjzXNnwntxnX5lqPMlBElIKUo37SKK6_kcuyxvU9adFkLLm_ZKnb6eCe-0jBpfBz4IbuOOFqLxVpD5gsiJcXy4FV6KeH8zSLLAaJtEndA8J5Jd7VccSyRNQOGFF8GOeIKaYPeOPQ-_EuouUvESnitU-7HNDAputZyzDIeM5eNO8kEFo42zcTZFehnlsRkzwm-QNmVnzqz_kHokjOU' },
    ],
    insights: { globalRank: '#4', match: '88%', chartData: [0.45, 0.65, 1.0, 0.75, 0.55] },
    biography: "Elara Vance doesn't just create music; she constructs sonic landscapes. Born from the digital fog of London's underground scene, her sound weaves through genres with the precision of a sculptor — carving space out of silence, and filling it with light.",
    similar: [
      { id: 's1', name: 'Lumiere', listeners: '8.2M', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXxnAEONBrxrm1aHJG7P_q70E0zQAINX7jWFfWhNWKHIUlNViAkUQWI_yDd4OaO4mVUlRVmt1XwUXvs31uibSBJ8NmCgn-UhUm5dr0Em6-4K-2BpAOfv6qzRJRpDGdC8GhCqLtJFou2qTdvxFOWgUwEc9e2nEIK0fGF16u_61i4hqTTccOytjYAuhtyNYfSBVbOCk5UrT81ST0Lt1JgPGiOXib3OBz5qcJoOz6XZaabbote6MGeQ7uU6ez4RjWE555l3y7yWmoAfI' },
      { id: 's2', name: 'Vortex', listeners: '4.5M', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJfQTHCsgRAQhT3PFpk0QhA2Fknr2fyKBURl-hnttA53FXzuiSE4WRhuPIFFdEa7CFB7hPfCR7hUVUnA5NI4TF-iM_S2CqlKf42Kogp3fQqKdmI2zlcV97jDnrC0gTgA6t7hR3ezJ2DkvL3vYXyfud5TsWfIEAB_P8O6vn6K4zaBCHZA7_DQgTfd6z9BNU_HoA4EVCkRmSMOusP8cWN2lXYPwG0BXLQtMnN-uDUYMaOxpT8tgp7Zx9N5vSQcLvfum9AwyWiVZKTj8' },
    ],
  },
  '1': {
    name: 'Solstice',
    verified: true,
    monthlyListeners: '8.2M Monthly Listeners',
    image: 'https://picsum.photos/600/800?random=4',
    topSongs: [
      { id: 't1', title: 'Midnight Sun', album: 'Solaris', year: '2024', duration: '3:15', active: true, image: 'https://picsum.photos/300/300?random=41' },
      { id: 't2', title: 'Equinox', album: 'Solaris', year: '2024', duration: '4:20', active: false, image: 'https://picsum.photos/300/300?random=42' },
    ],
    albums: [{ id: 'a4', title: 'Solaris', year: '2024', image: 'https://picsum.photos/400/400?random=43' }],
    insights: { globalRank: '#12', match: '94%', chartData: [0.6, 0.8, 0.7, 0.9, 1.0] },
    biography: "Solstice brings the warmth of the sun into every beat. A pioneer of solar-pop, their music radiates energy and optimism.",
    similar: [{ id: 's3', name: 'Lumina Flux', listeners: '5.1M', image: 'https://picsum.photos/300/300?random=44' }],
  },
  '2': {
    name: 'Luna Ray',
    verified: true,
    monthlyListeners: '5.4M Monthly Listeners',
    image: 'https://picsum.photos/600/800?random=5',
    topSongs: [{ id: 't3', title: 'Moonlight', album: 'Lunar Phase', year: '2023', duration: '3:50', active: true, image: 'https://picsum.photos/300/300?random=51' }],
    albums: [{ id: 'a5', title: 'Lunar Phase', year: '2023', image: 'https://picsum.photos/400/400?random=52' }],
    insights: { globalRank: '#28', match: '76%', chartData: [0.3, 0.5, 0.4, 0.6, 0.5] },
    biography: "Luna Ray captures the mysterious beauty of the night sky in her ethereal synth compositions.",
    similar: [{ id: 's4', name: 'Digital Echo', listeners: '3.2M', image: 'https://picsum.photos/300/300?random=53' }],
  },
};

const ARTIST_DEFAULT = ARTISTS_DB['elara'];

// ── Glass Pane ─────────────────────────────────────────────────────────────────
const GlassPane = ({ children, style, r = 20, blur = 40, accent = false }: any) => (
  <View style={[{ borderRadius: r, overflow: 'hidden' }, style]}>
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: C.surface, borderRadius: r }]} />
    {/* specular top line */}
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: r * 0.25, right: r * 0.25, height: 1, backgroundColor: 'rgba(255,255,255,0.18)', zIndex: 5 }} />
    {/* left refraction */}
    <View pointerEvents="none" style={{ position: 'absolute', left: 7, top: 10, bottom: 10, width: 2, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 1, zIndex: 4 }} />
    {/* outer border */}
    <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, borderWidth: 1, borderColor: accent ? 'rgba(191,90,242,0.35)' : C.borderLight, zIndex: 3 }} />
    {accent && (
      <LinearGradient
        colors={['rgba(191,90,242,0.10)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: r, zIndex: 2 }]}
        pointerEvents="none"
      />
    )}
    <View style={{ zIndex: 1 }}>{children}</View>
  </View>
);

// ── Entrance animation ─────────────────────────────────────────────────────────
const Fade = ({ children, delay = 0, style }: any) => {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, ...SP, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <Animated.View style={[{ opacity: op, transform: [{ translateY: ty }] }, style]}>{children}</Animated.View>;
};

// ── Press-scale button ─────────────────────────────────────────────────────────
const Tap = ({ children, onPress, style, h = 'medium' }: any) => {
  const sc = useRef(new Animated.Value(1)).current;
  const haptic = useCallback(() => {
    if (h === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if (h === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [h]);
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => { haptic(); Animated.spring(sc, { toValue: 0.93, ...MOTION.POP, useNativeDriver: true }).start(); }}
      onPressOut={() => Animated.spring(sc, { toValue: 1, ...MOTION.POP, useNativeDriver: true }).start()}
      onPress={onPress}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: sc }] }}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

// ── Animated chart bar ─────────────────────────────────────────────────────────
const Bar = ({ val, i, active }: any) => {
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setTimeout(() => Animated.spring(h, { toValue: val * 56, ...SP, useNativeDriver: false }).start(), 400 + i * 70);
  }, []);
  return (
    <Animated.View style={{ width: 34, height: h, borderRadius: 8, overflow: 'hidden' }}>
      <LinearGradient
        colors={active ? [C.primary, C.primaryDeep] : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {active && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 8 }} />}
    </Animated.View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ArtistProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const ARTIST = ARTISTS_DB[id as string] || ARTIST_DEFAULT;

  const [followed, setFollowed] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set(['1']));
  const [expandBio, setExpandBio] = useState(false);
  const followSc = useRef(new Animated.Value(1)).current;

  // Scroll-driven animations
  const HERO_H = width * 0.88;
  const headerOp = scrollY.interpolate({ inputRange: [HERO_H * 0.55, HERO_H * 0.82], outputRange: [0, 1], extrapolate: 'clamp' });
  const floatOp = scrollY.interpolate({ inputRange: [HERO_H * 0.55, HERO_H * 0.82], outputRange: [1, 0], extrapolate: 'clamp' });
  const imgScale = scrollY.interpolate({ inputRange: [-80, 0, HERO_H], outputRange: [1.15, 1, 0.88], extrapolate: 'clamp' });
  const imgOp = scrollY.interpolate({ inputRange: [0, HERO_H * 0.7], outputRange: [1, 0.3], extrapolate: 'clamp' });

  const handleFollow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.spring(followSc, { toValue: 0.82, ...MOTION.POP, useNativeDriver: true }),
      Animated.spring(followSc, { toValue: 1.08, ...MOTION.POP, useNativeDriver: true }),
      Animated.spring(followSc, { toValue: 1.00, ...MOTION.POP, useNativeDriver: true }),
    ]).start();
    setFollowed(f => !f);
  }, []);

  const toggleLike = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLikedSongs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleShare = useCallback(async () => {
    try { await Share.share({ message: `Listen to ${ARTIST.name} on Aura Music 🎵` }); } catch { }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [ARTIST]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── BG BLOBS ────────────────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
        <View style={[s.blob, { width: 360, height: 360, top: -70, left: -70, backgroundColor: 'rgba(191,90,242,0.22)' }]} />
        <View style={[s.blob, { width: 240, height: 240, top: 180, right: -50, backgroundColor: 'rgba(26,35,126,0.20)' }]} />
        <View style={[s.blob, { width: 180, height: 180, bottom: 80, left: '45%', backgroundColor: 'rgba(70,245,224,0.08)' }]} />
      </View>

      {/* ── STICKY HEADER ───────────────────────────────────────────────────── */}
      <Animated.View style={[s.stickyHdr, { paddingTop: insets.top, opacity: headerOp }]} pointerEvents="box-none">
        <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { borderBottomWidth: 1, borderBottomColor: C.border }]} pointerEvents="none" />
        <View style={s.stickyRow}>
          <Tap onPress={() => router.back()} h="light" style={s.stickyBtn}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </Tap>
          <Text style={s.stickyName}>{ARTIST.name}</Text>
          <Tap onPress={handleShare} h="light" style={s.stickyBtn}>
            <Ionicons name="share-outline" size={22} color={C.text} />
          </Tap>
        </View>
      </Animated.View>

      {/* ── HERO IMAGE ──────────────────────────────────────────────────────── */}
      <Animated.View style={[s.heroWrap, { transform: [{ scale: imgScale }], opacity: imgOp }]} pointerEvents="none">
        <Image source={{ uri: ARTIST.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {/* bottom fade to bg */}
        <LinearGradient colors={['transparent', 'rgba(15,15,19,0.7)', C.bg]} locations={[0.35, 0.72, 1]} style={StyleSheet.absoluteFill} />
        {/* left bloom */}
        <LinearGradient colors={['rgba(191,90,242,0.28)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 0.7, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* ── FLOATING NAV BUTTONS ────────────────────────────────────────────── */}
      <Animated.View style={[s.floatBack, { top: insets.top + 8, opacity: floatOp }]} pointerEvents="box-none">
        <Tap onPress={() => router.back()} h="light">
          <GlassPane r={21} blur={45} style={s.floatBtn}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </GlassPane>
        </Tap>
      </Animated.View>
      <Animated.View style={[s.floatShare, { top: insets.top + 8, opacity: floatOp }]} pointerEvents="box-none">
        <Tap onPress={handleShare} h="light">
          <GlassPane r={21} blur={45} style={s.floatBtn}>
            <Ionicons name="share-outline" size={20} color={C.text} />
          </GlassPane>
        </Tap>
      </Animated.View>

      {/* ── SCROLLABLE CONTENT ──────────────────────────────────────────────── */}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HERO_H * 0.64, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ════════════ ARTIST HEADER ════════════ */}
        <Fade delay={0}>
          <View style={s.artistBlock}>
            {/* badge + listeners */}
            <View style={s.badgeRow}>
              <View style={s.verifiedPill}>
                <Ionicons name="checkmark-circle" size={12} color={C.accent} />
                <Text style={s.verifiedTxt}>VERIFIED ARTIST</Text>
              </View>
              <Text style={s.listenersTxt}>{ARTIST.monthlyListeners}</Text>
            </View>

            {/* artist name */}
            <Text style={s.artistName}>{ARTIST.name}</Text>

            {/* ── ACTION ROW ── FIX: proper widths, no overflow, all visible */}
            <View style={s.actionRow}>
              {/* PLAY — widest */}
              <Tap
                h="heavy"
                onPress={() => router.push({ pathname: '/now_playing', params: { trackId: '1' } })}
                style={s.playWrap}
              >
                <LinearGradient colors={[C.primary, C.primaryDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.playInner}>
                  {/* glass specular */}
                  <View style={{ position: 'absolute', top: 3, left: 20, right: 20, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1 }} />
                  <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }} />
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={s.btnTxt}>Play</Text>
                </LinearGradient>
              </Tap>

              {/* SHUFFLE — icon only pill */}
              <Tap h="medium" onPress={() => { }} style={s.iconBtnWrap}>
                <GlassPane r={26} blur={40} style={s.iconBtnInner}>
                  <Ionicons name="shuffle" size={20} color={C.text} />
                </GlassPane>
              </Tap>

              {/* FOLLOW */}
              <Tap onPress={handleFollow} h="heavy" style={s.followWrap}>
                <Animated.View style={{ transform: [{ scale: followSc }] }}>
                  {followed ? (
                    <View style={s.followingInner}>
                      <Ionicons name="checkmark" size={16} color={C.accent} />
                      <Text style={[s.btnTxt, { color: C.accent, fontSize: 13 }]}>Following</Text>
                    </View>
                  ) : (
                    <GlassPane r={26} blur={40} style={s.followInner}>
                      <Text style={[s.btnTxt, { fontSize: 14 }]}>Follow</Text>
                    </GlassPane>
                  )}
                </Animated.View>
              </Tap>
            </View>
          </View>
        </Fade>

        {/* ════════════ TOP SONGS ════════════ */}
        <Fade delay={100} style={s.section}>
          <View style={s.secHead}>
            <Text style={s.secTitle}>Top Songs</Text>
            <Tap onPress={() => { }} h="light"><Text style={s.seeAll}>View all</Text></Tap>
          </View>

          {/* FIX: each song is full-width, no image bleed, artwork clipped, duration visible */}
          {ARTIST.topSongs.map((song: any, idx: number) => (
            <Fade key={song.id} delay={140 + idx * 55}>
              <Tap
                h={song.active ? 'heavy' : 'medium'}
                onPress={() => router.push({ pathname: '/now_playing', params: { trackId: song.id } })}
                style={{ marginBottom: 10 }}
              >
                <GlassPane r={18} blur={song.active ? 55 : 38} accent={song.active} style={s.songRow}>
                  {/* rank */}
                  <Text style={[s.songRank, song.active && { color: C.primary }]}>{idx + 1}</Text>

                  {/* artwork — fixed size, no overflow into text */}
                  <View style={s.songArtBox}>
                    <Image source={{ uri: song.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {song.active && (
                      <View style={s.playingBadge}>
                        <Ionicons name="musical-note" size={9} color="#fff" />
                      </View>
                    )}
                  </View>

                  {/* text — flex:1 so it shrinks, never pushes actions off screen */}
                  <View style={s.songText}>
                    <Text style={[s.songTitle, song.active && { color: C.primary }]} numberOfLines={1}>{song.title}</Text>
                    <Text style={s.songMeta} numberOfLines={1}>{song.album} · {song.year}</Text>
                  </View>

                  {/* FIX: actions at end, never clipped — fixed width container */}
                  <View style={s.songActions}>
                    <Text style={s.songDur}>{song.duration}</Text>
                    <Tap h="heavy" onPress={() => toggleLike(song.id)} style={s.songIconBtn}>
                      <Ionicons name={likedSongs.has(song.id) ? 'heart' : 'heart-outline'} size={17} color={likedSongs.has(song.id) ? '#FF2D55' : C.textMuted} />
                    </Tap>
                    <Tap h="light" onPress={() => { }} style={s.songIconBtn}>
                      <Ionicons name="ellipsis-horizontal" size={16} color={C.textMuted} />
                    </Tap>
                  </View>
                </GlassPane>
              </Tap>
            </Fade>
          ))}
        </Fade>

        {/* ════════════ POPULAR ALBUMS ════════════ */}
        <Fade delay={220} style={{ marginBottom: 44 }}>
          <View style={[s.secHead, { paddingHorizontal: PAD }]}>
            <Text style={s.secTitle}>Popular Albums</Text>
            <Tap onPress={() => { }} h="light"><Text style={s.seeAll}>See all</Text></Tap>
          </View>

          {/* FIX: proper paddingLeft so first card is aligned, last card not cut */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: PAD, paddingRight: PAD, gap: 14 }}
            decelerationRate="fast"
            snapToInterval={154}
            snapToAlignment="start"
          >
            {ARTIST.albums.map((album: any, idx: number) => (
              <Fade key={album.id} delay={260 + idx * 70}>
                <Tap h="medium" onPress={() => { }}>
                  {/* FIX: fixed explicit width so third card is fully visible */}
                  <View style={s.albumCard}>
                    <View style={s.albumArtWrap}>
                      <Image source={{ uri: album.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
                      {/* play button bottom-right */}
                      <View style={s.albumPlayBtn}>
                        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                        <Ionicons name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
                      </View>
                    </View>
                    <Text style={s.albumTitle} numberOfLines={1}>{album.title}</Text>
                    <Text style={s.albumYear}>{album.year} · Album</Text>
                  </View>
                </Tap>
              </Fade>
            ))}
          </ScrollView>
        </Fade>

        {/* ════════════ FAN INSIGHTS ════════════ */}
        <Fade delay={310} style={s.section}>
          <GlassPane r={28} blur={60} accent style={s.insightsCard}>
            <View style={s.insightsHead}>
              <View style={s.insightsIcon}>
                <Ionicons name="trending-up" size={16} color={C.accent} />
              </View>
              <Text style={s.insightsTitle}>Fan Insights</Text>
              <View style={{ flex: 1 }} />
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt}>LIVE</Text>
              </View>
            </View>

            {/* chart — FIX: centred, proper height, bars fully visible */}
            <View style={s.chartWrap}>
              {ARTIST.insights.chartData.map((v: number, i: number) => (
                <Bar key={i} val={v} i={i} active={i === 2} />
              ))}
            </View>

            {/* stat pills */}
            <View style={s.statRow}>
              <View style={s.statPill}>
                <Text style={s.statNum}>{ARTIST.insights.globalRank}</Text>
                <Text style={s.statLbl}>GLOBAL RANK</Text>
              </View>
              <View style={[s.statPill, { borderColor: 'rgba(70,245,224,0.25)', backgroundColor: 'rgba(70,245,224,0.06)' }]}>
                <Text style={[s.statNum, { color: C.accent }]}>{ARTIST.insights.match}</Text>
                <Text style={s.statLbl}>YOUR MATCH</Text>
              </View>
            </View>
          </GlassPane>
        </Fade>

        {/* ════════════ BIOGRAPHY ════════════ */}
        <Fade delay={380} style={s.section}>
          <GlassPane r={28} blur={50} style={s.bioCard}>
            {/* purple glow orb */}
            <View style={s.bioGlow} />
            <View style={{ padding: 22 }}>
              <View style={s.bioHead}>
                <View style={s.bioMicIcon}>
                  <Ionicons name="mic" size={15} color={C.primary} />
                </View>
                <Text style={s.bioTitle}>The Soul Behind the Sound</Text>
              </View>
              <Text style={s.bioBody} numberOfLines={expandBio ? undefined : 4}>
                {ARTIST.biography}
              </Text>
              <Tap h="light" onPress={() => { setExpandBio(e => !e); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <View style={s.bioMore}>
                  <Text style={s.bioMoreTxt}>{expandBio ? 'Show less' : 'Full Biography'}</Text>
                  <Ionicons name={expandBio ? 'chevron-up' : 'chevron-forward'} size={14} color={C.primary} />
                </View>
              </Tap>
            </View>
          </GlassPane>
        </Fade>

        {/* ════════════ SIMILAR ARTISTS ════════════ */}
        <Fade delay={450} style={s.section}>
          <View style={[s.secHead, { marginBottom: 16 }]}>
            <Text style={s.secTitle}>Similar Listeners Love</Text>
          </View>

          {/* FIX: similar artists are full-width cards, not narrow rows with cut content */}
          {ARTIST.similar.map((artist: any, idx: number) => (
            <Fade key={artist.id} delay={490 + idx * 60}>
              <Tap h="medium" onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artist.id } })} style={{ marginBottom: 10 }}>
                <GlassPane r={18} blur={40} style={s.similarRow}>
                  {/* avatar */}
                  <View style={s.similarAvatarWrap}>
                    <Image source={{ uri: artist.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </View>
                  {/* info */}
                  <View style={s.similarInfo}>
                    <Text style={s.similarName}>{artist.name}</Text>
                    <Text style={s.similarListeners}>{artist.listeners} Monthly Listeners</Text>
                  </View>
                  {/* follow button — FIX: always visible, proper size */}
                  <Tap h="light" onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)} style={s.simFollowWrap}>
                    <GlassPane r={14} blur={30} style={s.simFollowInner}>
                      <Ionicons name="add" size={14} color={C.primary} />
                      <Text style={s.simFollowTxt}>Follow</Text>
                    </GlassPane>
                  </Tap>
                </GlassPane>
              </Tap>
            </Fade>
          ))}
        </Fade>

      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ALBUM_W = 146;
const SONG_ART = 46;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  blob: { position: 'absolute', borderRadius: 999 },

  // ── sticky header
  stickyHdr: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, overflow: 'hidden' },
  stickyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, height: 54 },
  stickyBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  stickyName: { color: C.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },

  // ── floating buttons
  floatBack: { position: 'absolute', left: 16, zIndex: 90 },
  floatShare: { position: 'absolute', right: 16, zIndex: 90 },
  floatBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },

  // ── hero image
  heroWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: width * 0.88 },

  // ── artist info block
  artistBlock: { paddingHorizontal: PAD, marginBottom: 36 },

  // badge row
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(70,245,224,0.10)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(70,245,224,0.22)' },
  verifiedTxt: { color: C.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  listenersTxt: { color: C.textSecondary, fontSize: 13, fontWeight: '500' },
  artistName: { color: C.text, fontSize: 44, fontWeight: '900', letterSpacing: -1.8, marginBottom: 22, lineHeight: 50 },

  // action row — FIX: all three always visible
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // no flexWrap, no overflow — controlled widths
  },
  playWrap: { flex: 2, height: 50, borderRadius: 26, overflow: 'hidden', minWidth: 0 },
  playInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  iconBtnWrap: { width: 50, height: 50, borderRadius: 26, overflow: 'hidden', flexShrink: 0 },
  iconBtnInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  followWrap: { flex: 1.4, height: 50, borderRadius: 26, overflow: 'hidden', flexShrink: 0, minWidth: 0 },
  followInner: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center' },
  followingInner: {
    flex: 1, height: 50, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5,
    backgroundColor: 'rgba(70,245,224,0.09)',
    borderRadius: 26, borderWidth: 1, borderColor: 'rgba(70,245,224,0.22)',
  },
  btnTxt: { color: C.text, fontSize: 15, fontWeight: '700' },

  // ── sections
  section: { paddingHorizontal: PAD, marginBottom: 40 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  secTitle: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  seeAll: { color: C.accent, fontSize: 13, fontWeight: '700' },

  // ── song rows — FIX: all elements visible
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,  // less padding on right — actions have own padding
    paddingVertical: 11,
    gap: 10,
    width: '100%',
  },
  songRank: { color: C.textMuted, fontSize: 13, fontWeight: '700', width: 18, textAlign: 'center', flexShrink: 0 },
  songArtBox: {
    width: SONG_ART, height: SONG_ART,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,         // never shrink art
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  playingBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  songText: { flex: 1, minWidth: 0 },  // flex:1 + minWidth:0 = shrinks properly
  songTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  songMeta: { color: C.textSecondary, fontSize: 11, fontWeight: '500' },
  songActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,         // never shrink actions — they stay visible
  },
  songDur: { color: C.textMuted, fontSize: 11, fontWeight: '600', marginRight: 2, width: 30, textAlign: 'right' },
  songIconBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },

  // ── albums
  albumCard: { width: ALBUM_W },
  albumArtWrap: {
    width: ALBUM_W, height: ALBUM_W,
    borderRadius: 20, overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  albumPlayBtn: {
    position: 'absolute', bottom: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
  albumTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  albumYear: { color: C.textMuted, fontSize: 11, fontWeight: '500' },

  // ── insights
  insightsCard: { padding: 22 },
  insightsHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  insightsIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(70,245,224,0.10)', justifyContent: 'center', alignItems: 'center' },
  insightsTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,59,48,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,59,48,0.22)' },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FF3B30' },
  liveTxt: { color: '#FF3B30', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 60, marginBottom: 22, paddingHorizontal: 4 },
  statRow: { flexDirection: 'row', gap: 12 },
  statPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statNum: { color: C.text, fontSize: 26, fontWeight: '900', marginBottom: 3 },
  statLbl: { color: C.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  // ── bio
  bioCard: { overflow: 'hidden' },
  bioGlow: { position: 'absolute', top: -50, right: -50, width: 160, height: 160, backgroundColor: C.primary, opacity: 0.09, borderRadius: 80 },
  bioHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  bioMicIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(191,90,242,0.15)', justifyContent: 'center', alignItems: 'center' },
  bioTitle: { color: C.text, fontSize: 17, fontWeight: '800', flex: 1 },
  bioBody: { color: C.textSecondary, fontSize: 14, lineHeight: 22, opacity: 0.88 },
  bioMore: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  bioMoreTxt: { color: C.primary, fontSize: 13, fontWeight: '700' },

  // ── similar
  similarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  similarAvatarWrap: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.05)' },
  similarInfo: { flex: 1, minWidth: 0 },
  similarName: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  similarListeners: { color: C.textMuted, fontSize: 11, fontWeight: '500' },
  simFollowWrap: { flexShrink: 0 },
  simFollowInner: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  simFollowTxt: { color: C.primary, fontSize: 12, fontWeight: '700' },
});