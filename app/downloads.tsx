import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Responsive ────────────────────────────────────────────────────────────────
const isTablet = SW >= 768;
const isSmall = SH < 700;
const PAD = isTablet ? 28 : 20;

// ── Nav geometry (matches FloatingNav.tsx) ────────────────────────────────────
const BAR_MARGIN = 16;
const BAR_WIDTH = SW - BAR_MARGIN * 2;
const BAR_HEIGHT = 76;
const PILL_VERT_PAD = 6;
const PILL_HEIGHT = BAR_HEIGHT - PILL_VERT_PAD * 2;
const TAB_COUNT = 5;
const TAB_W = BAR_WIDTH / TAB_COUNT;

// ── Filter tab geometry ───────────────────────────────────────────────────────
const FILTER_TABS = ["All", "Songs", "Albums", "Playlists"];
const FTW = 84; // filter tab width

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
  primaryDp: "#7B2FBE",
  accent: "#46f5e0",
  bg: "#08080D",
  surface: "rgba(18,18,22,0.72)",
  surfaceMid: "rgba(28,28,36,0.68)",
  border: "rgba(255,255,255,0.09)",
  text: "#FFFFFF",
  muted: "rgba(170,170,185,0.60)",
  dim: "rgba(170,170,185,0.42)",
};
const SP = { tension: 60, friction: 9 };
const PP = { tension: 200, friction: 8 };

const h2r = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── Data ──────────────────────────────────────────────────────────────────────
const DOWNLOADING = [
  { id: "d1", title: "Stardust Echoes", artist: "Nebula Voyager", speed: "1.2 MB/S", progress: 0.70, art: "https://picsum.photos/seed/stardust/200" },
  { id: "d2", title: "Quantum Pulse", artist: "The Synthesizer", speed: "0.8 MB/S", progress: 0.20, art: "https://picsum.photos/seed/quantum/200" },
];
const ALL_DL = [
  { id: 1, title: "Midnight Drive", artist: "Synthwave Collective", duration: "3:42", art: "https://picsum.photos/seed/midnight/200" },
  { id: 2, title: "Ocean Whispers", artist: "Calm Horizon", duration: "5:15", art: "https://picsum.photos/seed/ocean/200" },
  { id: 3, title: "Urban Sunset", artist: "City Lights Project", duration: "2:58", art: "https://picsum.photos/seed/urban/200" },
  { id: 4, title: "Prism Reflection", artist: "The Glass Theory", duration: "4:10", art: "https://picsum.photos/seed/prism/200" },
  { id: 5, title: "Neon After-hours", artist: "Lofi Dreamer", duration: "3:22", art: "https://picsum.photos/seed/neon/200" },
  { id: 6, title: "Spectral Echoes", artist: "Aether Flow", duration: "5:18", art: "https://picsum.photos/seed/spectral/200" },
];

// ── Real device storage (expo-file-system) ────────────────────────────────────
interface SInfo { totalGB: number; freeGB: number; usedGB: number; songs: number; albums: number }
function useStorage(): SInfo {
  const [info, setInfo] = useState<SInfo>({ totalGB: 32, freeGB: 27.8, usedGB: 4.2, songs: 312, albums: 18 });
  useEffect(() => {
    (async () => {
      try {
        const free = await FileSystem.getFreeDiskStorageAsync();
        const total = await FileSystem.getTotalDiskCapacityAsync();
        setInfo(p => ({
          ...p,
          freeGB: parseFloat((free / 1e9).toFixed(1)),
          totalGB: parseFloat((total / 1e9).toFixed(0)),
          usedGB: parseFloat(((total - free) / 1e9).toFixed(1)),
        }));
      } catch (_) { /* keep defaults on simulator/web */ }
    })();
  }, []);
  return info;
}

// ── 4-Layer Liquid Glass card ─────────────────────────────────────────────────
const Glass = ({ children, style, r = 20, blur = 65, tintColor = "" }: any) => (
  <View style={[{ borderRadius: r, overflow: "hidden", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }, style]}>
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    {/* specular top */}
    <View style={{ position: "absolute", top: 0, left: r * 0.5, right: r * 0.5, height: 1.5, backgroundColor: "rgba(255,255,255,0.22)", zIndex: 8 }} />
    {/* specular left strip */}
    <View style={{ position: "absolute", left: 7, top: 10, bottom: 10, width: 2.5, backgroundColor: "rgba(255,255,255,0.13)", transform: [{ skewX: "-8deg" }], zIndex: 8 }} />
    {/* optional colour tint */}
    {!!tintColor && <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, backgroundColor: h2r(tintColor, 0.06) }} />}
    {/* refraction overlay */}
    <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.025)" }} />
    {children}
  </View>
);

// ── Materialise entrance ──────────────────────────────────────────────────────
const Mat = ({ children, delay = 0, style }: any) => {
  const sc = useRef(new Animated.Value(0.93)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, ...SP, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <Animated.View style={[{ opacity: op, transform: [{ scale: sc }] }, style]}>{children}</Animated.View>;
};

// ── Press-scale hook ──────────────────────────────────────────────────────────
const useP = () => {
  const sc = useRef(new Animated.Value(1)).current;
  return {
    sc,
    onIn: () => Animated.spring(sc, { toValue: 0.88, ...PP, useNativeDriver: true }).start(),
    onOut: () => Animated.spring(sc, { toValue: 1.0, ...PP, useNativeDriver: true }).start(),
  };
};

// ── Storage progress bar ──────────────────────────────────────────────────────
const StorageBar = ({ used, total }: { used: number; total: number }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: used / total, ...SP, useNativeDriver: false }).start();
  }, [used, total]);
  const w = a.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={s.barTrack}>
      <Animated.View style={[s.barFill, { width: w }]}>
        <LinearGradient colors={[C.primary, C.primaryMid, C.primaryDp]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(255,255,255,0.26)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.barTip} />
      </Animated.View>
    </View>
  );
};

// ── Progress ring ─────────────────────────────────────────────────────────────
const Ring = ({ progress, size = 52 }: { progress: number; size?: number }) => (
  <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
    <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: h2r(C.accent, 0.15) }} />
    <View style={{
      position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 3,
      borderTopColor: C.accent,
      borderRightColor: progress > 0.5 ? C.accent : "transparent",
      borderBottomColor: "transparent", borderLeftColor: "transparent",
      transform: [{ rotate: "-90deg" }],
    }} />
    <View style={{ flexDirection: "row", gap: 3 }}>
      <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: C.accent }} />
      <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: C.accent }} />
    </View>
  </View>
);

// ── Mini Now-Playing bar ──────────────────────────────────────────────────────
const MiniPlayer = ({ router }: { router: any }) => {
  const p = useP();
  const [playing, setPlaying] = useState(true);
  const glow = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.5, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[s.miniOuter, { transform: [{ scale: p.sc }] }]}>
      {/* gradient glow bloom */}
      <View pointerEvents="none" style={s.miniGlowLayer}>
        <LinearGradient colors={["transparent", h2r(C.primary, 0.20), "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[h2r(C.primary, 0.14), "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>
      <Glass style={{ flex: 1 }} r={22} blur={85}>
        {/* progress strip */}
        <View style={s.miniProg}>
          <LinearGradient colors={[C.primary, C.primaryMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { width: "40%" }]} />
        </View>
        <TouchableOpacity activeOpacity={1} onPressIn={p.onIn} onPressOut={p.onOut}
          onPress={() => router.push("/now_playing")} style={s.miniRow}>
          <View style={s.miniArtWrap}>
            <Image source={{ uri: "https://picsum.photos/seed/stardust/200" }} style={s.miniArt} contentFit="cover" />
            <View style={[s.miniArtRing, { borderColor: h2r(C.primary, 0.45) }]} />
          </View>
          <View style={s.miniMeta}>
            <Text style={s.miniTitle} numberOfLines={1}>Stardust Echoes</Text>
            <Text style={s.miniSub}>NOW PLAYING</Text>
          </View>
          <TouchableOpacity style={s.miniCtrl}><Ionicons name="play-skip-back" size={20} color="#FFF" /></TouchableOpacity>
          {/* play btn — full glass */}
          <TouchableOpacity style={s.miniPlay} onPress={() => setPlaying(!playing)}>
            <LinearGradient colors={[C.primary, C.primaryMid, C.primaryDp]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={{ position: "absolute", top: 3, left: 8, right: 8, height: 2.5, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.30)" }} />
            <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }} />
            <Ionicons name={playing ? "pause" : "play"} size={18} color="#FFF" style={{ marginLeft: playing ? 0 : 2, zIndex: 2 }} />
          </TouchableOpacity>
          <TouchableOpacity style={s.miniCtrl}><Ionicons name="play-skip-forward" size={20} color="#FFF" /></TouchableOpacity>
        </TouchableOpacity>
      </Glass>
    </Animated.View>
  );
};

// ── Floating Nav (5 tabs, embedded) ──────────────────────────────────────────
const FloatingNav = ({ active = 2 }: { active?: number }) => {
  const router = useRouter();
  const slide = useRef(new Animated.Value(active * TAB_W)).current;
  const glowX = useRef(new Animated.Value(active * TAB_W + TAB_W / 2)).current;
  const glowOp = useRef(new Animated.Value(1)).current;
  const scales = useRef(Array.from({ length: TAB_COUNT }, () => new Animated.Value(1))).current;
  const [cur, setCur] = useState(active);

  const TABS = [
    { label: "HOME", icon: "home", route: "/(tabs)" },
    { label: "BROWSE", icon: "compass", route: "/(tabs)/browse" },
    { label: "LIBRARY", icon: "musical-notes", route: "BACK" },
    { label: "SETTINGS", icon: "settings", route: "/(tabs)/settings" },
    { label: "SEARCH", icon: "search", route: "/(tabs)/search" },
  ];

  const go = (idx: number) => {
    setCur(idx);
    Animated.spring(slide, { toValue: idx * TAB_W, ...SP, useNativeDriver: true }).start();
    Animated.spring(glowX, { toValue: idx * TAB_W + TAB_W / 2, ...SP, useNativeDriver: false }).start();
    glowOp.setValue(0.25);
    Animated.timing(glowOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(scales[idx], { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scales[idx], { toValue: 1, ...PP, useNativeDriver: true }),
    ]).start();
    if (TABS[idx].route === "BACK") { router.back(); return; }
    try { router.push(TABS[idx].route as any); } catch (_) { }
  };

  const GOW = TAB_W * 1.8, GIW = TAB_W * 1.0;
  return (
    <View style={nv.outer}>
      {/* soft glow bloom — no solid bg */}
      <Animated.View pointerEvents="none" style={[nv.glowOut, { width: GOW, opacity: glowOp, left: Animated.subtract(glowX, GOW / 2) }]}>
        <LinearGradient colors={["transparent", "rgba(155,56,218,0.20)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(155,56,218,0.15)", "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[nv.glowIn, { width: GIW, opacity: glowOp, left: Animated.subtract(glowX, GIW / 2) }]}>
        <LinearGradient colors={["transparent", "rgba(191,90,242,0.30)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(191,90,242,0.22)", "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View style={nv.bar}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={nv.topEdge} />
        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: BAR_HEIGHT / 2, borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(255,255,255,0.015)" }} />

        {/* sliding pill */}
        <Animated.View pointerEvents="none" style={[nv.pill, { width: TAB_W - 10, transform: [{ translateX: Animated.add(slide, new Animated.Value(5)) }] }]}>
          <LinearGradient colors={[C.primary, C.primaryMid, C.primaryDp]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ position: "absolute", top: 3, left: 16, right: 16, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.30)" }} />
          <View style={{ position: "absolute", left: 10, top: 5, width: 32, height: PILL_HEIGHT - 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", transform: [{ skewX: "-8deg" }] }} />
          <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: PILL_HEIGHT / 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.04)" }} />
        </Animated.View>

        {TABS.map((t, i) => {
          const focused = i === cur;
          return (
            <TouchableOpacity key={t.label} onPress={() => go(i)} activeOpacity={1} style={[nv.tab, { width: TAB_W }]}>
              <Animated.View style={[nv.tabInner, { transform: [{ scale: scales[i] }] }]}>
                <Ionicons name={(focused ? t.icon : `${t.icon}-outline`) as any} size={focused ? 24 : 21} color={focused ? "#FFF" : "rgba(180,180,195,0.65)"} />
                <Text style={[nv.label, focused ? nv.lActive : nv.lInact]}>{t.label}</Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ── Track row ─────────────────────────────────────────────────────────────────
const TrackRow = ({ track, delay, router }: any) => {
  const p = useP();
  return (
    <Mat delay={delay}>
      <Animated.View style={{ transform: [{ scale: p.sc }] }}>
        <Glass style={s.trackCard} r={18} blur={55}>
          <TouchableOpacity style={s.trackRow} onPressIn={p.onIn} onPressOut={p.onOut} activeOpacity={1}
            onPress={() => router.push({ pathname: "/now_playing", params: { trackId: track.id } })}>
            <Image source={{ uri: track.art }} style={s.trackArt} contentFit="cover" transition={200} />
            <View style={s.trackInfo}>
              <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={s.trackArtist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Text style={s.trackDur}>{track.duration}</Text>
            <TouchableOpacity style={s.moreBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-vertical" size={17} color={C.dim} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Glass>
      </Animated.View>
    </Mat>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const storage = useStorage();

  const [activeFilter, setActiveFilter] = useState("All");
  const [dlExpanded, setDlExpanded] = useState(true);

  // Filter pill anim
  const [fLayouts, setFLayouts] = useState<any>({});
  const fSlide = useRef(new Animated.Value(0)).current;
  const fWidth = useRef(new Animated.Value(0)).current;
  const fScale = useRef(new Animated.Value(1)).current;
  const initialFSet = useRef(false);

  // Animated bg — 3 breathing blobs
  const bgP = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bgP, { toValue: 1, duration: 6000, useNativeDriver: false }),
      Animated.timing(bgP, { toValue: 2, duration: 6000, useNativeDriver: false }),
      Animated.timing(bgP, { toValue: 0, duration: 6000, useNativeDriver: false }),
    ])).start();
  }, []);

  const b1L = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ["-28%", "-12%", "-32%"] });
  const b1T = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ["6%", "20%", "4%"] });
  const b2R = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ["-18%", "-35%", "-10%"] });
  const b2T = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ["50%", "40%", "58%"] });
  const b1Op = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: [0.12, 0.20, 0.10] });
  const b2Op = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: [0.08, 0.14, 0.18] });
  const b3Op = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: [0.05, 0.13, 0.08] });

  const back = useP();

  const handleFLayout = (idx: number, e: any) => {
    const { x, width } = e.nativeEvent.layout;
    setFLayouts((p: any) => ({ ...p, [idx]: { x, width } }));
    if (idx === 0 && !initialFSet.current) {
      fSlide.setValue(x + 5);
      fWidth.setValue(width - 10);
      initialFSet.current = true;
    }
  };

  const pickFilter = useCallback((tab: string, idx: number) => {
    const layout = fLayouts[idx];
    if (!layout) return;

    setActiveFilter(tab);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(fScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
        Animated.spring(fScale, { toValue: 1, ...PP, useNativeDriver: true }),
      ]),
      Animated.spring(fSlide, { toValue: layout.x + 5, ...SP, useNativeDriver: true }),
      Animated.spring(fWidth, { toValue: layout.width - 10, ...SP, useNativeDriver: false }),
    ]).start();
  }, [fLayouts]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── ANIMATED BG ─────────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
        <Animated.View style={[s.blob, { width: SW * 0.85, height: SW * 0.85, backgroundColor: "#2a0053", left: b1L, top: b1T, opacity: b1Op }]} />
        <Animated.View style={[s.blob, { width: SW * 0.70, height: SW * 0.70, backgroundColor: "#003731", right: b2R, top: b2T, opacity: b2Op }]} />
        <Animated.View style={[s.blob, { width: SW * 0.50, height: SW * 0.50, backgroundColor: "#1a0038", left: "-8%", bottom: "18%", opacity: b3Op }]} />
        <LinearGradient
          colors={["rgba(8,8,13,0.05)", "rgba(8,8,13,0.62)", "rgba(8,8,13,0.94)"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 192 }}
        stickyHeaderIndices={[1]}
      >
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <Mat delay={0}>
          <View style={[s.header, { paddingTop: insets.top + (isSmall ? 14 : 20) }]}>
            <Animated.View style={{ transform: [{ scale: back.sc }] }}>
              <TouchableOpacity style={s.backCircle}
                onPressIn={back.onIn} onPressOut={back.onOut}
                onPress={() => router.back()} activeOpacity={1}>
                <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(255,255,255,0.04)" }} />
                <Ionicons name="chevron-back" size={22} color={C.primary} />
              </TouchableOpacity>
            </Animated.View>

            <Text style={s.headerTitle}>Downloads</Text>
            {/* balance spacer — three-dot removed as requested */}
            <View style={{ width: 44 }} />
          </View>
        </Mat>

        {/* ── STICKY FILTER BAR ───────────────────────────────────────── */}
        <View style={s.filterBarWrap}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={s.fBarTop} />
          <View style={s.fBarBot} />
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.012)" }} />
          <View style={[s.filterRow, { paddingHorizontal: 12 }]}>
            <Animated.View pointerEvents="none" style={[s.fPill, {
              width: fWidth,
              transform: [{ translateX: fSlide }, { scale: fScale }],
            }]}>
              <LinearGradient colors={[C.primary, C.primaryMid, C.primaryDp]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={{ position: "absolute", top: 2, left: 10, right: 10, height: 2.5, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.30)" }} />
              <View style={{ position: "absolute", left: 7, top: 4, width: 18, bottom: 4, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.16)", transform: [{ skewX: "-8deg" }] }} />
              <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.04)" }} />
            </Animated.View>

            {FILTER_TABS.map((tab, idx) => (
              <TouchableOpacity key={tab} 
                onLayout={(e) => handleFLayout(idx, e)}
                style={[s.fTab, { flex: 1 }]}
                onPress={() => pickFilter(tab, idx)} activeOpacity={1}>
                {activeFilter !== tab && (
                  <View style={s.fTabBg}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceMid }} />
                  </View>
                )}
                <Text style={[s.fTabText, activeFilter === tab && s.fTabTextOn]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
        <View style={s.content}>

          {/* Storage card */}
          <Mat delay={60}>
            <Glass style={s.storageCard} r={24} blur={70}>
              <View style={s.storageInner}>
                <Text style={s.stLabel}>STORAGE STATUS</Text>
                <View style={s.stRow}>
                  <View>
                    <Text style={s.stBig}>
                      {storage.usedGB}<Text style={s.stUnit}> GB </Text>
                      <Text style={s.stLight}>used of {storage.totalGB} GB</Text>
                    </Text>
                    <Text style={s.stFree}>{storage.freeGB} GB available</Text>
                  </View>
                  <View style={s.stStats}>
                    {[{ n: storage.songs, l: "SONGS" }, { n: storage.albums, l: "ALBUMS" }].map(it => (
                      <View key={it.l} style={s.stStat}>
                        <Text style={s.stN}>{it.n}</Text>
                        <Text style={s.stL}>{it.l}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <StorageBar used={storage.usedGB} total={storage.totalGB} />
              </View>
            </Glass>
          </Mat>

          {/* Downloading header */}
          <Mat delay={140}>
            <TouchableOpacity style={s.secHeader} onPress={() => setDlExpanded(v => !v)} activeOpacity={0.8}>
              <Text style={s.secTitle}>Downloading ({DOWNLOADING.length})</Text>
              <View style={s.chevronBtn}>
                <Ionicons name={dlExpanded ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
              </View>
            </TouchableOpacity>
          </Mat>

          {dlExpanded && (
            <Mat delay={170}>
              <Glass style={s.dlCard} r={20} blur={60}>
                {DOWNLOADING.map((item, idx) => (
                  <View key={item.id}>
                    <View style={s.dlRow}>
                      <Ring progress={item.progress} size={52} />
                      <View style={s.dlInfo}>
                        <Text style={s.dlTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={s.dlArtist} numberOfLines={1}>{item.artist}</Text>
                      </View>
                      <View style={s.dlMeta}>
                        <View style={s.speedTag}>
                          <Text style={s.speedTxt}>{item.speed}</Text>
                        </View>
                        <Text style={s.pct}>{Math.round(item.progress * 100)}%</Text>
                      </View>
                    </View>
                    {idx < DOWNLOADING.length - 1 && <View style={s.divider} />}
                  </View>
                ))}
              </Glass>
            </Mat>
          )}

          {/* All Downloads */}
          <Mat delay={220}>
            <Text style={[s.secTitle, { marginTop: 32, marginBottom: 16 }]}>All Downloads</Text>
          </Mat>

          <View style={s.trackList}>
            {ALL_DL.map((track, idx) => (
              <TrackRow key={track.id} track={track} delay={260 + idx * 40} router={router} />
            ))}
          </View>
        </View>
      </ScrollView>

      <MiniPlayer router={router} />
      <FloatingNav active={2} />
    </View>
  );
}

// ── Nav stylesheet ────────────────────────────────────────────────────────────
const nv = StyleSheet.create({
  outer: { position: "absolute", bottom: 28, left: BAR_MARGIN, right: BAR_MARGIN },
  glowOut: { position: "absolute", top: BAR_HEIGHT - 4, height: 32 },
  glowIn: { position: "absolute", top: BAR_HEIGHT - 2, height: 20 },
  bar: {
    width: BAR_WIDTH, height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2, flexDirection: "row", alignItems: "center",
    overflow: "hidden", backgroundColor: "rgba(18,18,22,0.72)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20 },
      android: { elevation: 18 },
    }),
  },
  topEdge: { position: "absolute", top: 0, left: BAR_HEIGHT / 2, right: BAR_HEIGHT / 2, height: 1, backgroundColor: "rgba(255,255,255,0.13)", zIndex: 10 },
  pill: {
    position: "absolute", top: PILL_VERT_PAD, height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2, overflow: "hidden", zIndex: 0,
    ...Platform.select({ ios: { shadowColor: "#9B38DA", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10 } }),
  },
  tab: { height: BAR_HEIGHT, justifyContent: "center", alignItems: "center", zIndex: 1 },
  tabInner: { alignItems: "center", justifyContent: "center", gap: 3 },
  label: {
    fontSize: 9, letterSpacing: 0.6, fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium"
  },
  lActive: { color: "#FFF", fontWeight: "700", fontSize: 9.5 },
  lInact: { color: "rgba(180,180,195,0.65)" },
});

// ── Screen stylesheet ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  blob: { position: "absolute", borderRadius: SW * 0.5 },

  // header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: PAD, paddingBottom: 14 },
  backCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  headerTitle: {
    fontSize: isTablet ? 32 : 26, fontWeight: "800", color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
    letterSpacing: -0.4,
    textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // sticky filter bar
  filterBarWrap: { height: 54, overflow: "hidden", backgroundColor: "rgba(14,14,18,0.35)" },
  fBarTop: { position: "absolute", top: 0, left: 0, right: 0, height: 0.5, backgroundColor: "rgba(255,255,255,0.10)", zIndex: 10 },
  fBarBot: { position: "absolute", bottom: 0, left: 0, right: 0, height: 0.5, backgroundColor: "rgba(255,255,255,0.06)", zIndex: 10 },
  filterRow: { paddingHorizontal: PAD - 4, alignItems: "center", flexDirection: "row", height: 54, position: "relative" },
  fPill: { position: "absolute", height: 36, borderRadius: 18, top: 9, left: 0, overflow: "hidden", zIndex: 0 },
  fTab: { width: FTW, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", overflow: "hidden", zIndex: 1 },
  fTabBg: { ...StyleSheet.absoluteFillObject, borderRadius: 18, overflow: "hidden" },
  fTabText: { fontSize: 13, fontWeight: "600", color: C.muted, fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium", zIndex: 2 },
  fTabTextOn: { color: C.text, fontWeight: "700" },

  content: { paddingHorizontal: PAD, paddingTop: 22 },

  // storage card
  storageCard: { marginBottom: 24 },
  storageInner: { padding: isTablet ? 24 : 18 },
  stLabel: {
    fontSize: 10, fontWeight: "700", color: C.muted, letterSpacing: 1.4, marginBottom: 14,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium"
  },
  stRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  stBig: {
    fontSize: isTablet ? 28 : 22, fontWeight: "800", color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium", letterSpacing: -0.3
  },
  stUnit: { fontWeight: "800" },
  stLight: { fontWeight: "300", color: "rgba(255,255,255,0.60)", fontSize: isTablet ? 20 : 18 },
  stFree: { fontSize: 13, color: C.muted, marginTop: 5 },
  stStats: { flexDirection: "row", gap: isTablet ? 28 : 22, marginTop: 4 },
  stStat: { alignItems: "center" },
  stN: { fontSize: isTablet ? 22 : 18, fontWeight: "700", color: C.text },
  stL: {
    fontSize: 9, fontWeight: "700", color: C.muted, letterSpacing: 0.9, marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium"
  },

  barTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "visible" },
  barFill: { height: 6, borderRadius: 3, overflow: "visible" },
  barTip: {
    position: "absolute", right: -5, top: -3, width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.primary,
    ...Platform.select({ ios: { shadowColor: C.primary, shadowRadius: 8, shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 } } }),
  },

  // sections
  secHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  secTitle: {
    fontSize: isTablet ? 22 : 18, fontWeight: "800", color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium", letterSpacing: -0.2
  },
  chevronBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },

  // downloading card
  dlCard: { marginBottom: 8 },
  dlRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  dlInfo: { flex: 1 },
  dlTitle: { fontSize: isTablet ? 16 : 14, fontWeight: "700", color: C.text, marginBottom: 3 },
  dlArtist: { fontSize: 12, color: C.muted },
  dlMeta: { alignItems: "flex-end", gap: 5 },
  speedTag: {
    backgroundColor: "rgba(70,245,224,0.10)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(70,245,224,0.22)"
  },
  speedTxt: { fontSize: 9.5, fontWeight: "700", color: C.accent, letterSpacing: 0.3 },
  pct: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.50)" },
  divider: { marginHorizontal: 16, height: 0.5, backgroundColor: "rgba(255,255,255,0.07)" },

  // tracks
  trackList: { gap: 10 },
  trackCard: {},
  trackRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 14 },
  trackArt: { width: isTablet ? 60 : 52, height: isTablet ? 60 : 52, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: isTablet ? 16 : 14, fontWeight: "700", color: C.text, marginBottom: 4 },
  trackArtist: { fontSize: 12, color: C.muted },
  trackDur: { fontSize: 12, color: C.dim, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  moreBtn: { padding: 4 },

  // mini player
  miniOuter: {
    position: "absolute", bottom: 114, left: 16, right: 16, height: 72,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 18 },
      android: { elevation: 16 },
    }),
  },
  miniGlowLayer: { position: "absolute", top: 4, left: "10%", right: "10%", height: 28, bottom: -18 },
  miniRow: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 12 },
  miniArtWrap: { width: 46, height: 46, borderRadius: 12, position: "relative" },
  miniArt: { width: 46, height: 46, borderRadius: 12 },
  miniArtRing: { ...StyleSheet.absoluteFillObject, borderRadius: 12, borderWidth: 1.5 },
  miniMeta: { flex: 1 },
  miniTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  miniSub: {
    fontSize: 9.5, fontWeight: "700", color: C.primary, marginTop: 2, letterSpacing: 0.8,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium"
  },
  miniCtrl: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  miniPlay: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: "center", alignItems: "center", overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: C.primaryMid, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.6, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  miniProg: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5,
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 1, overflow: "hidden"
  },
});