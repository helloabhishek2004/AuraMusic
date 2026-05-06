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
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

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
const isSmall = SH < 700;
const PAD = isTablet ? 28 : 20;

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

const hex2rgba = (hex: string, a: number) => {
  if (!hex || hex.length < 7) return `rgba(255,255,255,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

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
const Glass = ({ children, style, r = 20, blur = 65, tintColor = "" }: { children: any, style?: ViewStyle | ViewStyle[], r?: number, blur?: number, tintColor?: string }) => (
  <View style={[{ borderRadius: r, overflow: "hidden", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }, style]}>
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={{ position: "absolute", top: 0, left: r * 0.5, right: r * 0.5, height: 1.5, backgroundColor: "rgba(255,255,255,0.22)", zIndex: 8 }} />
    <View style={{ position: "absolute", left: 7, top: 10, bottom: 10, width: 2.5, backgroundColor: "rgba(255,255,255,0.13)", transform: [{ skewX: "-8deg" }], zIndex: 8 }} />
    {!!tintColor && <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, backgroundColor: hex2rgba(tintColor, 0.06) }} />}
    <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.025)" }} />
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
        Animated.timing(op, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <Animated.View style={[{ opacity: op, transform: [{ scale: sc }] }, style]}>{children}</Animated.View>;
};

const useP = () => {
  const sc = useRef(new Animated.Value(1)).current;
  return {
    sc,
    onIn: () => Animated.spring(sc, { toValue: 0.88, ...PP, useNativeDriver: true }).start(),
    onOut: () => Animated.spring(sc, { toValue: 1.0, ...PP, useNativeDriver: true }).start(),
  };
};

const RecentCard = ({ item }: { item: RecentItem }) => {
  const p = useP();
  return (
    <Animated.View style={{ width: 160, transform: [{ scale: p.sc }] }}>
      <TouchableOpacity activeOpacity={1} onPressIn={p.onIn} onPressOut={p.onOut}>
        <View style={s.recentArtWrap}>
          <Image source={{ uri: item.art }} style={s.recentArt} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
          <View style={[s.recentTag, { borderColor: hex2rgba(item.tagColor, 0.3) }]}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={[s.recentTagTxt, { color: item.tagColor }]}>{item.tag}</Text>
          </View>
        </View>
        <Text style={s.recentTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={s.recentArtist} numberOfLines={1}>{item.artist}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const LocalTrackRow = ({ track, index, router }: { track: Track; index: number; router: any }) => {
  const p = useP();
  return (
    <Mat delay={100 + index * 30}>
      <Animated.View style={{ transform: [{ scale: p.sc }] }}>
        <TouchableOpacity 
          style={s.trackRow} 
          activeOpacity={1} 
          onPressIn={p.onIn} 
          onPressOut={p.onOut} 
          onPress={() => router.push({ pathname: "/now_playing", params: { trackId: track.id } })}
        >
          <View style={s.trackArtWrap}>
            {track.art ? (
                <Image source={{ uri: track.art }} style={s.trackArt} contentFit="cover" />
            ) : (
                <View style={[s.trackArt, { backgroundColor: hex2rgba(C.primary, 0.1), justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="musical-notes" size={24} color={C.primary} />
                </View>
            )}
            <View style={s.trackPlayOverlay}>
              <Ionicons name="play" size={24} color="#FFF" style={{ marginLeft: 3 }} />
            </View>
          </View>
          <View style={s.trackInfo}>
            <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
            <View style={s.trackMetaRow}>
              {track.format && (
                <View style={s.trackFormatBadge}>
                    <Text style={[s.trackFormatTxt, { color: track.formatColor || C.primary }]}>{track.format}</Text>
                </View>
              )}
              <Text style={s.trackArtist} numberOfLines={1}>{track.artist || 'Unknown Artist'}</Text>
            </View>
          </View>
          <View style={s.trackRight}>
            <Text style={s.trackDur}>{track.duration || '--:--'}</Text>
            <TouchableOpacity style={{ padding: 4 }}>
              <Ionicons name="ellipsis-vertical" size={18} color={C.muted} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Mat>
  );
};

const FolderItem = ({ name, path, onPress }: { name: string; path: string; onPress: (path: string) => void }) => {
    const p = useP();
    return (
        <Animated.View style={{ transform: [{ scale: p.sc }] }}>
            <TouchableOpacity style={s.folderRow} activeOpacity={1} onPressIn={p.onIn} onPressOut={p.onOut} onPress={() => onPress(path)}>
                <View style={s.folderIconBox}>
                    <Ionicons name="folder" size={24} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.folderName} numberOfLines={1}>{name}</Text>
                    <Text style={s.folderPath} numberOfLines={1}>{path}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.dim} />
            </TouchableOpacity>
        </Animated.View>
    );
};

// ── Data ──────────────────────────────────────────────────────────────────────
const RECENT_ADDED: RecentItem[] = [
  { id: "r1", title: "Astral Frequencies", artist: "Solaris Drift", tag: "NEW", tagColor: C.primary, art: "https://lh3.googleusercontent.com/aida-public/AB6AXuB1Bq0Wc1OwOTfYiFWT-QmU5vao1KDw-haXVSM5k6lSvaze_zQmJb3NIhQy6vZWnbadhpqARy_5n5Wu0oq9oX6sBLrmwNsUDbSObcPIDz1DeTmFuWQK5Cibt2VLFbQTNgmWtqj6vQ0mzKV30Ibi8j_nGctmWyMSQMBMGlv_G4HbIIinr7WbyzKtBgE1Bi4FNioZjfqtMX0UEUKjaE-iZNvtgGGuaj2eRvPvKZSwhjIDidP-gTM5xG9FduwiA3xE8OomQqrXvrUyUE8" },
  { id: "r2", title: "Live at Red Rocks", artist: "Echo Unit", tag: "LIVE", tagColor: C.accent, art: "https://lh3.googleusercontent.com/aida-public/AB6AXuA2ZueC8uPnuZ4tXzoLt28NeS28DddZtl351ntSIzfMrPZwgCwa8uQNdVhKeiPyhsRvocciwStbZgThxnEquIJUYqpYAN7tOYrvNf6PdFXOYqmXWORHvYcWVIyZgrVr_fJmA-jMZD9rxXhOmouSRfYOo-NcSKeKgGszl_ScxsspwaHLODW753w27BcfBJqh5oqURX20VfKTY0allK9SV5w-AUbm0beiR-DsI0ItOCzgI90ldu379CvK0suKwImn7MEi52iRNZb63mo" },
];

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function LocalLibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { used, total, percent, refresh: refreshStorage } = useStorageInfo();

  const [activeTab, setActiveTab] = useState("Songs");
  const [isScanning, setIsScanning] = useState(false);
  const [currentPath, setCurrentPath] = useState(FileSystem.documentDirectory || "");
  const [directoryItems, setDirectoryItems] = useState<{name: string, isDirectory: boolean, path: string}[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  // ── SCAN LOGIC ─────────────────────────────────────────────────────────────
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
        
        // Find tracks in this dir
        const foundTracks = processed.filter(i => !i.isDirectory && i.name.match(/\.(mp3|wav|flac|m4a|aac)$/i));
        setTracks(foundTracks.map((t) => ({
            id: t.path,
            title: t.name,
            artist: "Local File",
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

  const handleScan = async () => {
    setIsScanning(true);
    await refreshStorage();
    await scanDirectory(currentPath);
    setTimeout(() => setIsScanning(false), 800);
  };

  // Animated bg
  const bgP = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bgP, { toValue: 1, duration: 8000, useNativeDriver: false }),
      Animated.timing(bgP, { toValue: 2, duration: 8000, useNativeDriver: false }),
      Animated.timing(bgP, { toValue: 0, duration: 8000, useNativeDriver: false }),
    ])).start();
  }, [bgP]);

  const b1L = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ["-28%", "-12%", "-32%"] });
  const b1T = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ["6%", "20%", "4%"] });
  const b2R = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ["-18%", "-35%", "-10%"] });
  const b2T = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ["50%", "40%", "58%"] });

  const back = useP();
  const scanP = useP();

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── BG ────────────────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
        <Animated.View style={[s.blob, { width: SW * 0.9, height: SW * 0.9, backgroundColor: "#2a0053", left: b1L, top: b1T, opacity: 0.15 }]} />
        <Animated.View style={[s.blob, { width: SW * 0.8, height: SW * 0.8, backgroundColor: "#003731", right: b2R, top: b2T, opacity: 0.12 }]} />
        <LinearGradient colors={["rgba(8,8,13,0)", "rgba(8,8,13,0.8)"]} style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <Mat delay={0}>
          <View style={[s.header, { paddingTop: insets.top + 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Animated.View style={{ transform: [{ scale: back.sc }] }}>
                    <TouchableOpacity style={s.backCircle} onPressIn={back.onIn} onPressOut={back.onOut} onPress={() => router.back()}>
                        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                        <Ionicons name="chevron-back" size={22} color={C.primary} />
                    </TouchableOpacity>
                </Animated.View>
                <View>
                    <Text style={s.headerTitle}>Local Library</Text>
                    <View style={s.headerSubWrap}>
                        <Text style={s.headerSub}>{tracks.length || 0} Tracks</Text>
                        <View style={s.headerDot} />
                        <Text style={s.headerSub}>{formatBytes(used)} Used</Text>
                    </View>
                </View>
            </View>

            <Animated.View style={{ transform: [{ scale: scanP.sc }] }}>
              <TouchableOpacity style={s.scanBtn} onPressIn={scanP.onIn} onPressOut={scanP.onOut} onPress={handleScan} disabled={isScanning}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                {isScanning ? <ActivityIndicator size="small" color={C.primary} /> : <Ionicons name="refresh" size={18} color={C.primary} />}
                <Text style={s.scanTxt}>{isScanning ? "SCANNING..." : "SCAN"}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Mat>

        {/* ── STORAGE ─────────────────────────────────────────────────── */}
        <Mat delay={60}>
            <View style={{ paddingHorizontal: PAD, marginTop: 20 }}>
                <Glass style={s.storageCard} r={24}>
                    <View style={s.storageInner}>
                        <View style={s.storageRingWrap}>
                            <View style={[s.storageRingBase, { borderColor: "rgba(255,255,255,0.08)" }]} />
                            <View style={[s.storageRingProgress, { borderColor: C.primary, transform: [{ rotate: `${(percent * 3.6) - 90}deg` }] }]} />
                            <Text style={s.storageRingText}>{percent}%</Text>
                        </View>
                        <View style={s.storageInfo}>
                            <View style={s.storageRow}>
                                <Text style={s.storageLabel}>Used Space</Text>
                                <Text style={[s.storageVal, { color: C.primary }]}>{formatBytes(used)}</Text>
                            </View>
                            <View style={s.storageBarWrap}>
                                <LinearGradient colors={[C.primary, C.primaryMid]} start={{x:0, y:0}} end={{x:1, y:0}} style={[StyleSheet.absoluteFill, { width: `${percent}%`, borderRadius: 2 }]} />
                            </View>
                            <View style={s.storageRow}>
                                <Text style={s.storageLabel}>Total Capacity</Text>
                                <Text style={[s.storageVal, { color: C.muted }]}>{formatBytes(total)}</Text>
                            </View>
                        </View>
                    </View>
                </Glass>
            </View>
        </Mat>

        {/* ── RECENTLY ADDED ──────────────────────────────────────────── */}
        <Mat delay={100}>
            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Recently Added</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, gap: 16 }}>
                {RECENT_ADDED.map((item) => (
                  <RecentCard key={item.id} item={item} />
                ))}
            </ScrollView>
        </Mat>

        {/* ── TABS ────────────────────────────────────────────────────── */}
        <Mat delay={120}>
            <View style={s.tabsWrap}>
                <Glass style={s.tabsPill} r={24} blur={60}>
                    {["Songs", "Folders"].map((tab) => (
                        <TouchableOpacity key={tab} activeOpacity={0.8} style={s.tabBtn} onPress={() => setActiveTab(tab)}>
                            {activeTab === tab && (
                                <LinearGradient colors={[C.primary, C.primaryMid]} start={{x:0, y:0}} end={{x:1, y:1}} style={StyleSheet.absoluteFill} />
                            )}
                            <Text style={[s.tabTxt, activeTab === tab && { color: "#FFF", fontWeight: "700" }]}>{tab.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </Glass>
            </View>
        </Mat>

        {/* ── CONTENT ─────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: PAD }}>
            {activeTab === "Songs" ? (
                <View style={{ gap: 16 }}>
                    {tracks.length > 0 ? (
                        tracks.map((t, idx) => <LocalTrackRow key={t.id} track={t} index={idx} router={router} />)
                    ) : (
                        <View style={s.emptyState}>
                            <Ionicons name="musical-note-outline" size={48} color={C.dim} />
                            <Text style={s.emptyText}>No tracks found in current folder</Text>
                        </View>
                    )}
                </View>
            ) : (
                <View style={{ gap: 12 }}>
                    {currentPath !== FileSystem.documentDirectory && (
                        <TouchableOpacity style={s.folderRow} onPress={() => {
                            const parts = currentPath.split('/');
                            parts.pop(); // remove trailing slash
                            parts.pop(); // remove last dir
                            setCurrentPath(parts.join('/') + '/');
                        }}>
                            <Ionicons name="arrow-up" size={20} color={C.primary} style={{ marginRight: 12 }} />
                            <Text style={s.folderName}>Go Up</Text>
                        </TouchableOpacity>
                    )}
                    {directoryItems.filter(i => i.isDirectory).map((dir) => (
                        <FolderItem key={dir.path} name={dir.name} path={dir.path} onPress={setCurrentPath} />
                    ))}
                    {directoryItems.filter(i => i.isDirectory).length === 0 && (
                         <View style={s.emptyState}>
                            <Ionicons name="folder-open-outline" size={48} color={C.dim} />
                            <Text style={s.emptyText}>No subfolders found</Text>
                        </View>
                    )}
                </View>
            )}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  blob: { position: "absolute", borderRadius: SW },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: PAD, paddingBottom: 16 },
  backCircle: { width: 44, height: 44, borderRadius: 22, overflow: "hidden", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 26, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  headerSubWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  headerSub: { fontSize: 13, color: C.muted, fontWeight: "500" },
  headerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, overflow: "hidden" },
  scanTxt: { fontSize: 11, fontWeight: "700", color: C.primary, letterSpacing: 0.5 },
  storageCard: { padding: 24 },
  storageInner: { flexDirection: "row", alignItems: "center", gap: 24 },
  storageRingWrap: { width: 70, height: 70, justifyContent: "center", alignItems: "center" },
  storageRingBase: { position: "absolute", width: 70, height: 70, borderRadius: 35, borderWidth: 6 },
  storageRingProgress: { position: "absolute", width: 70, height: 70, borderRadius: 35, borderWidth: 6, borderRightColor: "transparent", borderBottomColor: "transparent" },
  storageRingText: { fontSize: 16, fontWeight: "800", color: C.text },
  storageInfo: { flex: 1, gap: 10 },
  storageRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  storageLabel: { fontSize: 12, color: C.muted, fontWeight: "600" },
  storageVal: { fontSize: 14, fontWeight: "800" },
  storageBarWrap: { height: 4, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" },
  sectionHeader: { paddingHorizontal: PAD, marginTop: 32, marginBottom: 16 },
  sectionTitle: { fontSize: isTablet ? 22 : 18, fontWeight: "800", color: C.text, letterSpacing: -0.2 },
  recentArtWrap: { width: 160, height: 160, borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  recentArt: { width: "100%", height: "100%" },
  recentTag: { position: "absolute", bottom: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  recentTagTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  recentTitle: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 4 },
  recentArtist: { fontSize: 13, color: C.muted },
  tabsWrap: { alignItems: "center", marginVertical: 30 },
  tabsPill: { flexDirection: "row", width: 220, height: 44, borderRadius: 22, padding: 4 },
  tabBtn: { flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 18, overflow: "hidden" },
  tabTxt: { fontSize: 12, fontWeight: "600", color: C.muted },
  trackRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  trackArtWrap: { width: 56, height: 56, borderRadius: 12, overflow: "hidden" },
  trackArt: { width: "100%", height: "100%" },
  trackPlayOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(191,90,242,0.3)", justifyContent: "center", alignItems: "center", opacity: 0 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 4 },
  trackMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trackFormatBadge: { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  trackFormatTxt: { fontSize: 9, fontWeight: "800", color: C.primary },
  trackArtist: { fontSize: 13, color: C.muted },
  trackRight: { alignItems: "flex-end", gap: 4 },
  trackDur: { fontSize: 12, color: C.muted, opacity: 0.7 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  folderIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(191,90,242,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  folderName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
  folderPath: { fontSize: 12, color: C.dim },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40, opacity: 0.6 },
  emptyText: { color: C.text, marginTop: 12, fontSize: 14 },
});
