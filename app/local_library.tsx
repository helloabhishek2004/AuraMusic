import React, { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
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
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMusic } from "@/src/context/MusicContext";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Types ───────────────────────────────────────────────────────────────────
interface Track {
  id: string;
  title: string;
  artist?: string;
  duration?: string;
  format?: string;
  formatColor?: string;
  art?: string;
  path: string;
}

interface RecentItem {
  id: string;
  title: string;
  artist: string;
  tag: string;
  tagColor: string;
  art: string;
}

// ── Responsive ────────────────────────────────────────────────────────────────
const isTablet = SW >= 768;
const PAD = isTablet ? 28 : 20;

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
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

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ── Hooks ────────────────────────────────────────────────────────────────────
const useStorageInfo = () => {
  const [stats, setStats] = useState({ used: 0, free: 0, total: 0, percent: 0 });
  const refresh = useCallback(async () => {
    try {
      const free = await FileSystem.getFreeDiskStorageAsync();
      const total = await FileSystem.getTotalDiskCapacityAsync();
      const used = total - free;
      setStats({
        used,
        free,
        total,
        percent: total > 0 ? Math.round((used / total) * 100) : 0,
      });
    } catch (e) {
      console.warn("Storage stats error", e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...stats, refresh };
};

// ── Sub-components ──────────────────────────────────────────────────────────
const Glass = ({ children, style, r = 24, blur = 40 }: { children: any, style?: ViewStyle | ViewStyle[], r?: number, blur?: number }) => (
  <View style={[{ borderRadius: r, overflow: "hidden", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }, style]}>
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={{ position: "absolute", top: 0, left: r * 0.4, right: r * 0.4, height: 1.5, backgroundColor: "rgba(255,255,255,0.12)", zIndex: 8 }} />
    {children}
  </View>
);

const Mat = ({ children, delay = 0, style }: { children: any, delay?: number, style?: ViewStyle | ViewStyle[] }) => {
  const sc = useRef(new Animated.Value(0.93)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, ...SP, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);
  return <Animated.View style={[{ opacity: op, transform: [{ scale: sc }] }, style]}>{children}</Animated.View>;
};

const useP = () => {
  const sc = useRef(new Animated.Value(1)).current;
  return {
    sc,
    onIn: () => Animated.spring(sc, { toValue: 0.92, ...PP, useNativeDriver: true }).start(),
    onOut: () => Animated.spring(sc, { toValue: 1.0, ...PP, useNativeDriver: true }).start(),
  };
};

const RecentCard = React.memo(({ item }: { item: RecentItem }) => {
  const p = useP();
  return (
    <Animated.View style={{ width: 150, transform: [{ scale: p.sc }] }}>
      <TouchableOpacity activeOpacity={1} onPressIn={p.onIn} onPressOut={p.onOut}>
        <View style={s.recentArtWrap}>
          <Image source={{ uri: item.art }} style={s.recentArt} contentFit="cover" transition={200} />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
        </View>
        <Text style={s.recentTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={s.recentArtist} numberOfLines={1}>{item.artist}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const LocalTrackRow = React.memo(({ track, index, onPlay }: { track: Track; index: number; onPlay: (track: Track) => void }) => {
  const p = useP();
  return (
    <Mat delay={50 + index * 40}>
      <Animated.View style={{ transform: [{ scale: p.sc }] }}>
        <TouchableOpacity 
          style={s.trackRow} 
          activeOpacity={1} 
          onPressIn={p.onIn} 
          onPressOut={p.onOut} 
          onPress={() => onPlay(track)}
        >
          <View style={s.trackArtWrap}>
            {track.art ? (
                <Image source={{ uri: track.art }} style={s.trackArt} contentFit="cover" />
            ) : (
                <View style={[s.trackArt, { backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="musical-notes" size={24} color={C.primary} />
                </View>
            )}
            <View style={s.trackPlayOverlay}>
              <Ionicons name="play" size={24} color="#FFF" />
            </View>
          </View>
          <View style={s.trackInfo}>
            <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
            <View style={s.trackMetaRow}>
              {track.format && (
                <View style={s.trackFormatBadge}>
                    <Text style={s.trackFormatTxt}>{track.format}</Text>
                </View>
              )}
              <Text style={s.trackArtist} numberOfLines={1}>{track.artist || 'Local'}</Text>
            </View>
          </View>
          <Text style={s.trackDur}>{track.duration || '--:--'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Mat>
  );
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function LocalLibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setTrack } = useMusic();
  const { used, total, percent, refresh: refreshStorage } = useStorageInfo();

  const [activeTab, setActiveTab] = useState("Songs");
  const [isScanning, setIsScanning] = useState(false);
  const [currentPath, setCurrentPath] = useState(FileSystem.documentDirectory || "");
  const [directoryItems, setDirectoryItems] = useState<{name: string, isDirectory: boolean, path: string}[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  const handlePlayTrack = useCallback((localTrack: Track) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTrack({
      id: localTrack.id,
      url: localTrack.path,
      title: localTrack.title,
      artist: localTrack.artist || 'Local',
      art: localTrack.art || '',
      durationSec: 0,
      dominantColors: [C.primary, C.primaryMid],
    } as any);
    router.push({ pathname: "/now_playing", params: { trackId: localTrack.id } });
  }, [setTrack, router]);

  const scanDirectory = useCallback(async (path: string) => {
    if (!path) return;
    setIsScanning(true);
    try {
        const items = await FileSystem.readDirectoryAsync(path);
        const processed = await Promise.all(items.map(async (name) => {
            const info = await FileSystem.getInfoAsync(path + name);
            return {
                name,
                isDirectory: info.isDirectory,
                path: path + name + (info.isDirectory ? '/' : '')
            };
        }));
        setDirectoryItems(processed);
        const foundTracks = processed.filter(i => !i.isDirectory && i.name.match(/\.(mp3|wav|flac|m4a|aac)$/i));
        setTracks(foundTracks.map((t) => ({
            id: t.path,
            title: t.name,
            artist: "Local",
            format: t.name.split('.').pop()?.toUpperCase(),
            path: t.path
        })));
    } catch (e) {
        console.warn("Scan failed", e);
    } finally {
        setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    scanDirectory(currentPath);
  }, [currentPath, scanDirectory]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
        <LinearGradient colors={["rgba(191,90,242,0.05)", "transparent"]} style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { paddingTop: insets.top + 20 }]}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={C.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.headerTitle}>Local Library</Text>
                <Text style={s.headerSub}>{tracks.length} Tracks • {formatBytes(used)} Used</Text>
            </View>
            <TouchableOpacity 
              style={s.scanBtn} 
              onPress={() => { setIsScanning(true); refreshStorage(); scanDirectory(currentPath); }}
              disabled={isScanning}
            >
                {isScanning ? <ActivityIndicator size="small" color={C.primary} /> : <Ionicons name="refresh" size={18} color={C.primary} />}
            </TouchableOpacity>
        </View>

        <View style={s.tabsWrap}>
            {["Songs", "Folders"].map((tab) => (
                <TouchableOpacity key={tab} style={[s.tabBtn, activeTab === tab && s.tabBtnActive]} onPress={() => setActiveTab(tab)}>
                    <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>{tab}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <View style={{ paddingHorizontal: PAD }}>
            {activeTab === "Songs" ? (
                <View style={{ gap: 16 }}>
                    {tracks.length > 0 ? (
                        tracks.map((t, idx) => <LocalTrackRow key={t.id} track={t} index={idx} onPlay={handlePlayTrack} />)
                    ) : (
                        <View style={s.emptyState}>
                            <Ionicons name="musical-note-outline" size={48} color={C.dim} />
                            <Text style={s.emptyText}>No tracks found</Text>
                        </View>
                    )}
                </View>
            ) : (
                <View style={{ gap: 12 }}>
                    {currentPath !== FileSystem.documentDirectory && (
                        <TouchableOpacity style={s.folderRow} onPress={() => {
                            const parts = currentPath.split('/');
                            parts.pop(); parts.pop();
                            setCurrentPath(parts.join('/') + '/');
                        }}>
                            <Ionicons name="arrow-up" size={20} color={C.primary} style={{ marginRight: 12 }} />
                            <Text style={s.folderName}>Go Up</Text>
                        </TouchableOpacity>
                    )}
                    {directoryItems.filter(i => i.isDirectory).map((dir) => (
                        <TouchableOpacity key={dir.path} style={s.folderRow} onPress={() => setCurrentPath(dir.path)}>
                            <Ionicons name="folder" size={22} color={C.primary} style={{ marginRight: 14 }} />
                            <Text style={s.folderName}>{dir.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: PAD, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 28, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: C.muted, fontWeight: "500", marginTop: 2 },
  scanBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
  tabsWrap: { flexDirection: 'row', gap: 12, paddingHorizontal: PAD, marginBottom: 24, marginTop: 10 },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)' },
  tabBtnActive: { backgroundColor: C.primary },
  tabTxt: { fontSize: 14, fontWeight: "600", color: C.muted },
  tabTxtActive: { color: "#FFF" },
  trackRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  trackArtWrap: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", backgroundColor: 'rgba(255,255,255,0.05)' },
  trackArt: { width: "100%", height: "100%" },
  trackPlayOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", alignItems: "center", opacity: 0 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 4 },
  trackMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trackFormatBadge: { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  trackFormatTxt: { fontSize: 9, fontWeight: "900", color: C.primary },
  trackArtist: { fontSize: 13, color: C.muted },
  trackDur: { fontSize: 12, color: C.dim, fontWeight: '500' },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  folderName: { fontSize: 16, fontWeight: '600', color: C.text },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, opacity: 0.5 },
  emptyText: { color: C.text, marginTop: 12, fontSize: 15, fontWeight: '500' },
  recentArtWrap: { width: 150, height: 150, borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  recentArt: { width: "100%", height: "100%" },
  recentTitle: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 4 },
  recentArtist: { fontSize: 13, color: C.muted },
});
