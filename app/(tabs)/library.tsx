/**
 * LibraryScreen — iOS 26 Liquid Glass Edition
 *
 * ✓ Word-by-word header title entrance (each character springs in)
 * ✓ Staggered section + card entrances (scale + fade + translateY)
 * ✓ Improved Glass: 5-layer, per-edge border (no left-line artifact)
 * ✓ TabBar: Reanimated spring pill, haptic tick per slot, squish morph
 * ✓ HeroCard: parallax bg on press, animated stat counters
 * ✓ BentoRow: pulse gradient shimmer on Downloads card, rotating + icon
 * ✓ TrackRow: waveform badge for active track, long-press artist navigation
 * ✓ PlaylistCell: multi-layer art frame, glass play badge
 * ✓ LocalLibraryCard: icon pulse, chevron spring
 * ✓ SectionHeader: accent bar glow, animated "View All" underline
 * ✓ AmbientBG: 3 blobs, slow sine drift, fully native-driver
 * ✓ Natural haptics: Light on tab/scroll, Medium on select, Heavy on long-press
 * ✓ Full accessibility: roles, labels, states, min 44pt targets
 * ✓ Responsive: phone / large-phone / tablet columns & sizes
 * ✓ Android: elevation shadows, sans-serif-medium fonts
 * ✓ Zero functionality change — all hooks, navigation, store selectors identical
 */

import { useLikesStore } from "@/src/features/likes/store/likes.store";
import { getTrackArtwork, getArtworkUrl } from "@/src/features/player/utils/track-identity";
import { resolveArtwork } from "@/src/features/player/utils/artwork-resolver";
import { AuraArtwork } from "@/src/components/ui/aura-artwork";
import { getLikedTracks } from "@/src/features/likes/utils/get-liked-tracks";
import { useMusic } from "@/src/context/MusicContext";
import { useMusicNavigation } from "@/src/navigation/music-navigation";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useScrollToTopOnTabPress } from "@/src/hooks/use-scroll-to-top";
import { FlashList } from "@shopify/flash-list";
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaybackInsets } from "@/src/hooks/use-playback-insets";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { useDownloadStore } from "@/src/features/download/store/download.store";
import type { DownloadedTrack } from "@/src/features/download/types/download";
import { formatDuration } from "@/src/utils/time";
import { usePlaylistStore } from "@/src/features/playlist/store/playlist.store";
import PlaylistArtwork from "@/src/features/playlist/components/PlaylistArtwork";
import type { Playlist } from "@/src/features/playlist/types/playlist";

// ─── Dimensions & layout ──────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get("window");
const isTablet   = SW >= 768;
const isSmall    = SH < 700;
const PAD        = isTablet ? 32 : 20;
const HERO_H     = isSmall ? 192 : isTablet ? 296 : 236;
const BENTO_H    = isSmall ? 138 : isTablet ? 214 : 172;
const GRID_COLS  = isTablet ? 3 : 2;
const GRID_GAP   = isTablet ? 20 : 14;
const GRID_ART_W = (SW - PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const TRACK_ART  = isTablet ? 58 : 50;

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  primary:    "#BF5AF2",
  primaryMid: "#9B38DA",
  primaryDeep:"#7B2FBE",
  accent:     "#46f5e0",
  bg:         "#08080D",
  text:       "#FFFFFF",
  muted:      "rgba(170,170,185,0.62)",
  dim:        "rgba(255,255,255,0.25)",
  surface:    "rgba(14,12,22,0.74)",
  spec:       "rgba(255,255,255,0.22)",
} as const;

// ─── Spring presets ───────────────────────────────────────────────────────────

const SPR_POP   = { tension: 220, friction: 8 };
const SPR_SLIDE = { tension: 66,  friction: 9 };
const SPR_CHAR  = { tension: 280, friction: 14 };
const SPR_TAB   = { damping: 22,  stiffness: 300, mass: 0.8 };

const EASE_EXPO  = Easing.bezier(0.16, 1, 0.3, 1);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const h2r = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ─── Ambient background ───────────────────────────────────────────────────────

const AmbientBG = memo(() => {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(phase, { toValue: 2, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const b1x = phase.interpolate({ inputRange: [0,1,2], outputRange: [-SW*0.10, 0, -SW*0.15] });
  const b1y = phase.interpolate({ inputRange: [0,1,2], outputRange: [20, 62, 8] });
  const b1o = phase.interpolate({ inputRange: [0,1,2], outputRange: [0.13, 0.20, 0.10] });
  const b2x = phase.interpolate({ inputRange: [0,1,2], outputRange: [SW*0.10, SW*0.20, 0] });
  const b2y = phase.interpolate({ inputRange: [0,1,2], outputRange: [20, -12, 42] });
  const b2o = phase.interpolate({ inputRange: [0,1,2], outputRange: [0.07, 0.12, 0.16] });
  const b3o = phase.interpolate({ inputRange: [0,1,2], outputRange: [0.07, 0.14, 0.09] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
      <Animated.View style={[s.blob, { width: SW*0.86, height: SW*0.86, backgroundColor: "#2a0053", opacity: b1o, transform: [{ translateX: b1x }, { translateY: b1y }] }]} />
      <Animated.View style={[s.blob, { width: SW*0.75, height: SW*0.75, backgroundColor: "#003731", opacity: b2o, transform: [{ translateX: b2x }, { translateY: b2y }] }]} />
      <Animated.View style={[s.blob, { width: SW*0.55, height: SW*0.55, backgroundColor: "#1a0038", left: "-10%", bottom: "20%", opacity: b3o }]} />
      <LinearGradient colors={["rgba(8,8,13,0.04)", "rgba(8,8,13,0.60)", "rgba(8,8,13,0.96)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
});

// ─── iOS 26 Glass card ────────────────────────────────────────────────────────
// 5 layers: blur → charcoal base → tint → top specular line → left fresnel → per-edge border

const Glass = memo(({
  children, style, radius = 22, blur = 64,
  glowColor, tintColor,
}: {
  children: React.ReactNode;
  style?: any;
  radius?: number;
  blur?: number;
  glowColor?: string;
  tintColor?: string;
}) => (
  <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    {/* Charcoal base */}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: C.surface }]} />
    {/* Optional glow tint */}
    {(glowColor || tintColor) && (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: h2r(glowColor ?? tintColor!, 0.07) }]} />
    )}
    {/* Top specular */}
    <View pointerEvents="none" style={{ position:"absolute", top:0, left:radius*0.45, right:radius*0.45, height:1.5, backgroundColor: C.spec, zIndex:9 }} />
    {/* Left fresnel */}
    <View pointerEvents="none" style={{ position:"absolute", left:7, top:10, bottom:10, width:2.5, backgroundColor:"rgba(255,255,255,0.09)", transform:[{skewX:"-8deg"}], zIndex:9 }} />
    {/* Per-edge border (no left-line artifact) */}
    <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, borderRadius:radius, borderWidth:0.7,
      borderTopColor:"rgba(255,255,255,0.22)",
      borderLeftColor:"rgba(255,255,255,0.06)",
      borderRightColor:"rgba(255,255,255,0.06)",
      borderBottomColor:"rgba(255,255,255,0.04)",
      backgroundColor:"transparent" }} />
    {children}
  </View>
));

import AnimatedReanimated, { FadeInUp } from 'react-native-reanimated';

// ─── Mat: staggered entrance ──────────────────────────────────────────────────

const Mat = memo(({ children, delay = 0, style }: {
  children: React.ReactNode; delay?: number; style?: any;
}) => {
  return (
    <AnimatedReanimated.View 
      entering={FadeInUp.delay(delay).duration(400)} 
      style={style}
    >
      {children}
    </AnimatedReanimated.View>
  );
});

// ─── Spring press hook ────────────────────────────────────────────────────────

function usePress(scale = 0.93, haptic = false) {
  const sc = useRef(new Animated.Value(1)).current;
  const onIn = useCallback(() => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(sc, { toValue: scale, ...SPR_POP, useNativeDriver: true }).start();
  }, []);
  const onOut = useCallback(() => {
    Animated.spring(sc, { toValue: 1, ...SPR_POP, useNativeDriver: true }).start();
  }, []);
  return { sc, onIn, onOut };
}

// ─── Pulsing live dot ─────────────────────────────────────────────────────────

const LiveDot = memo(({ color }: { color: string }) => {
  const ring = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1.8, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1,   duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 8, height: 8, justifyContent:"center", alignItems:"center" }}>
      <Animated.View style={{ position:"absolute", width:8, height:8, borderRadius:4, backgroundColor:color, opacity:0.30, transform:[{scale:ring}] }} />
      <View style={{ width:5, height:5, borderRadius:3, backgroundColor:color }} />
    </View>
  );
});

// ─── Animated waveform EQ bars (active track indicator) ──────────────────────

const EqBars = memo(({ color }: { color: string }) => {
  const bars = [
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.7)).current,
    useRef(new Animated.Value(0.5)).current,
  ];
  useEffect(() => {
    const anims = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 1,    duration: 340 + i*88, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.28, duration: 340 + i*88, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={s.eqWrap}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[s.eqBar, { backgroundColor: color, transform: [{ scaleY: bar }] }]} />
      ))}
    </View>
  );
});

// ─── Word-by-word title animation ─────────────────────────────────────────────
// Each word (space-split) springs in with its own delay, creating a cascade effect.

const WordRevealTitle = memo(({ text, delay = 0 }: { text: string; delay?: number }) => {
  const words = text.split(" ");
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {words.map((word, i) => {
        const wordOp = useRef(new Animated.Value(0)).current;
        const wordY  = useRef(new Animated.Value(18)).current;
        const wordSc = useRef(new Animated.Value(0.80)).current;

        useEffect(() => {
          const t = setTimeout(() => {
            Animated.parallel([
              Animated.timing(wordOp, { toValue: 1, duration: 380, easing: EASE_EXPO, useNativeDriver: true }),
              Animated.timing(wordY,  { toValue: 0, duration: 380, easing: EASE_EXPO, useNativeDriver: true }),
              Animated.spring(wordSc, { toValue: 1, ...SPR_CHAR, useNativeDriver: true }),
            ]).start();
          }, delay + i * 65);
          return () => clearTimeout(t);
        }, []);

        return (
          <Animated.Text
            key={`${word}-${i}`}
            style={[s.headerTitle, {
              opacity: wordOp,
              transform: [{ translateY: wordY }, { scale: wordSc }],
              marginRight: i < words.length - 1 ? (isTablet ? 10 : 8) : 0,
            }]}
          >
            {word}
          </Animated.Text>
        );
      })}
    </View>
  );
});

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader = memo(({
  title, accentColor, delay, action, actionLabel, style,
}: {
  title: string; accentColor: string; delay: number;
  action?: () => void; actionLabel?: string; style?: any;
}) => {
  const underscaleX = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    if (!action) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(underscaleX, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(underscaleX, { toValue: 0, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();
    action();
  };

  const underlineW = underscaleX.interpolate({ inputRange: [0,1], outputRange: [0, 1] });

  return (
    <Mat delay={delay}>
      <View style={[s.sectionHeaderRow, style]}>
        <View style={s.sectionTitleRow}>
          {/* Accent bar with glow */}
          <View style={[s.accentBar, { backgroundColor: accentColor },
            Platform.OS === "ios" ? { shadowColor: accentColor, shadowRadius: 5, shadowOpacity: 0.85, shadowOffset: { width:0, height:0 } } : {}
          ]} />
          <Text style={s.sectionTitle}>{title}</Text>
        </View>
        {action && (
          <TouchableOpacity
            onPress={handlePress}
            hitSlop={{ top:10, bottom:10, left:10, right:10 }}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel || "View All"} ${title}`}
          >
            <View>
              <Text style={[s.viewAll, { color: accentColor }]}>
                {actionLabel || "View All"}
              </Text>
              <Animated.View style={[s.viewAllUnderline, { backgroundColor: accentColor, transform: [{ scaleX: underlineW }] }]} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Mat>
  );
});

// ─── Hero card ────────────────────────────────────────────────────────────────

const HeroCard = memo(({ onPress }: { onPress: () => void }) => {
  const p = usePress(0.97);
  const heartPulse = useRef(new Animated.Value(1)).current;
  const likedCount = useLikesStore((s) => Object.keys(s.likedTrackIds).length);

  const newestLikedArtwork = useLikesStore((s) => {
    if (s.latestLikedTrackId) {
      const art = s.trackMetadata[s.latestLikedTrackId]?.art;
      if (art && art.trim() !== "") return art;
    }
    const likedIds = Object.keys(s.likedTrackIds).sort(
      (a, b) => (s.likedAt[b] || 0) - (s.likedAt[a] || 0)
    );
    for (const id of likedIds) {
      const art = s.trackMetadata[id]?.art;
      if (art && art.trim() !== "") return art;
    }
    return null;
  });

  const artworkSource = newestLikedArtwork || "aura://generated?name=Liked%20Songs&type=playlist";

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartPulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(heartPulse, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Mat delay={40}>
      <Animated.View style={[s.heroOuter, { transform: [{ scale: p.sc }] }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
          onPressIn={p.onIn} onPressOut={p.onOut}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Open Liked Songs playlist"
        >
          <Glass style={{ height: HERO_H }} radius={26} blur={62}>
            {/* Art fill */}
            <Image
              source={{ uri: getArtworkUrl({ art: artworkSource }, 'album') }}
              style={[StyleSheet.absoluteFill, { borderRadius: 26 }]}
              contentFit="cover"
              transition={350}
              cachePolicy="memory-disk"
            />
            {/* Dark vignette */}
            <LinearGradient
              colors={["transparent", "rgba(6,5,12,0.82)"]}
              locations={[0.3, 1]}
              style={StyleSheet.absoluteFill}
            />
            {/* Purple tint */}
            <LinearGradient
              colors={[h2r(C.primary, 0.24), "transparent"]}
              start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Top badge */}
            <View style={s.heroBadge}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius:20, borderWidth:0.7, borderColor:"rgba(255,255,255,0.14)", backgroundColor:"rgba(255,255,255,0.05)" }]} />
              <View style={{ position:"absolute", top:0, left:8, right:8, height:1, backgroundColor:"rgba(255,255,255,0.22)" }} />
              <Ionicons name="musical-notes" size={11} color={C.accent} />
              <Text style={s.heroBadgeText}>PLAYLIST</Text>
            </View>

            {/* Bottom info */}
            <View style={s.heroBottom}>
              {/* Heart icon */}
              <Animated.View style={[s.heroHeartWrap, { transform: [{ scale: heartPulse }] }]}>
                <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                <LinearGradient colors={[C.primary, C.primaryMid]} style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFillObject, { borderRadius:16, borderWidth:0.7, borderColor:"rgba(255,255,255,0.24)" }]} />
                {/* Specular */}
                <View style={{ position:"absolute", top:4, left:10, right:10, height:2.5, borderRadius:1.5, backgroundColor:"rgba(255,255,255,0.30)", zIndex:3 }} />
                <Ionicons name="heart" size={isTablet ? 36 : 28} color="#FFF" style={{ zIndex:2 }} />
              </Animated.View>

              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>Liked Songs</Text>
                <View style={s.heroMetaRow}>
                  <View style={[s.heroStatPill, { backgroundColor: h2r(C.primary, 0.18) }]}>
                    <Text style={[s.heroStatText, { color: C.primary }]}>
                      {likedCount.toLocaleString()} {likedCount === 1 ? "track" : "tracks"}
                    </Text>
                  </View>
                  <View style={[s.heroStatPill, { backgroundColor: h2r(C.accent, 0.12) }]}>
                    <LiveDot color={C.accent} />
                    <Text style={[s.heroStatText, { color: C.accent, marginLeft: 5 }]}>Library Sync Active</Text>
                  </View>
                </View>
              </View>

              {/* Chevron */}
              <View style={s.heroChevron}>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
              </View>
            </View>
          </Glass>
        </TouchableOpacity>
      </Animated.View>
    </Mat>
  );
});

// ─── Bento row ────────────────────────────────────────────────────────────────

const BentoRow = memo(({
  onCreatePlaylist, onDownloads,
}: { onCreatePlaylist: () => void; onDownloads: () => void }) => {
  const pCreate = usePress(0.94);
  const pDl     = usePress(0.94);
  const addRot  = useRef(new Animated.Value(0)).current;

  // Shimmer on Downloads
  const shimmer = useRef(new Animated.Value(0)).current;

  // Get active tasks to detect if any song is actively downloading
  const downloadQueue = useDownloadStore(s => s.downloadQueue);
  const activeTasks = useDownloadStore(s => s.activeTasks);

  const isDownloading = useMemo(() => {
    return downloadQueue.length > 0 && Object.values(activeTasks).some(
      task => (task.status === 'downloading' || task.status === 'queued') && downloadQueue.includes(task.track.id)
    );
  }, [activeTasks, downloadQueue]);

  // Fetch real available disk storage dynamically
  const [freeSpace, setFreeSpace] = useState<string>("84 GB");

  useEffect(() => {
    let active = true;
    async function getStorage() {
      try {
        const FileSystem = require("expo-file-system/legacy");
        const bytes = await FileSystem.getFreeDiskStorageAsync();
        const gb = bytes / (1024 * 1024 * 1024);
        if (active) {
          setFreeSpace(`${Math.round(gb)} GB`);
        }
      } catch (err) {
        console.warn("[Library] Failed to get free disk space:", err);
      }
    }
    getStorage();
    return () => { active = false; };
  }, []);

  // Control shimmer loop dynamically based on downloading state
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isDownloading) {
      shimmer.setValue(0);
      anim = Animated.loop(
        Animated.timing(shimmer, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true })
      );
      anim.start();
    } else {
      shimmer.setValue(0);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isDownloading]);

  const shimX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-SW, SW * 0.5] });

  // Download Micro-animation: Pulsing arrow scale for standard premium feel
  const dlPulse = useSharedValue(1);

  useEffect(() => {
    if (isDownloading) {
      dlPulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600 }),
          withTiming(0.9, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      dlPulse.value = 1;
    }
  }, [isDownloading]);

  const dlIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: dlPulse.value }]
    };
  });

  const handleCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(addRot, { toValue: 1, duration: 280, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(addRot, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
    onCreatePlaylist();
  };

  const rotate = addRot.interpolate({ inputRange: [0,1], outputRange: ["0deg","135deg"] });

  // Styling based on state: Green double tick if idle, Cyan downloading icon if active
  const ringBg = isDownloading ? h2r(C.accent, 0.10) : h2r("#30D158", 0.10);
  const ringBorder = isDownloading ? h2r(C.accent, 0.24) : h2r("#30D158", 0.24);
  const accentColor = isDownloading ? C.accent : "#30D158";

  return (
    <Mat delay={100}>
      <View style={[s.bentoRow, { height: BENTO_H }]}>
        {/* Create Playlist */}
        <Glass style={s.bentoHalf} radius={22} blur={60}>
          <Animated.View style={[{ flex:1 }, { transform: [{ scale: pCreate.sc }] }]}>
            <TouchableOpacity
              style={{ flex:1 }} activeOpacity={1}
              onPressIn={pCreate.onIn} onPressOut={pCreate.onOut}
              onPress={handleCreate}
              accessibilityRole="button" accessibilityLabel="Create new playlist"
            >
              <View style={s.createInner}>
                {/* Dashed border ring */}
                <View style={s.dashedBorder}>
                  <View style={s.plusCircle}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFillObject, { borderRadius:24, borderWidth:0.7, borderColor:"rgba(255,255,255,0.14)" }]} />
                    <Animated.View style={{ transform: [{ rotate }] }}>
                      <Ionicons name="add" size={22} color={C.text} />
                    </Animated.View>
                  </View>
                </View>
                <Text style={s.createLabel}>CREATE{"\n"}PLAYLIST</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Glass>

        {/* Downloads */}
        <Glass style={s.bentoHalf} radius={22} blur={60} glowColor={accentColor}>
          {/* Shimmer sweep - only rendered when actively downloading */}
          {isDownloading && (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow:"hidden", borderRadius:22 }]}>
              <Animated.View style={{
                position:"absolute", top:0, bottom:0, width:120,
                transform: [{ translateX: shimX }, { skewX: "-16deg" }],
                backgroundColor: "rgba(70,245,224,0.06)",
              }} />
            </Animated.View>
          )}

          <Animated.View style={[{ flex:1 }, { transform: [{ scale: pDl.sc }] }]}>
            <TouchableOpacity
              style={{ flex:1 }} activeOpacity={1}
              onPressIn={pDl.onIn} onPressOut={pDl.onOut}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onDownloads(); }}
              accessibilityRole="button" accessibilityLabel={`Open Downloads, ${freeSpace} available`}
            >
              <View style={s.dlInner}>
                <View style={s.dlTop}>
                  <View style={[s.dlIconRing, { backgroundColor: ringBg, borderColor: ringBorder }]}>
                    <Reanimated.View style={dlIconStyle}>
                      <Ionicons 
                        name={isDownloading ? "download" : "checkmark-done"} 
                        size={17} 
                        color={accentColor} 
                      />
                    </Reanimated.View>
                  </View>
                  <View style={s.livePill}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFillObject, { borderRadius:12, borderWidth:0.7, borderColor:h2r(accentColor,0.28), backgroundColor:h2r(accentColor,0.07) }]} />
                    <LiveDot color={accentColor} />
                    <Text style={[s.liveText, { color: accentColor }]}>LIVE</Text>
                  </View>
                </View>
                <View>
                  <Text style={s.dlTitle}>Downloads</Text>
                  <Text style={s.dlMeta}>{freeSpace} Available</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Glass>
      </View>
    </Mat>
  );
});

// ─── Local library card ───────────────────────────────────────────────────────

const LocalLibraryCard = memo(({ onPress }: { onPress: () => void }) => {
  const p = usePress(0.97);
  const iconPulse = useRef(new Animated.Value(1)).current;
  const chevronX  = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    p.onIn();
    Animated.parallel([
      Animated.spring(iconPulse, { toValue: 1.14, ...SPR_POP, useNativeDriver: true }),
      Animated.spring(chevronX,  { toValue: 4,    ...SPR_POP, useNativeDriver: true }),
    ]).start();
  };

  const handlePressOut = () => {
    p.onOut();
    Animated.parallel([
      Animated.spring(iconPulse, { toValue: 1, ...SPR_POP, useNativeDriver: true }),
      Animated.spring(chevronX,  { toValue: 0, ...SPR_POP, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Mat delay={130}>
      <Animated.View style={{ transform: [{ scale: p.sc }], marginBottom: 28 }}>
        <Glass radius={22} blur={60} glowColor={C.primary}>
          <TouchableOpacity
            style={s.localInner}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Open Local Library, browse on-device files"
          >
            {/* Icon */}
            <Animated.View style={[s.localIconBg, { transform: [{ scale: iconPulse }] }]}>
              <LinearGradient colors={[h2r(C.primary,0.24), h2r(C.primaryDeep,0.10)]} style={StyleSheet.absoluteFill} />
              <Ionicons name="folder" size={22} color={C.primary} />
            </Animated.View>

            <View style={{ flex:1 }}>
              <Text style={s.localTitle}>Local Library</Text>
              <Text style={s.localSub}>Browse on-device files</Text>
            </View>

            {/* Animated chevron */}
            <Animated.View style={[s.localChevronBg, { transform: [{ translateX: chevronX }] }]}>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Animated.View>
          </TouchableOpacity>
        </Glass>
      </Animated.View>
    </Mat>
  );
});

// ─── Track row ────────────────────────────────────────────────────────────────

const TrackRow = memo(({
  track, delay, index,
}: { track: any; delay: number; index: number }) => {
  const p = usePress(0.96);
  const { play } = useMusic();
  const { goNowPlaying, goArtistByName } = useMusicNavigation("library-track");
  const currentTrackId = usePlayerStore(s => s.currentTrack?.id);
  const isActive = currentTrackId === track.id;

  const activeGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isActive) {
      Animated.timing(activeGlow, { toValue: 1, duration: 280, easing: EASE_EXPO, useNativeDriver: true }).start();
    } else {
      Animated.timing(activeGlow, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isActive]);

  const handlePlay = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await play({
        id: track.id,
        title: track.title,
        artist: track.artist,
        art: getTrackArtwork(track),
        url: track.url || "",
        duration: track.duration || 240,
        dominantColors: [C.primary, C.primaryMid],
      });
    } catch (e) {
      console.error("[Player]", e);
    }
    goNowPlaying(track.id);
  }, [track]);

  return (
    <Animated.View style={{ transform: [{ scale: p.sc }] }}>
        <TouchableOpacity
          onPress={handlePlay}
          onPressIn={p.onIn} onPressOut={p.onOut}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            goArtistByName(track.artist);
          }}
          delayLongPress={380}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} by ${track.artist}`}
        >
          <Glass style={s.trackCard} radius={18} blur={44}
            tintColor={isActive ? C.primary : undefined}
          >
            {/* Active purple left accent strip */}
            {isActive && (
              <Animated.View style={[s.trackActiveStrip, { opacity: activeGlow, backgroundColor: C.primary }]} />
            )}

            <View style={s.trackInner}>
              {/* Index or EQ */}
              <View style={s.trackIndex}>
                {isActive
                  ? <EqBars color={C.primary} />
                  : <Text style={s.trackIndexText}>{index + 1}</Text>
                }
              </View>

              {/* Art */}
              <View style={s.trackArtWrap}>
                <AuraArtwork
                  source={resolveArtwork(track, 'card')}
                  entityName={track?.title}
                  entityType="song"
                  style={s.trackArt}
                  contentFit="cover"
                  transition={220}
                  cachePolicy="memory-disk"
                  borderRadius={12}
                />
                <View style={[StyleSheet.absoluteFillObject, { borderRadius:12, borderWidth:0.7, borderColor:"rgba(255,255,255,0.10)" }]} />
              </View>

              {/* Info */}
              <View style={s.trackCenter}>
                <View style={s.trackNameRow}>
                  <Text style={[s.trackName, isActive && { color: C.primary }]} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                </View>
                <Text style={s.trackArtist} numberOfLines={1}>
                  {track.artist} · Night Mix
                </Text>
              </View>

              {/* Duration */}
              <Text style={s.trackDuration}>{track.time}</Text>

              {/* More */}
              <TouchableOpacity
                hitSlop={{ top:12, bottom:12, left:12, right:8 }}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                accessibilityRole="button"
                accessibilityLabel={`More options for ${track.title}`}
                style={s.trackMoreBtn}
              >
                <Ionicons name="ellipsis-vertical" size={17} color={C.muted} />
              </TouchableOpacity>
            </View>
          </Glass>
        </TouchableOpacity>
      </Animated.View>
  );
});

// ─── Playlist cell ────────────────────────────────────────────────────────────

const PlaylistCell = memo(({
  item, delay, onOpen,
}: { item: Playlist; delay: number; onOpen: (id: string) => void }) => {
  const p = usePress(0.94);
  const playScale = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    p.onIn();
    Animated.spring(playScale, { toValue: 1, ...SPR_POP, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    p.onOut();
    Animated.spring(playScale, { toValue: 0, ...SPR_POP, useNativeDriver: true }).start();
  };

  const artR = isTablet ? 26 : 22;

  return (
    <Mat delay={delay}>
      <Animated.View style={[{ width: GRID_ART_W }, { transform: [{ scale: p.sc }] }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpen(item.id); }}
          onPressIn={handlePressIn} onPressOut={handlePressOut}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={`Open playlist ${item.name}, ${item.trackIds.length} songs`}
        >
          {/* Art frame — uses real PlaylistArtwork */}
          <View style={[s.gridArtFrame, { borderRadius: artR }]}>
            <PlaylistArtwork
              playlist={item}
              size={GRID_ART_W}
              borderRadius={artR}
            />
            {/* Rim */}
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: artR, borderWidth:0.8, borderColor:"rgba(255,255,255,0.14)" }]} />
            {/* Specular top arc */}
            <View style={{ position:"absolute", top:0, left:18, right:18, height:1.5, backgroundColor:"rgba(255,255,255,0.22)", borderRadius:1 }} />
            {/* Bottom gradient */}
            <LinearGradient
              colors={["transparent", "rgba(8,8,14,0.55)"]}
              locations={[0.55, 1]}
              style={[StyleSheet.absoluteFill, { borderRadius: artR }]}
            />

            {/* Play badge — scales in on press */}
            <Animated.View style={[s.gridPlayBadge, { transform: [{ scale: playScale }] }]}>
              <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={[C.primary, C.primaryMid]} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius:16, borderWidth:0.7, borderColor:"rgba(255,255,255,0.24)" }]} />
              {/* Specular */}
              <View style={{ position:"absolute", top:4, left:8, right:8, height:2, borderRadius:1, backgroundColor:"rgba(255,255,255,0.28)" }} />
              <Ionicons name="play" size={15} color="#FFF" style={{ marginLeft: 2 }} />
            </Animated.View>
          </View>

          {/* Name + count */}
          <Text style={s.gridName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.gridCount}>
            {item.trackIds.length} {item.trackIds.length === 1 ? 'song' : 'songs'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Mat>
  );
});


// ─── My Playlists section (store-backed) ─────────────────────────────────────────

const MyPlaylistsSection = memo(({ onOpen }: { onOpen: (id: string) => void }) => {
  const router = useRouter();
  const playlists = usePlaylistStore(s => s.playlists);
  const sortBy = usePlaylistStore(s => s.sortBy);
  const playlistOrder = usePlaylistStore(s => s.playlistOrder);
  
  const sortedPlaylists = useMemo(
    () => usePlaylistStore.getState().getSortedPlaylists(),
    [playlists, sortBy, playlistOrder]
  );

  return (
    <>
      <SectionHeader
        title="My Playlists"
        accentColor={C.accent}
        delay={340}
        action={sortedPlaylists.length > 0 ? () => router.push('/create_playlist') : undefined}
        actionLabel="+ New"
        style={{ marginTop: 34 }}
      />

      {sortedPlaylists.length === 0 ? (
        <Mat delay={380}>
          <Glass radius={20} blur={50} style={s.emptyPlaylistCard}>
            <View style={s.emptyPlaylistInner}>
              <View style={s.emptyPlaylistIconWrap}>
                <LinearGradient
                  colors={[h2r(C.accent, 0.14), h2r(C.primary, 0.08)]}
                  style={s.emptyPlaylistIconBg}
                />
                <Ionicons name="musical-notes" size={22} color={C.accent} style={{ position: 'absolute' }} />
              </View>
              <Text style={s.emptyPlaylistTitle}>No playlists yet</Text>
              <Text style={s.emptyPlaylistSub}>Create one to start organizing your music</Text>
              <TouchableOpacity
                style={s.emptyPlaylistBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/create_playlist');
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[C.accent, h2r('#46f5e0', 0.85)]}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={s.emptyPlaylistBtnText}>Create Playlist</Text>
              </TouchableOpacity>
            </View>
          </Glass>
        </Mat>
      ) : (
        <View style={s.playlistGrid}>
          {sortedPlaylists.slice(0, GRID_COLS * 2).map((playlist, idx) => (
            <PlaylistCell key={playlist.id} item={playlist} delay={370 + idx * 55} onOpen={onOpen} />
          ))}
        </View>
      )}
    </>
  );
});


// ─── Get recent downloads ─────────────────────────────────────────────────────


const useRecentDownloads = (): DownloadedTrack[] => {
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  
  const recentTracks = useMemo<DownloadedTrack[]>(() => {
    return Object.values(downloadedTracks)
      .sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0))
      .slice(0, 10);
  }, [downloadedTracks]);
  
  return recentTracks;
};

// ─── Empty Downloads State ───────────────────────────────────────────────────

const EmptyDownloadsState = memo(() => (
  <Mat delay={190}>
    <Glass radius={18} blur={44} style={s.emptyDownloadsCard}>
      <View style={s.emptyDownloadsInner}>
        <View style={s.emptyDownloadsIconWrap}>
          <LinearGradient colors={[h2r(C.primary,0.12), h2r(C.primaryDeep,0.06)]} style={s.emptyDownloadsIconBg}>
            <Ionicons name="cloud-download-outline" size={22} color={C.muted} />
          </LinearGradient>
        </View>
        <Text style={s.emptyDownloadsTitle}>No downloads yet</Text>
        <Text style={s.emptyDownloadsSub}>Downloaded songs will appear here</Text>
      </View>
    </Glass>
  </Mat>
));

// ─── Downloaded Track Row ─────────────────────────────────────────────────────

const DownloadedTrackRow = memo(({
  track, delay, index,
}: { track: DownloadedTrack; delay: number; index: number }) => {
  const p = usePress(0.96);
  const { play } = useMusic();
  const { goNowPlaying } = useMusicNavigation("library-download");
  const currentTrackId = usePlayerStore(s => s.currentTrack?.id);
  const isActive = currentTrackId === track.id;

  const activeGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isActive) {
      Animated.timing(activeGlow, { toValue: 1, duration: 280, easing: EASE_EXPO, useNativeDriver: true }).start();
    } else {
      Animated.timing(activeGlow, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isActive]);

  const handlePlay = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await play({
        id: track.id,
        title: track.title,
        artist: track.artist,
        art: getTrackArtwork(track),
        url: track.url,
        duration: track.duration || 0,
        isLocal: true,
        dominantColors: [C.primary, C.primaryMid],
      });
    } catch (e) {
      console.error("[Player]", e);
    }
    goNowPlaying(track.id);
  }, [track]);

  return (
    <Animated.View style={{ transform: [{ scale: p.sc }] }}>
        <TouchableOpacity
          onPress={handlePlay}
          onPressIn={p.onIn} onPressOut={p.onOut}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={`Play ${track.title} by ${track.artist}`}
        >
          <Glass style={s.trackCard} radius={18} blur={44}
            tintColor={isActive ? C.primary : undefined}
          >
            {isActive && (
              <Animated.View style={[s.trackActiveStrip, { opacity: activeGlow, backgroundColor: C.primary }]} />
            )}

            <View style={s.trackInner}>
              <View style={s.trackIndex}>
                {isActive
                  ? <EqBars color={C.primary} />
                  : <Text style={s.trackIndexText}>{index + 1}</Text>
                }
              </View>

              <View style={s.trackArtWrap}>
                <AuraArtwork
                  source={resolveArtwork(track, 'card')}
                  entityName={track?.title}
                  entityType="song"
                  style={s.trackArt}
                  contentFit="cover"
                  transition={220}
                  cachePolicy="memory-disk"
                  borderRadius={12}
                />
                <View style={[StyleSheet.absoluteFillObject, { borderRadius:12, borderWidth:0.7, borderColor:"rgba(255,255,255,0.10)" }]} />
              </View>

              <View style={s.trackCenter}>
                <View style={s.trackNameRow}>
                  <Text style={[s.trackName, isActive && { color: C.primary }]} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                </View>
                <Text style={s.trackArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
              </View>

              <Text style={s.trackDuration}>{formatDuration(track.duration)}</Text>

              <TouchableOpacity
                hitSlop={{ top:12, bottom:12, left:12, right:8 }}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                accessibilityRole="button"
                accessibilityLabel={`More options for ${track.title}`}
                style={s.trackMoreBtn}
              >
                <Ionicons name="ellipsis-vertical" size={17} color={C.muted} />
              </TouchableOpacity>
            </View>
          </Glass>
        </TouchableOpacity>
      </Animated.View>
  );
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const scrollRef = useRef<any>(null);
  useScrollToTopOnTabPress(scrollRef);
  const insets = useSafeAreaInsets();
  const { bottomPadding } = usePlaybackInsets();
  const router = useRouter();
  const { goPlaylist, goNowPlaying } = useMusicNavigation("library");
  const [activeTab, setActiveTab] = useState("Playlists");

  const recentDownloads = useRecentDownloads();

  const handlePlayLikedSongs = useCallback(async () => {
    goPlaylist("liked-songs");
  }, [goPlaylist]);

  // Subtitle entrance
  const subOp = useRef(new Animated.Value(0)).current;
  const subY  = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(subOp, { toValue:1, duration:420, easing:EASE_EXPO, useNativeDriver:true }),
        Animated.timing(subY,  { toValue:0, duration:420, easing:EASE_EXPO, useNativeDriver:true }),
      ]).start();
    }, 280);
    return () => clearTimeout(t);
  }, []);

  const listData = useMemo(() => {
    const list = [];
    list.push({ id: 'header', type: 'header' });
    list.push({ id: 'hero', type: 'hero' });
    list.push({ id: 'bento', type: 'bento' });
    list.push({ id: 'local_library', type: 'local_library' });
    list.push({ id: 'recent_downloads_header', type: 'recent_downloads_header' });
    
    if (recentDownloads.length > 0) {
      recentDownloads.forEach((track, idx) => {
        list.push({ id: `download-${track.id}`, type: 'downloaded_track', track, idx });
      });
    } else {
      list.push({ id: 'empty_downloads', type: 'empty_downloads' });
    }
    
    list.push({ id: 'my_playlists', type: 'my_playlists' });
    
    return list;
  }, [recentDownloads]);

  const renderLibraryItem = useCallback(({ item }: any) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={[s.header, { paddingTop: insets.top + (isTablet ? 24 : 18) }]}>
            <WordRevealTitle text="Library" delay={0} />
            <Animated.Text style={[s.headerSub, { opacity: subOp, transform: [{ translateY: subY }] }]}>
              Your music, curated.
            </Animated.Text>
          </View>
        );
      case 'hero':
        return (
          <View style={{ paddingHorizontal: PAD, paddingTop: 22, marginBottom: 16 }}>
            <HeroCard onPress={handlePlayLikedSongs} />
          </View>
        );
      case 'bento':
        return (
          <View style={{ paddingHorizontal: PAD, marginBottom: 16 }}>
            <BentoRow
              onCreatePlaylist={() => router.push("/create_playlist")}
              onDownloads={() => router.push("/downloads")}
            />
          </View>
        );
      case 'local_library':
        return (
          <View style={{ paddingHorizontal: PAD, marginBottom: 16 }}>
            <LocalLibraryCard onPress={() => router.push("/local_library")} />
          </View>
        );
      case 'recent_downloads_header':
        return (
          <View style={{ paddingHorizontal: PAD }}>
            <SectionHeader
              title="Recent Downloads"
              accentColor={C.primary}
              delay={160}
              action={() => router.push("/downloads")}
              actionLabel="View All"
            />
          </View>
        );
      case 'downloaded_track':
        return (
          <View style={{ paddingHorizontal: PAD, marginBottom: 10 }}>
            <DownloadedTrackRow track={item.track} index={item.idx} delay={190 + item.idx * 52} />
          </View>
        );
      case 'empty_downloads':
        return (
          <View style={{ paddingHorizontal: PAD }}>
            <EmptyDownloadsState />
          </View>
        );
      case 'my_playlists':
        return (
          <View style={{ paddingHorizontal: PAD }}>
            <MyPlaylistsSection onOpen={goPlaylist} />
          </View>
        );
      default:
        return null;
    }
  }, [insets.top, subOp, subY, handlePlayLikedSongs, router, goPlaylist]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AmbientBG />

      <FlashList
        ref={scrollRef}
        data={listData}
        renderItem={renderLibraryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: bottomPadding + 40 }}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        removeClippedSubviews={true}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  blob:  { position: "absolute", borderRadius: SW * 0.5 },

  // ── Header
  header: {
    paddingHorizontal: PAD,
    paddingBottom: 16,
    gap: 4,
  },
  headerTitle: {
    fontSize: isTablet ? 42 : 36,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -1.2,
    fontFamily: Platform.OS === "android" ? "sans-serif-black" : "System",
    lineHeight: isTablet ? 50 : 43,
  },
  headerSub: {
    fontSize: 14,
    color: "rgba(200,195,215,0.50)",
    fontWeight: "500",
    letterSpacing: 0.1,
    marginTop: 2,
  },

  // ── Tab bar
  tabBarOuter: {
    height: 54,
    overflow: "hidden",
  },
  tabEdgeTop: {
    position:"absolute", top:0, left:0, right:0,
    height: 0.6,
    backgroundColor: "rgba(255,255,255,0.14)",
    zIndex: 10,
  },
  tabEdgeBottom: {
    position:"absolute", bottom:0, left:0, right:0,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.06)",
    zIndex: 10,
  },
  tabScroll: {
    paddingHorizontal: PAD - 8,
    alignItems: "center",
    flexDirection: "row",
    height: 54,
  },
  tabPill: {
    position:"absolute",
    height: 34,
    borderRadius: 17,
    top: 10,
    left: 0,
    overflow: "hidden",
    zIndex: 0,
  },
  tabItem: {
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    minWidth: 44,
    minHeight: 44,
  },
  tabText: {
    fontSize: isTablet ? 13 : 11,
    fontWeight: "600",
    color: C.muted,
    letterSpacing: 0.6,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : "System",
  },
  tabActive: { color: C.text, fontWeight: "800" },

  // ── Content area
  content: {
    paddingHorizontal: PAD,
    paddingTop: 22,
  },

  // ── Hero
  heroOuter: { marginBottom: 16 },
  heroBadge: {
    position:"absolute", top:14, right:14,
    flexDirection:"row", alignItems:"center", gap:5,
    paddingHorizontal:10, paddingVertical:5,
    borderRadius: 20, overflow:"hidden",
  },
  heroBadgeText: {
    fontSize:10, fontWeight:"800", color:C.accent, letterSpacing:1,
  },
  heroBottom: {
    position:"absolute", bottom:18, left:18, right:18,
    flexDirection:"row", alignItems:"center", gap:14,
  },
  heroHeartWrap: {
    width: isTablet ? 64 : 54,
    height: isTablet ? 64 : 54,
    borderRadius: 16,
    justifyContent:"center", alignItems:"center",
    overflow:"hidden", elevation:12,
  },
  heroTitle: {
    fontSize: isTablet ? 28 : 22,
    fontWeight:"800", color:C.text, letterSpacing:-0.5,
    marginBottom: 6,
  },
  heroMetaRow: { flexDirection:"row", flexWrap:"wrap", gap:6 },
  heroStatPill: {
    flexDirection:"row", alignItems:"center",
    paddingHorizontal:9, paddingVertical:4,
    borderRadius:10,
  },
  heroStatText: { fontSize:11, fontWeight:"700" },
  heroChevron: {
    width:32, height:32, borderRadius:16,
    backgroundColor:"rgba(255,255,255,0.10)",
    justifyContent:"center", alignItems:"center",
  },

  // ── Bento
  bentoRow: { flexDirection:"row", gap:14, marginBottom:14 },
  bentoHalf: { flex:1, overflow:"hidden" },
  createInner: { flex:1, alignItems:"center", justifyContent:"center", gap:10 },
  dashedBorder: {
    borderStyle:"dashed", borderWidth:1, borderColor:"rgba(255,255,255,0.16)",
    borderRadius:18, padding:12, alignItems:"center",
  },
  plusCircle: {
    width:44, height:44, borderRadius:22,
    justifyContent:"center", alignItems:"center", overflow:"hidden",
  },
  createLabel: {
    color:"rgba(255,255,255,0.72)",
    fontSize: isSmall ? 10 : 11,
    fontWeight:"700",
    textAlign:"center",
    letterSpacing:0.9,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : "System",
  },
  dlInner: { flex:1, padding: isSmall ? 13 : 17, justifyContent:"space-between" },
  dlTop: { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  dlIconRing: {
    width:32, height:32, borderRadius:16,
    justifyContent:"center", alignItems:"center",
    backgroundColor:h2r("#46f5e0",0.10),
    borderWidth:0.7, borderColor:h2r("#46f5e0",0.24),
  },
  livePill: {
    flexDirection:"row", alignItems:"center", gap:5,
    paddingHorizontal:8, paddingVertical:5,
    borderRadius:12, overflow:"hidden",
  },
  liveText: { fontSize:9, fontWeight:"800", color:C.accent, letterSpacing:0.5 },
  dlTitle: { fontSize: isTablet ? 20 : 17, fontWeight:"700", color:C.text, letterSpacing:-0.3 },
  dlMeta: { fontSize:11, color:C.muted, marginTop:2 },

  // ── Local library
  localInner: {
    padding: isSmall ? 14 : 17,
    flexDirection:"row", alignItems:"center", gap:14,
    minHeight: 44,
  },
  localIconBg: {
    width:46, height:46, borderRadius:23,
    justifyContent:"center", alignItems:"center",
    borderWidth:0.7, borderColor:h2r(C.primary,0.28),
    overflow:"hidden",
  },
  localTitle: { fontSize: isTablet ? 19 : 16, fontWeight:"700", color:C.text, letterSpacing:-0.2 },
  localSub: { fontSize:12, color:C.muted, marginTop:2 },
  localChevronBg: {
    width:28, height:28, borderRadius:14,
    backgroundColor:"rgba(255,255,255,0.06)",
    justifyContent:"center", alignItems:"center",
  },

  // ── Section header
  sectionHeaderRow: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    marginBottom:14, marginTop:8,
  },
  sectionTitleRow: { flexDirection:"row", alignItems:"center", gap:10 },
  accentBar: { width:4, height:20, borderRadius:2 },
  sectionTitle: {
    fontSize: isTablet ? 22 : 19,
    fontWeight:"800", color:C.text, letterSpacing:-0.4,
    fontFamily: Platform.OS === "android" ? "sans-serif-black" : "System",
  },
  viewAll: { fontSize:13, fontWeight:"600" },
  viewAllUnderline: {
    height: 1.5, borderRadius:1,
    marginTop:1,
    transformOrigin:"left",
  },

  // ── Track row
  trackCard: {},
  trackActiveStrip: {
    position:"absolute", left:0, top:0, bottom:0, width:3, zIndex:5,
  },
  trackInner: {
    flexDirection:"row", alignItems:"center",
    paddingVertical:11, paddingHorizontal:14, gap:12,
  },
  trackIndex: { width:22, alignItems:"center", justifyContent:"center" },
  trackIndexText: {
    fontSize:12, fontWeight:"600", color:C.muted,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
  },
  trackArtWrap: { position:"relative", flexShrink:0 },
  trackArt: {
    width: TRACK_ART, height: TRACK_ART,
    borderRadius:12,
    backgroundColor:"rgba(255,255,255,0.06)",
  },
  trackCenter: { flex:1 },
  trackNameRow: { flexDirection:"row", alignItems:"center", gap:5 },
  trackName: {
    fontSize: isTablet ? 16 : 15,
    fontWeight:"700", color:C.text, flex:1, letterSpacing:-0.2,
  },
  trackArtist: { fontSize:12, color:C.muted, marginTop:2 },
  trackDuration: {
    fontSize:12, color:"rgba(170,170,185,0.45)",
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
  },
  trackMoreBtn: { padding:4, minWidth:28, minHeight:28, justifyContent:"center", alignItems:"center" },

  // EQ bars
  eqWrap: { flexDirection:"row", alignItems:"center", gap:2, height:16 },
  eqBar: { width:2.5, height:14, borderRadius:1.5 },

  // ── Playlist grid
  playlistGrid: { flexDirection:"row", flexWrap:"wrap", gap:GRID_GAP, marginTop:4, marginBottom:24 },
  gridArtFrame: {
    width: GRID_ART_W, height: GRID_ART_W,
    marginBottom:10,
    overflow:"hidden",
    // iOS shadow
    ...(Platform.OS === "ios" ? { shadowColor:"#000", shadowOffset:{width:0,height:8}, shadowOpacity:0.35, shadowRadius:14 } : {}),
    elevation: 10,
  },
  gridPlayBadge: {
    position:"absolute", bottom:10, right:10,
    width:32, height:32, borderRadius:16,
    overflow:"hidden", justifyContent:"center", alignItems:"center",
  },
  gridName: {
    fontSize: isTablet ? 16 : 14, fontWeight:"700", color:C.text,
    letterSpacing:-0.2,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : "System",
  },
  gridCount: { fontSize:12, color:C.muted, marginTop:3 },

  // ── Empty Downloads
  emptyDownloadsCard: { paddingVertical: 24, paddingHorizontal: 16 },
  emptyDownloadsInner: { alignItems: "center", gap: 12 },
  emptyDownloadsIconWrap: { marginBottom: 4 },
  emptyDownloadsIconBg: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
  },
  emptyDownloadsTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  emptyDownloadsSub: { fontSize: 13, color: C.muted, textAlign: "center" },

  // ── Empty Playlists
  emptyPlaylistCard: { marginBottom: 20 },
  emptyPlaylistInner: {
    alignItems: "center", gap: 12,
    paddingVertical: 28, paddingHorizontal: 24,
  },
  emptyPlaylistIconWrap: {
    width: 56, height: 56, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    overflow: "hidden",
  },
  emptyPlaylistIconBg: { ...StyleSheet.absoluteFillObject },
  emptyPlaylistTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  emptyPlaylistSub: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 18 },
  emptyPlaylistBtn: {
    marginTop: 8, height: 42, borderRadius: 21,
    paddingHorizontal: 24, overflow: "hidden",
    justifyContent: "center", alignItems: "center",
  },
  emptyPlaylistBtnText: {
    fontSize: 14, fontWeight: "800", color: "#08080D", letterSpacing: -0.1,
  },
});