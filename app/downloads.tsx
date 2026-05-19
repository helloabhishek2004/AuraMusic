import { CategoryTabs } from "@/src/components/CategoryTabs";
import MiniPlayer from "@/src/components/MiniPlayer";
import { useMusic } from "@/src/context/MusicContext";
import { DownloadManager } from "@/src/features/download/services/download.manager";
import { useDownloadStore } from "@/src/features/download/store/download.store";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Responsive ─────────────────────────────────────────────────────────────────
const isTablet = SW >= 768;
const PAD = isTablet ? 28 : 20;
const TRACK_ART_SIZE = isTablet ? 64 : 56;
const HEADER_FONT = isTablet ? 34 : 28;

// ── Design Tokens — iOS 26 Liquid Glass palette ────────────────────────────────
const C = {
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
  primaryDp: "#7B2FBE",
  accent: "#46f5e0",
  accentDim: "rgba(70,245,224,0.18)",
  bg: "#08080D",
  surface: "rgba(255,255,255,0.055)",
  surfaceHover: "rgba(255,255,255,0.085)",
  border: "rgba(255,255,255,0.10)",
  borderTop: "rgba(255,255,255,0.18)",
  text: "#FFFFFF",
  muted: "rgba(170,170,185,0.65)",
  dim: "rgba(170,170,185,0.40)",
  danger: "#FF453A",
  shimmer1: "rgba(255,255,255,0.0)",
  shimmer2: "rgba(255,255,255,0.06)",
  shimmer3: "rgba(255,255,255,0.0)",
};

// ── Easing presets (Apple spring-like) ────────────────────────────────────────
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);

// ── Storage hook ──────────────────────────────────────────────────────────────
interface SInfo {
  totalGB: number;
  freeGB: number;
  usedGB: number;
  songs: number;
  albums: number;
}
function useStorage(): SInfo {
  const [info, setInfo] = useState<SInfo>({
    totalGB: 128,
    freeGB: 84.2,
    usedGB: 43.8,
    songs: 0,
    albums: 0,
  });
  const downloadedTracks = useDownloadStore((s) => s.downloadedTracks);
  useEffect(() => {
    (async () => {
      try {
        const free = await FileSystem.getFreeDiskStorageAsync();
        const total = await FileSystem.getTotalDiskCapacityAsync();
        setInfo((p) => ({
          ...p,
          freeGB: parseFloat((free / 1e9).toFixed(1)),
          totalGB: parseFloat((total / 1e9).toFixed(0)),
          usedGB: parseFloat(((total - free) / 1e9).toFixed(1)),
          songs: Object.keys(downloadedTracks).length,
        }));
      } catch (_) {}
    })();
  }, [downloadedTracks]);
  return info;
}

// ── Shimmer skeleton hook ──────────────────────────────────────────────────────
function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [anim]);
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SW, SW],
  });
  return translateX;
}

// ── Entrance animation hook ────────────────────────────────────────────────────
function useEntrance(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay,
        easing: EASE_OUT_EXPO,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 480,
        delay,
        easing: EASE_OUT_EXPO,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ── Ambient background orbs ────────────────────────────────────────────────────
const AmbientBG = React.memo(() => {
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulse = (val: Animated.Value, dur: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 1,
            duration: dur,
            delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: dur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    pulse(orb1, 5000, 0);
    pulse(orb2, 7000, 1500);
  }, []);
  const scale1 = orb1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const scale2 = orb2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });
  const op1 = orb1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.07, 0.13],
  });
  const op2 = orb2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.1],
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
      <LinearGradient
        colors={["rgba(191,90,242,0.04)", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Orb top-right */}
      <Animated.View
        style={{
          position: "absolute",
          top: -80,
          right: -60,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: C.primary,
          opacity: op1,
          transform: [{ scale: scale1 }],
        }}
      />
      {/* Orb bottom-left */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 120,
          left: -80,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: C.accent,
          opacity: op2,
          transform: [{ scale: scale2 }],
        }}
      />
    </View>
  );
});

// ── Glass surface ──────────────────────────────────────────────────────────────
const Glass = ({
  children,
  style,
  r = 24,
  blur = 48,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  r?: number;
  blur?: number;
}) => (
  <View
    style={[
      {
        borderRadius: r,
        overflow: "hidden",
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
      },
      style,
    ]}
  >
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    {/* Top specular highlight */}
    <View
      style={{
        position: "absolute",
        top: 0,
        left: r * 0.5,
        right: r * 0.5,
        height: 1,
        backgroundColor: C.borderTop,
        zIndex: 9,
      }}
    />
    {/* Left specular edge */}
    <View
      style={{
        position: "absolute",
        top: r * 0.5,
        left: 0,
        bottom: r * 0.5,
        width: 1,
        backgroundColor: "rgba(255,255,255,0.05)",
        zIndex: 9,
      }}
    />
    {children}
  </View>
);

// ── Storage bar ────────────────────────────────────────────────────────────────
const StorageBar = ({ used, total }: { used: number; total: number }) => {
  const width = Math.min((used / total) * 100, 100);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: width / 100,
      duration: 900,
      delay: 300,
      easing: EASE_OUT_EXPO,
      useNativeDriver: false,
    }).start();
  }, [width]);
  const animWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${width}%`],
  });
  return (
    <View
      style={s.barTrack}
      accessibilityLabel={`Storage: ${used} GB used of ${total} GB`}
      accessibilityRole="progressbar"
    >
      <Animated.View style={[s.barFill, { width: animWidth }]}>
        <LinearGradient
          colors={[C.primary, C.primaryMid, C.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Gloss overlay */}
        <LinearGradient
          colors={["rgba(255,255,255,0.25)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 3 }]}
        />
      </Animated.View>
    </View>
  );
};

// ── Progress ring ──────────────────────────────────────────────────────────────
const Ring = ({
  progress,
  size = 48,
  status,
}: {
  progress: number;
  size?: number;
  status: string;
}) => {
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
    if (status !== "paused") {
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 2200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spin.stopAnimation();
    }
  }, [status]);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
        transform: [{ scale }],
      }}
      accessibilityLabel={`Downloading: ${Math.round(progress * 100)}%`}
      accessibilityRole="progressbar"
    >
      {/* Track */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: C.accentDim,
        }}
      />
      {/* Spinning fill arc */}
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderTopColor: C.accent,
          borderRightColor: progress > 0.5 ? C.accent : "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: "transparent",
          transform: [{ rotate }],
        }}
      />
      <Ionicons
        name={status === "paused" ? "pause" : "arrow-down"}
        size={16}
        color={C.accent}
      />
    </Animated.View>
  );
};

// ── Skeleton row ──────────────────────────────────────────────────────────────
const SkeletonRow = () => {
  const tx = useShimmer();
  return (
    <View style={[s.trackRow, { paddingVertical: 12 }]}>
      <View
        style={[
          s.trackArt,
          { backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
        ]}
      >
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            transform: [{ translateX: tx }],
          }}
        >
          <LinearGradient
            colors={[C.shimmer1, C.shimmer2, C.shimmer3]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
      <View style={s.trackInfo}>
        <View
          style={{
            height: 14,
            width: "65%",
            backgroundColor: "rgba(255,255,255,0.07)",
            borderRadius: 7,
            marginBottom: 8,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              transform: [{ translateX: tx }],
            }}
          >
            <LinearGradient
              colors={[C.shimmer1, C.shimmer2, C.shimmer3]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>
        <View
          style={{
            height: 11,
            width: "40%",
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              transform: [{ translateX: tx }],
            }}
          >
            <LinearGradient
              colors={[C.shimmer1, C.shimmer2, C.shimmer3]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

// ── Pressable wrapper with spring scale ───────────────────────────────────────
const SpringPress = ({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: any;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () =>
    Animated.spring(scale, {
      toValue: 0.965,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  const release = () =>
    Animated.spring(scale, {
      toValue: 1,
      tension: 80,
      friction: 7,
      useNativeDriver: true,
    }).start();
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={press}
      onPressOut={release}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole || "button"}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Track row ─────────────────────────────────────────────────────────────────
const TrackRow = React.memo(
  ({
    track,
    onPlay,
    onRemove,
    index,
  }: {
    track: any;
    onPlay: (t: any) => void;
    onRemove: (id: string) => void;
    index: number;
  }) => {
    const entrance = useEntrance(index * 45);
    const trashScale = useRef(new Animated.Value(1)).current;
    const pressTrash = () =>
      Animated.sequence([
        Animated.timing(trashScale, {
          toValue: 0.78,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(trashScale, {
          toValue: 1,
          tension: 180,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start(() => onRemove(track.id));

    return (
      <Animated.View style={entrance}>
        <SpringPress
          onPress={() => onPlay(track)}
          style={s.trackRow}
          accessibilityLabel={`Play ${track.title} by ${track.artist}`}
          accessibilityRole="button"
        >
          <Image
            source={{ uri: track.art }}
            style={s.trackArt}
            contentFit="cover"
            transition={250}
          />
          <View style={s.trackInfo}>
            <Text style={s.trackTitle} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={s.trackArtist} numberOfLines={1}>
              {track.artist}
            </Text>
          </View>
          <TouchableOpacity
            onPress={pressTrash}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={`Remove ${track.title}`}
            accessibilityRole="button"
            style={{ padding: 10 }}
          >
            <Animated.View style={{ transform: [{ scale: trashScale }] }}>
              <Ionicons name="trash-outline" size={20} color={C.muted} />
            </Animated.View>
          </TouchableOpacity>
        </SpringPress>
      </Animated.View>
    );
  },
);

// ── Downloading row ───────────────────────────────────────────────────────────
const DownloadingRow = React.memo(
  ({
    task,
    onCancel,
    index,
  }: {
    task: any;
    onCancel: (id: string) => void;
    index: number;
  }) => {
    const entrance = useEntrance(index * 45);
    return (
      <Animated.View style={[s.dlRow, entrance]}>
        <Ring progress={task.progress} status={task.status} />
        <View style={s.dlInfo}>
          <Text style={s.dlTitle} numberOfLines={1}>
            {task.track.title}
          </Text>
          <Text style={s.dlArtist} numberOfLines={1}>
            {task.track.artist}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.pct}>{Math.round(task.progress * 100)}%</Text>
          <TouchableOpacity
            onPress={() => onCancel(task.track.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Cancel download of ${task.track.title}`}
            accessibilityRole="button"
          >
            <Text style={s.cancelBtn}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  },
);

// ── Album row ─────────────────────────────────────────────────────────────────
const AlbumRow = React.memo(
  ({
    album,
    onPress,
    index,
  }: {
    album: any;
    onPress: () => void;
    index: number;
  }) => {
    const entrance = useEntrance(index * 45);
    return (
      <Animated.View style={entrance}>
        <SpringPress
          onPress={onPress}
          style={s.trackRow}
          accessibilityLabel={`${album.title}, ${album.tracks.length} tracks`}
          accessibilityRole="button"
        >
          <Image
            source={{ uri: album.art }}
            style={s.trackArt}
            contentFit="cover"
            transition={250}
          />
          <View style={s.trackInfo}>
            <Text style={s.trackTitle} numberOfLines={1}>
              {album.title}
            </Text>
            <Text style={s.trackArtist} numberOfLines={1}>
              {album.tracks.length} tracks
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.dim} />
        </SpringPress>
      </Animated.View>
    );
  },
);

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = ({ message = "No downloads yet" }: { message?: string }) => {
  const entrance = useEntrance(100);
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  return (
    <Animated.View
      style={[{ padding: 48, alignItems: "center" }, entrance]}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={{ transform: [{ translateY: floatY }] }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "rgba(191,90,242,0.1)",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "rgba(191,90,242,0.2)",
            marginBottom: 16,
          }}
        >
          <Ionicons name="cloud-download-outline" size={36} color={C.primary} />
        </View>
      </Animated.View>
      <Text style={{ color: C.muted, fontSize: 15, fontWeight: "500" }}>
        {message}
      </Text>
    </Animated.View>
  );
};

// ── Storage card ──────────────────────────────────────────────────────────────
const StorageCard = ({ storage }: { storage: SInfo }) => {
  const entrance = useEntrance(60);
  const pct = Math.round((storage.usedGB / storage.totalGB) * 100);
  return (
    <Animated.View style={entrance}>
      <Glass style={s.storageCard} r={28}>
        <View style={s.storageInner}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: "rgba(191,90,242,0.18)",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 10,
              }}
            >
              <Ionicons name="server-outline" size={14} color={C.primary} />
            </View>
            <Text style={s.stLabel}>STORAGE</Text>
            <View style={{ flex: 1 }} />
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 20,
                backgroundColor:
                  pct > 80 ? "rgba(255,69,58,0.15)" : "rgba(70,245,224,0.12)",
                borderWidth: 1,
                borderColor:
                  pct > 80 ? "rgba(255,69,58,0.3)" : "rgba(70,245,224,0.25)",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: pct > 80 ? C.danger : C.accent,
                  letterSpacing: 0.5,
                }}
              >
                {pct}% used
              </Text>
            </View>
          </View>

          <View style={s.stRow}>
            <View>
              <Text style={s.stBig}>
                {storage.usedGB}
                <Text style={s.stUnit}>GB </Text>
                <Text style={s.stLight}>of {storage.totalGB}GB</Text>
              </Text>
              <Text style={s.stFree}>
                {storage.freeGB} GB free · {storage.songs} tracks
              </Text>
            </View>
          </View>
          <StorageBar used={storage.usedGB} total={storage.totalGB} />
        </View>
      </Glass>
    </Animated.View>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const storage = useStorage();
  const { setTrack } = useMusic();
  const [activeTab, setActiveTab] = useState("Songs");
  const [isLoading, setIsLoading] = useState(true);
  const tabs = ["Songs", "Albums", "Playlists", "Downloading"];

  const downloadedTracks = useDownloadStore((s) => s.downloadedTracks);
  const activeTasks = useDownloadStore((s) => s.activeTasks);
  const downloadQueue = useDownloadStore((s) => s.downloadQueue);

  // Simulate initial load skeleton
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const tracks = useMemo(
    () =>
      Object.values(downloadedTracks).sort(
        (a, b) => b.downloadedAt - a.downloadedAt,
      ),
    [downloadedTracks],
  );

  const albums = useMemo(() => {
    const map: Record<string, any> = {};
    tracks.forEach((t) => {
      const key = t.album || "Unknown";
      if (!map[key]) {
        map[key] = {
          id: key,
          title: key,
          artist: t.artist,
          art: t.art,
          tracks: [],
        };
      }
      map[key].tracks.push(t);
    });
    return Object.values(map);
  }, [tracks]);

  const downloading = useMemo(
    () =>
      Object.values(activeTasks).filter((t) =>
        downloadQueue.includes(t.track.id),
      ),
    [activeTasks, downloadQueue],
  );

  const handlePlay = useCallback(
    (track: any) => {
      setTrack({
        ...track,
        durationSec: track.durationSec || 0,
        dominantColors: track.dominantColors || [C.primary, C.primaryMid],
      } as any);
      router.push({ pathname: "/now_playing", params: { trackId: track.id } });
    },
    [setTrack, router],
  );

  const handleRemove = useCallback((trackId: string) => {
    DownloadManager.removeDownload(trackId);
  }, []);

  const handleCancel = useCallback((trackId: string) => {
    DownloadManager.cancelDownload(trackId);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      if (isLoading) return <SkeletonRow />;
      if (activeTab === "Songs")
        return (
          <TrackRow
            track={item}
            onPlay={handlePlay}
            onRemove={handleRemove}
            index={index}
          />
        );
      if (activeTab === "Albums")
        return (
          <AlbumRow
            album={item}
            onPress={() => handlePlay(item.tracks[0])}
            index={index}
          />
        );
      if (activeTab === "Downloading")
        return (
          <DownloadingRow task={item} onCancel={handleCancel} index={index} />
        );
      return null;
    },
    [activeTab, handlePlay, handleRemove, handleCancel, isLoading],
  );

  const listData = useMemo(() => {
    if (isLoading) return Array(6).fill({ _skeleton: true });
    if (activeTab === "Songs") return tracks;
    if (activeTab === "Albums") return albums;
    if (activeTab === "Downloading") return downloading;
    return [];
  }, [activeTab, tracks, albums, downloading, isLoading]);

  const headerEntrance = useEntrance(0);

  const emptyMessage =
    activeTab === "Downloading"
      ? "No active downloads"
      : activeTab === "Playlists"
        ? "No downloaded playlists"
        : `No ${activeTab.toLowerCase()} yet`;

  // Safe bottom for Android nav bar
  const safeBottom = insets.bottom + 16;

  return (
    <View style={s.root}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <AmbientBG />

      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item: any, i) =>
          item._skeleton
            ? `skel-${i}`
            : item.id || item.track?.id || `item-${i}`
        }
        ListHeaderComponent={
          <View style={[s.content, { paddingTop: insets.top + 12 }]}>
            {/* Header */}
            <Animated.View style={[s.header, headerEntrance]}>
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={22} color={C.primary} />
              </TouchableOpacity>
              <Text style={s.headerTitle} accessibilityRole="header">
                Downloads
              </Text>
              <View style={{ width: 44 }} />
            </Animated.View>

            {/* Storage card */}
            <StorageCard storage={storage} />

            {/* Category tabs */}
            <Animated.View style={useEntrance(80)}>
              <CategoryTabs
                categories={tabs}
                activeCategory={activeTab}
                onCategoryChange={setActiveTab}
                style={{ marginBottom: 20 }}
              />
            </Animated.View>

            {/* Section title + count */}
            <Animated.View
              style={[
                {
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                },
                useEntrance(100),
              ]}
            >
              <Text style={s.secTitle}>{activeTab}</Text>
              {!isLoading && listData.length > 0 && (
                <View
                  style={{
                    marginLeft: 10,
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    borderRadius: 12,
                    backgroundColor: "rgba(191,90,242,0.14)",
                    borderWidth: 1,
                    borderColor: "rgba(191,90,242,0.22)",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: C.primary,
                    }}
                  >
                    {listData.length}
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? <EmptyState message={emptyMessage} /> : null
        }
        contentContainerStyle={{ paddingBottom: 200 + safeBottom }}
        showsVerticalScrollIndicator={false}
      />

      <MiniPlayer />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  headerTitle: {
    fontSize: HEADER_FONT,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.8,
  },
  content: { paddingHorizontal: PAD },
  storageCard: { marginBottom: 28 },
  storageInner: { padding: 20 },
  stLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 1.2,
  },
  stRow: { marginBottom: 14 },
  stBig: {
    fontSize: 24,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.5,
  },
  stUnit: { fontSize: 18 },
  stLight: {
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
    fontSize: 17,
  },
  stFree: { fontSize: 13, color: C.muted, marginTop: 4 },
  barTrack: {
    height: 7,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 4,
  },
  barFill: { height: "100%", borderRadius: 4, overflow: "hidden" },
  secTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  // Downloading row
  dlRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: PAD,
    gap: 14,
  },
  dlInfo: { flex: 1 },
  dlTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  dlArtist: { fontSize: 12, color: C.muted },
  pct: {
    fontSize: 14,
    fontWeight: "800",
    color: C.accent,
    letterSpacing: -0.3,
  },
  cancelBtn: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    marginTop: 5,
    letterSpacing: 0.8,
  },
  // Track / Album row
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 9,
    paddingHorizontal: PAD,
    minHeight: 72,
  },
  trackArt: {
    width: TRACK_ART_SIZE,
    height: TRACK_ART_SIZE,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  trackArtist: { fontSize: 13, color: C.muted },
});
