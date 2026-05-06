import React, { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
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
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MiniPlayer from "@/src/components/MiniPlayer";
import { useMusic } from "@/src/context/MusicContext";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Responsive ────────────────────────────────────────────────────────────────
const isTablet = SW >= 768;
const PAD = isTablet ? 28 : 20;

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
  primaryDp: "#7B2FBE",
  accent: "#46f5e0",
  bg: "#08080D",
  surface: "rgba(28,28,32,0.6)",
  border: "rgba(255,255,255,0.08)",
  text: "#FFFFFF",
  muted: "rgba(170,170,185,0.60)",
  dim: "rgba(170,170,185,0.42)",
};
const SP = { tension: 60, friction: 9 };
const PP = { tension: 200, friction: 8 };

// ── Data ──────────────────────────────────────────────────────────────────────
const DOWNLOADING = [
  { id: "d1", title: "Stardust Echoes", artist: "Nebula Voyager", speed: "1.2 MB/S", progress: 0.70, art: "https://picsum.photos/seed/stardust/200" },
  { id: "d2", title: "Quantum Pulse", artist: "The Synthesizer", speed: "0.8 MB/S", progress: 0.20, art: "https://picsum.photos/seed/quantum/200" },
];
const ALL_DL = [
  { id: 'nebula', title: "Midnight Drive", artist: "Synthwave Collective", duration: "3:42", art: "https://picsum.photos/seed/midnight/200" },
  { id: 'neon', title: "Ocean Whispers", artist: "Calm Horizon", duration: "5:15", art: "https://picsum.photos/seed/ocean/200" },
  { id: 'solar', title: "Urban Sunset", artist: "City Lights Project", duration: "2:58", art: "https://picsum.photos/seed/urban/200" },
  { id: 4, title: "Prism Reflection", artist: "The Glass Theory", duration: "4:10", art: "https://picsum.photos/seed/prism/200" },
  { id: 5, title: "Neon After-hours", artist: "Lofi Dreamer", duration: "3:22", art: "https://picsum.photos/seed/neon/200" },
];

// ── Real device storage (expo-file-system) ────────────────────────────────────
interface SInfo { totalGB: number; freeGB: number; usedGB: number; songs: number; albums: number }
function useStorage(): SInfo {
  const [info, setInfo] = useState<SInfo>({ totalGB: 128, freeGB: 84.2, usedGB: 43.8, songs: 312, albums: 18 });
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
      } catch (_) { }
    })();
  }, []);
  return info;
}

// ── Sub-components ──────────────────────────────────────────────────────────
const Glass = ({ children, style, r = 24, blur = 40 }: { children: any, style?: ViewStyle | ViewStyle[], r?: number, blur?: number }) => (
  <View style={[{ borderRadius: r, overflow: "hidden", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }, style]}>
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={{ position: "absolute", top: 0, left: r * 0.4, right: r * 0.4, height: 1.5, backgroundColor: "rgba(255,255,255,0.12)", zIndex: 8 }} />
    {children}
  </View>
);

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
  }, [delay]);
  return <Animated.View style={[{ opacity: op, transform: [{ scale: sc }] }, style]}>{children}</Animated.View>;
};

const StorageBar = ({ used, total }: { used: number; total: number }) => {
  const width = (used / total) * 100;
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${width}%` }]}>
        <LinearGradient colors={[C.primary, C.primaryMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </View>
    </View>
  );
};

const Ring = ({ progress, size = 48 }: { progress: number; size?: number }) => (
  <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
    <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: "rgba(70,245,224,0.1)" }} />
    <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderTopColor: C.accent, borderRightColor: progress > 0.5 ? C.accent : "transparent", transform: [{ rotate: "-90deg" }] }} />
    <Ionicons name="arrow-down" size={18} color={C.accent} />
  </View>
);

const TrackRow = React.memo(({ track, delay, onPlay }: any) => {
  return (
    <Mat delay={delay}>
      <TouchableOpacity style={s.trackRow} activeOpacity={0.7} onPress={() => onPlay(track)}>
        <Image source={{ uri: track.art }} style={s.trackArt} contentFit="cover" transition={200} />
        <View style={s.trackInfo}>
          <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={s.trackArtist} numberOfLines={1}>{track.artist}</Text>
        </View>
        <Text style={s.trackDur}>{track.duration}</Text>
      </TouchableOpacity>
    </Mat>
  );
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const storage = useStorage();
  const { setTrack } = useMusic();

  const handlePlay = useCallback((track: any) => {
    setTrack({
      id: track.id || 'local',
      url: track.url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: track.title,
      artist: track.artist,
      art: track.art,
      durationSec: 0,
      dominantColors: [C.primary, C.primaryMid],
    } as any);
    router.push({ pathname: "/now_playing", params: { trackId: track.id } });
  }, [setTrack, router]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
        <LinearGradient colors={["rgba(191,90,242,0.05)", "transparent"]} style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 192 }} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={C.primary} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Downloads</Text>
            <View style={{ width: 44 }} />
        </View>

        <View style={s.content}>
          <Mat delay={60}>
            <Glass style={s.storageCard} r={28}>
              <View style={s.storageInner}>
                <Text style={s.stLabel}>STORAGE STATUS</Text>
                <View style={s.stRow}>
                  <View>
                    <Text style={s.stBig}>
                      {storage.usedGB}<Text style={s.stUnit}>GB </Text>
                      <Text style={s.stLight}>used of {storage.totalGB}GB</Text>
                    </Text>
                    <Text style={s.stFree}>{storage.freeGB} GB available</Text>
                  </View>
                </View>
                <StorageBar used={storage.usedGB} total={storage.totalGB} />
              </View>
            </Glass>
          </Mat>

          <Mat delay={120}>
            <Text style={s.secTitle}>Downloading</Text>
            <Glass style={s.dlCard} r={24}>
              {DOWNLOADING.map((item, idx) => (
                <View key={item.id}>
                  <View style={s.dlRow}>
                    <Ring progress={item.progress} />
                    <View style={s.dlInfo}>
                      <Text style={s.dlTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={s.dlArtist} numberOfLines={1}>{item.artist}</Text>
                    </View>
                    <Text style={s.pct}>{Math.round(item.progress * 100)}%</Text>
                  </View>
                  {idx < DOWNLOADING.length - 1 && <View style={s.divider} />}
                </View>
              ))}
            </Glass>
          </Mat>

          <Mat delay={180}>
            <Text style={[s.secTitle, { marginTop: 32 }]}>All Downloads</Text>
            <View style={s.trackList}>
              {ALL_DL.map((track, idx) => (
                <TrackRow key={track.id} track={track} delay={220 + idx * 40} onPlay={handlePlay} />
              ))}
            </View>
          </Mat>
        </View>
      </ScrollView>

      <MiniPlayer />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: PAD, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 28, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  content: { paddingHorizontal: PAD },
  storageCard: { marginBottom: 32 },
  storageInner: { padding: 22 },
  stLabel: { fontSize: 10, fontWeight: "800", color: C.muted, letterSpacing: 1, marginBottom: 12 },
  stRow: { marginBottom: 16 },
  stBig: { fontSize: 24, fontWeight: "900", color: C.text },
  stUnit: { fontSize: 18 },
  stLight: { fontWeight: "400", color: "rgba(255,255,255,0.5)", fontSize: 18 },
  stFree: { fontSize: 13, color: C.muted, marginTop: 4 },
  barTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  secTitle: { fontSize: 20, fontWeight: "800", color: C.text, marginBottom: 16 },
  dlCard: { padding: 4 },
  dlRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 14 },
  dlInfo: { flex: 1 },
  dlTitle: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 2 },
  dlArtist: { fontSize: 12, color: C.muted },
  pct: { fontSize: 13, fontWeight: "700", color: C.accent },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.03)", marginHorizontal: 16 },
  trackList: { gap: 12 },
  trackRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 4 },
  trackArt: { width: 56, height: 56, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 2 },
  trackArtist: { fontSize: 13, color: C.muted },
  trackDur: { fontSize: 12, color: C.dim, fontWeight: '500' },
});
