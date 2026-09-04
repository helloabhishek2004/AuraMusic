/**
 * SettingsScreen — visually matches page.html exactly
 *
 * ✦ Animated drifting liquid blobs (3 orbs, Reanimated UI-thread)
 * ✦ Glass-card backdrop: rgba(53,52,58,0.2) + blur + border
 * ✦ Staggered fadeInUp entrance per section (matches .animate-stagger)
 * ✦ Spring-bounce toggle switches
 * ✦ Circular SVG storage ring with animated fill
 * ✦ All original functionality untouched
 * ✦ Accent colour section removed
 */

import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  interpolateColor,
  interpolate,
  useAnimatedProps,
  runOnJS,
  Easing as ReanimatedEasing,
} from "react-native-reanimated";

import { useSettingsStore, AudioQuality } from "../../src/features/settings/store/settings.store";
import { CacheManager, StorageStats } from "../../src/features/cache/services/cache-manager.service";
import { useDownloadStore } from "../../src/features/download/store/download.store";
import { AudioSessionController } from "../../src/features/audio/native/audio-session";
import { downloadCleanupService } from "../../src/features/download/services/download-cleanup.service";
import { useScrollToTopOnTabPress } from "../../src/hooks/use-scroll-to-top";

const { width: SW } = Dimensions.get("window");

// ── Palette (matches HTML exactly) ───────────────────────────────────────────
const PRIMARY = "#BF5AF2";  // purple toggle / ring slice 1
const SECONDARY = "#46f5e0";  // aqua / ring slice 2
const BG = "#0F0F13";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT LIQUID BACKGROUND  (3 drifting blobs, Reanimated UI-thread)
// Matches: .liquid-blob blob-1/2/3 move-liquid @keyframes
// ─────────────────────────────────────────────────────────────────────────────
const AmbientBackground = () => {
  const x1 = useSharedValue(0), y1 = useSharedValue(0);
  const x2 = useSharedValue(0), y2 = useSharedValue(0);
  const x3 = useSharedValue(0), y3 = useSharedValue(0);

  useEffect(() => {
    const ease = ReanimatedEasing.inOut(ReanimatedEasing.ease);
    x1.value = withRepeat(withTiming(SW * 0.15, { duration: 25000, easing: ease }), -1, true);
    y1.value = withRepeat(withTiming(SW * 0.12, { duration: 28000, easing: ease }), -1, true);
    x2.value = withRepeat(withTiming(-SW * 0.12, { duration: 30000, easing: ease }), -1, true);
    y2.value = withRepeat(withTiming(-SW * 0.10, { duration: 32000, easing: ease }), -1, true);
    x3.value = withRepeat(withTiming(SW * 0.10, { duration: 35000, easing: ease }), -1, true);
    y3.value = withRepeat(withTiming(-SW * 0.10, { duration: 40000, easing: ease }), -1, true);
  }, []);

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateX: x1.value }, { translateY: y1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateX: x2.value }, { translateY: y2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateX: x3.value }, { translateY: y3.value }] }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BG }]} />
      {/* blob-1 purple top-left */}
      <Animated.View style={[st.blob, { backgroundColor: "#6c37a9", top: -SW * 0.3, left: -SW * 0.2, width: SW * 1.3, height: SW * 1.3, borderRadius: SW * 0.65, opacity: 0.18 }, s1]} />
      {/* blob-2 indigo bottom-right */}
      <Animated.View style={[st.blob, { backgroundColor: "#4622c0", bottom: -SW * 0.3, right: -SW * 0.2, width: SW * 1.3, height: SW * 1.3, borderRadius: SW * 0.65, opacity: 0.18 }, s2]} />
      {/* blob-3 teal mid */}
      <Animated.View style={[st.blob, { backgroundColor: "#005950", top: SW * 0.5, left: SW * 0.1, width: SW * 1.1, height: SW * 1.1, borderRadius: SW * 0.55, opacity: 0.08 }, s3]} />
      {/* Atmospheric overlay — blur on iOS, dark tint on Android */}
      {Platform.OS === "ios"
        ? <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,15,19,0.87)" }]} />}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GLASS CARD  (matches .glass-card in HTML)
// rgba(53,52,58,0.20) bg · blur(24px) · 1px rgba(255,255,255,0.08) border · r=32
// ─────────────────────────────────────────────────────────────────────────────
const GlassCard = React.memo(({ children, style, r = 32, frosted = false }: {
  children: React.ReactNode; style?: any; r?: number; frosted?: boolean;
}) => (
  <View style={[{ borderRadius: r, overflow: "hidden" }, style]}>
    {Platform.OS === "ios"
      ? <BlurView intensity={frosted ? 68 : 24} tint="dark" style={StyleSheet.absoluteFill} />
      : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: frosted ? "rgba(24,24,30,0.96)" : "rgba(53,52,58,0.92)" }]} />}
    {/* Subtle top specular */}
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: r * 0.4, right: r * 0.4, height: 1.5, backgroundColor: "rgba(255,255,255,0.12)", zIndex: 9 }} />
    {/* Border ring */}
    <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
    {/* Inner sheen */}
    <LinearGradient colors={["rgba(255,255,255,0.07)", "rgba(255,255,255,0.02)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
    {children}
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// STAGGERED SECTION  (matches .animate-stagger > *:nth-child(n))
// fadeInUp 0.8s cubic-bezier(0.2,1,0.3,1) forwards with per-index delay
// ─────────────────────────────────────────────────────────────────────────────
const Section = React.memo(({ children, index }: { children: React.ReactNode; index: number }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    const delay = 100 + index * 100;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 800, easing: ReanimatedEasing.bezier(0.2, 1, 0.3, 1) })
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 800, easing: ReanimatedEasing.bezier(0.2, 1, 0.3, 1) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER LABEL
// ─────────────────────────────────────────────────────────────────────────────
const SectionLabel = React.memo(({ icon, title }: { icon: string; title: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 36, marginBottom: 12, paddingLeft: 4, opacity: 0.6 }}>
    <MaterialIcons name={icon as any} size={14} color="rgba(255,255,255,0.9)" />
    <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 2.0, color: "#FFFFFF", textTransform: "uppercase" }}>
      {title}
    </Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// SPRING TOGGLE  (matches .custom-toggle / .custom-toggle.active)
// cubic-bezier(0.175,0.885,0.32,1.275) bounce
// ─────────────────────────────────────────────────────────────────────────────
const Toggle = React.memo(({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => {
  const anim = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    anim.value = withSpring(value ? 1 : 0, {
      damping: 15,
      stiffness: 150,
      mass: 0.8,
    });
  }, [value]);

  const animatedTrackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      anim.value,
      [0, 1],
      ["rgba(255,255,255,0.10)", PRIMARY]
    );
    return { backgroundColor };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    const translateX = interpolate(anim.value, [0, 1], [2, 26]);
    const scale = interpolate(anim.value, [0, 0.5, 1], [1, 0.88, 1]);
    return {
      transform: [{ translateX }, { scale }],
    };
  });

  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(!value); }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={[st.toggleTrack, animatedTrackStyle]}>
        <Animated.View style={[st.toggleThumb, animatedThumbStyle]} />
      </Animated.View>
    </Pressable>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER  (divide-y divide-white/5)
// ─────────────────────────────────────────────────────────────────────────────
const Divider = React.memo(() => <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginHorizontal: 0 }} />);

// ─────────────────────────────────────────────────────────────────────────────
// ROW  (p-6 flex items-center justify-between hover:bg-white/[0.03])
// ─────────────────────────────────────────────────────────────────────────────
const Row = React.memo(({
  icon, iconColor, iconBg, label, sub, right, onPress, chevron = false,
}: {
  icon: string; iconColor: string; iconBg: string;
  label: string; sub?: string; right?: React.ReactNode;
  onPress?: () => void; chevron?: boolean;
}) => {
  const Inner = (
    <View style={st.rowInner}>
      <View style={st.rowLeft}>
        <View style={[st.iconBadge, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.rowLabel}>{label}</Text>
          {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {right}
        {chevron && <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.28)" />}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.7} delayPressIn={0} style={st.row}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return <View style={st.row}>{Inner}</View>;
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM SELECT BUTTON  (mimics <select> from HTML)
// ─────────────────────────────────────────────────────────────────────────────
const SelectBtn = React.memo(({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity
    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
    activeOpacity={0.7}
    delayPressIn={0}
    style={st.selectBtn}
  >
    <Text style={st.selectTxt}>{label}</Text>
    <MaterialIcons name="keyboard-arrow-down" size={20} color="rgba(255,255,255,0.40)" />
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY MODAL  (bottom-sheet, spring slide-up)
// ─────────────────────────────────────────────────────────────────────────────
const QualityModal = React.memo(({ visible, onClose, title, selectedOption, onSelect }: {
  visible: boolean; onClose: () => void; title: string;
  selectedOption: AudioQuality; onSelect: (q: AudioQuality) => void;
}) => {
  const [rendered, setRendered] = useState(visible);
  const slideY = useSharedValue(550);
  const overlayOp = useSharedValue(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dy > 0) {
          slideY.value = gestureState.dy;
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.4) {
          overlayOp.value = withTiming(0, { duration: 150 });
          slideY.value = withTiming(550, { duration: 180 }, () => {
            runOnJS(onClose)();
          });
        } else {
          slideY.value = withSpring(0, { damping: 24, stiffness: 280 });
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      overlayOp.value = withTiming(1, { duration: 180 });
      slideY.value = withSpring(0, { damping: 24, stiffness: 280 });
    } else {
      overlayOp.value = withTiming(0, { duration: 150 });
      slideY.value = withTiming(550, { duration: 180 }, () => {
        runOnJS(setRendered)(false);
      });
    }
  }, [visible]);

  const OPTIONS: { label: string; value: AudioQuality; sub: string; icon: string }[] = [
    { label: "Low", value: "low", sub: "96 kbps · Data saver", icon: "speed" },
    { label: "Normal", value: "normal", sub: "128 kbps · Balanced", icon: "graphic-eq" },
    { label: "High", value: "high", sub: "160 kbps · Great quality", icon: "high-quality" },
    { label: "Best", value: "best", sub: "320 kbps / Lossless · Premium", icon: "workspace-premium" },
  ];

  const overlayStyle = useAnimatedStyle(() => ({
    backgroundColor: "rgba(0,0,0,0.65)",
    opacity: overlayOp.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
    paddingHorizontal: 14,
    paddingBottom: 14,
  }));

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: "flex-end", pointerEvents: "box-none" }}>
        <Animated.View
          style={sheetStyle}
          {...panResponder.panHandlers}
        >
          <GlassCard r={32} frosted>
            {/* Handle */}
            <View style={{ alignItems: "center", paddingTop: 14, paddingBottom: 2 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: `${PRIMARY}50` }} />
            </View>
            <Text style={st.modalTitle}>{title}</Text>
            {OPTIONS.map((opt, i) => {
              const sel = selectedOption === opt.value;
              return (
                <React.Fragment key={opt.value}>
                  {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 20 }} />}
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect(opt.value); onClose(); }}
                    style={[st.modalOpt, sel && { backgroundColor: `${PRIMARY}12` }]}
                    activeOpacity={0.7}
                    delayPressIn={0}
                  >
                    <View style={[st.modalOptIcon, { backgroundColor: sel ? `${PRIMARY}22` : "rgba(255,255,255,0.06)", borderColor: sel ? `${PRIMARY}40` : "rgba(255,255,255,0.08)" }]}>
                      <MaterialIcons name={opt.icon as any} size={18} color={sel ? PRIMARY : "rgba(170,170,185,0.65)"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.modalOptLabel, sel && { color: PRIMARY, fontWeight: "700" }]}>{opt.label}</Text>
                      <Text style={st.modalOptSub}>{opt.sub}</Text>
                    </View>
                    {sel && (
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark" size={13} color="#000" />
                      </View>
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </GlassCard>
        </Animated.View>
      </View>
    </Modal>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CACHE LIMIT PILLS  (2 GB / 5 GB / 10 GB / ∞)
// ─────────────────────────────────────────────────────────────────────────────
const CachePills = React.memo(({ current, onSelect }: { current: number | "unlimited"; onSelect: (v: number | "unlimited") => void }) => (
  <View style={{ flexDirection: "row", gap: 8 }}>
    {([2, 5, 10, "unlimited"] as const).map(v => {
      const active = current === v;
      return (
        <TouchableOpacity
          key={v}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(v); }}
          activeOpacity={0.7}
          delayPressIn={0}
          style={[st.pill, {
            backgroundColor: active ? `${PRIMARY}33` : "rgba(255,255,255,0.05)",
            borderColor: active ? `${PRIMARY}55` : "rgba(255,255,255,0.06)",
            transform: [{ scale: active ? 1.05 : 1.0 }],
          }]}
        >
          <Text style={[st.pillTxt, { color: active ? PRIMARY : "#FFFFFF" }]}>{v === "unlimited" ? "∞" : `${v} GB`}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  
  // Settings selectors
  const toggleSetting = useSettingsStore(s => s.toggleSetting);
  const normalizeVolume = useSettingsStore(s => s.normalizeVolume);
  const autoplayEnabled = useSettingsStore(s => s.autoplayEnabled);
  const smartShuffleEnabled = useSettingsStore(s => s.smartShuffleEnabled);
  const streamingQualityWifi = useSettingsStore(s => s.streamingQualityWifi);
  const streamingQualityCellular = useSettingsStore(s => s.streamingQualityCellular);
  const downloadQualityWifi = useSettingsStore(s => s.downloadQualityWifi);
  const downloadQualityCellular = useSettingsStore(s => s.downloadQualityCellular);
  const downloadOnlyOnWifi = useSettingsStore(s => s.downloadOnlyOnWifi);
  const autoDownloadLikedSongs = useSettingsStore(s => s.autoDownloadLikedSongs);
  const maxSongCacheGB = useSettingsStore(s => s.maxSongCacheGB);
  const setMaxSongCache = useSettingsStore(s => s.setMaxSongCache);
  const setStreamingQuality = useSettingsStore(s => s.setStreamingQuality);
  const setDownloadQuality = useSettingsStore(s => s.setDownloadQuality);

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnTabPress(scrollRef);
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);

  // Cloud Sync selector
  const googleSyncEnabled = useSettingsStore(s => s.googleSyncEnabled);

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [modalType, setModalType] = useState<null | "streamingWifi" | "streamingCellular" | "downloadWifi" | "downloadCellular">(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshStats = async () => {
    const stats = await CacheManager.getCacheStats();
    setStorageStats(stats);
  };

  useEffect(() => { refreshStats(); }, []);

  useFocusEffect(
    useCallback(() => {
      refreshStats();
    }, [])
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return "< 1 MB";
    if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const downloadCount = useMemo(() => Object.keys(downloadedTracks).length, [downloadedTracks]);

  const handleClearCache = () => {
    Alert.alert("Clear Cache", "Clear the song cache? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: "destructive",
        onPress: async () => {
          setIsClearing(true);
          try {
            await CacheManager.clearSongCache();
            await CacheManager.clearArtworkCache();
            await CacheManager.clearLyricsCache();
            await refreshStats();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } finally { setIsClearing(false); }
        },
      },
    ]);
  };

  const handleClearDownloads = () => {
    Alert.alert("Clear Downloads", `Delete all ${downloadCount} downloaded songs? Still playable online.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All", style: "destructive",
        onPress: async () => {
          setIsClearing(true);
          try {
            const res = await downloadCleanupService.clearAllDownloads();
            if (res.success) { await refreshStats(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
          } finally { setIsClearing(false); }
        },
      },
    ]);
  };

  const handleOpenEQ = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { AuraPlayer } = require("../../src/services/native-core");
      let launched = false;
      if (AuraPlayer && typeof AuraPlayer.openSystemEqualizer === "function") {
        launched = await AuraPlayer.openSystemEqualizer();
      }
      if (!launched) {
        Alert.alert(
          "Equalizer Unavailable",
          "No system equalizer or audio effects panel was found on this device."
        );
      }
    } catch {
      Alert.alert(
        "Equalizer Unavailable",
        "Could not launch the system equalizer on this device."
      );
    }
  };

  // Quality label helpers
  const getQualityLabel = (type: string, val: AudioQuality) => {
    if (type === "streamingWifi") {
      if (val === "low") return "Normal (96kbps)";
      if (val === "normal") return "High (160kbps)";
      if (val === "high") return "Very High (320kbps)";
      return "Automatic";
    }
    if (type === "streamingCellular") {
      if (val === "low") return "Data Saver";
      if (val === "normal") return "Normal (96kbps)";
      if (val === "high") return "High (160kbps)";
      return "Automatic";
    }
    if (val === "low") return "Normal (96kbps)";
    if (val === "normal") return "High (160kbps)";
    if (val === "high") return "Very High (320kbps)";
    return "Best (Lossless)";
  };

  // ── Storage ring maths ─────────────────────────────────────────────────────
  const RADIUS = 88, STROKE_W = 12;
  const CIRC = 2 * Math.PI * RADIUS; // 552.92

  const maxBytes = maxSongCacheGB === "unlimited"
    ? 20 * 1024 * 1024 * 1024
    : (maxSongCacheGB as number) * 1024 * 1024 * 1024;

  const dlBytes = storageStats?.downloads ?? 0;
  const cacheBytes = storageStats?.songCache ?? 0;
  const totalBytes = dlBytes + cacheBytes;
  const usedPct = Math.min(100, Math.round((totalBytes / maxBytes) * 100)) || 0;

  let dlFill = (dlBytes / maxBytes) * CIRC;
  let cacheFill = (cacheBytes / maxBytes) * CIRC;
  if (dlFill + cacheFill > CIRC) {
    const s = CIRC / (dlFill + cacheFill);
    dlFill *= s; cacheFill *= s;
  }

  const dlFillSV = useSharedValue(0);
  const cacheFillSV = useSharedValue(0);

  useEffect(() => {
    dlFillSV.value = withTiming(dlFill, { duration: 800, easing: ReanimatedEasing.out(ReanimatedEasing.ease) });
    cacheFillSV.value = withTiming(cacheFill, { duration: 800, easing: ReanimatedEasing.out(ReanimatedEasing.ease) });
  }, [dlFill, cacheFill]);

  const dlCircleProps = useAnimatedProps(() => ({
    strokeDasharray: `${dlFillSV.value} ${CIRC}`,
  }));

  const cacheCircleProps = useAnimatedProps(() => ({
    strokeDasharray: `${cacheFillSV.value} ${CIRC}`,
    strokeDashoffset: -dlFillSV.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── AMBIENT BACKGROUND ───────────────────────────────────────────── */}
      <AmbientBackground />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[st.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 6, marginBottom: 8 }}>
          <Text style={st.headerTitle}>Settings</Text>
          <Text style={st.headerSub}>Personalise your listening experience</Text>
        </View>

        {/* ── STORAGE USAGE (section 1) ────────────────────────────────────── */}
        <Section index={0}>
          <SectionLabel icon="storage" title="Storage Usage" />
          <GlassCard r={32}>
            {/* Glowy internal blobs (matches group hover glows) */}
            <View style={{ position: "absolute", top: 0, right: 0, width: 128, height: 128, backgroundColor: "#a855f7", opacity: 0.14, borderRadius: 64, transform: [{ translateX: 40 }, { translateY: -40 }] }} pointerEvents="none" />
            <View style={{ position: "absolute", bottom: 0, left: 0, width: 128, height: 128, backgroundColor: "#22d3ee", opacity: 0.12, borderRadius: 64, transform: [{ translateX: -40 }, { translateY: 40 }] }} pointerEvents="none" />

            <View style={{ alignItems: "center", padding: 28 }}>
              {/* SVG circular ring */}
              <View style={{ width: 192, height: 192, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                <Svg width={192} height={192} style={{ transform: [{ rotate: "-90deg" }] }}>
                  <Circle cx="96" cy="96" r={RADIUS} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth={STROKE_W} />
                  <AnimatedCircle cx="96" cy="96" r={RADIUS} fill="transparent" stroke={PRIMARY} strokeWidth={STROKE_W}
                    animatedProps={dlCircleProps} strokeLinecap="round" />
                  <AnimatedCircle cx="96" cy="96" r={RADIUS} fill="transparent" stroke={SECONDARY} strokeWidth={STROKE_W}
                    animatedProps={cacheCircleProps} strokeLinecap="round" />
                </Svg>
                {/* Centre text */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 32, fontWeight: "900", color: "#FFF" }}>{usedPct}%</Text>
                    <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", textTransform: "uppercase", letterSpacing: 2 }}>Used</Text>
                  </View>
                </View>
              </View>

              {/* Legend */}
              <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-around", marginBottom: 24 }}>
                <View style={{ alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY }} />
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: 0.5 }}>Downloads</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#FFF" }}>{formatSize(dlBytes)}</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SECONDARY }} />
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: 0.5 }}>Cache</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#FFF" }}>{formatSize(cacheBytes)}</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
                <TouchableOpacity onPress={handleClearCache} activeOpacity={0.7} delayPressIn={0}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFF" }}>Clear Cache</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClearDownloads} activeOpacity={0.7} delayPressIn={0}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.18)", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#f87171" }}>Clear Downloads</Text>
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        </Section>

        {/* ── PLAYBACK (section 2) ─────────────────────────────────────────── */}
        <Section index={1}>
          <SectionLabel icon="music-note" title="Playback" />
          <GlassCard r={32} style={{ overflow: "hidden" }}>
            {/* Normalize */}
            <Row
              icon="volume-up" iconColor="#F9A8D4" iconBg="rgba(236,72,153,0.10)"
              label="Normalize Volume" sub="Keeps tracks at a consistent perceived volume"
              right={<Toggle value={normalizeVolume} onChange={() => toggleSetting("normalizeVolume")} />}
            />
            <Divider />
            {/* Equalizer */}
            <Row
              icon="equalizer" iconColor="#FDE047" iconBg="rgba(234,179,8,0.10)"
              label="Equalizer"
              sub="Open device equalizer"
              onPress={handleOpenEQ} chevron
            />
            <Divider />
            {/* Autoplay Radio */}
            <Row
              icon="radio" iconColor="#34D399" iconBg="rgba(52,211,153,0.10)"
              label="Autoplay Radio" sub="Continuation mix when queue ends"
              right={<Toggle value={autoplayEnabled} onChange={() => toggleSetting("autoplayEnabled")} />}
            />
            <Divider />
            {/* Smart Shuffle */}
            <Row
              icon="shuffle" iconColor="#60A5FA" iconBg="rgba(96,165,250,0.10)"
              label="Smart Shuffle" sub="Weighted smart track shuffle"
              right={<Toggle value={smartShuffleEnabled} onChange={() => toggleSetting("smartShuffleEnabled")} />}
            />
          </GlassCard>
        </Section>

        {/* ── AUDIO QUALITY (section 3) ────────────────────────────────────── */}
        <Section index={2}>
          <SectionLabel icon="high-quality" title="Audio Quality" />
          <View style={{ gap: 16 }}>
            {[
              { key: "streamingWifi", icon: "wifi", iconColor: "#22d3ee", title: "Wi-Fi Streaming", val: streamingQualityWifi },
              { key: "streamingCellular", icon: "signal-cellular-alt", iconColor: "#c084fc", title: "Cellular Streaming", val: streamingQualityCellular },
              { key: "downloadWifi", icon: "downloading", iconColor: "#22d3ee", title: "Download • Wi-Fi", val: downloadQualityWifi },
              { key: "downloadCellular", icon: "downloading", iconColor: "#c084fc", title: "Download • Cellular", val: downloadQualityCellular },
            ].map(item => (
              <GlassCard key={item.key} r={24} style={{ padding: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <MaterialIcons name={item.icon as any} size={20} color={item.iconColor} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFF" }}>{item.title}</Text>
                </View>
                <SelectBtn
                  label={getQualityLabel(item.key, item.val)}
                  onPress={() => setModalType(item.key as any)}
                />
              </GlassCard>
            ))}
          </View>
        </Section>

        {/* ── DOWNLOADS (section 4) ────────────────────────────────────────── */}
        <Section index={3}>
          <SectionLabel icon="download" title="Downloads" />
          <GlassCard r={32} style={{ overflow: "hidden" }}>
            {/* Wi-Fi only */}
            <View style={st.row}>
              <View style={st.rowInner}>
                <View style={st.rowLeft}>
                  <View>
                    <Text style={st.rowLabel}>Wi-Fi Only</Text>
                    <Text style={st.rowSub}>Avoid cellular data for downloads</Text>
                  </View>
                </View>
                <Toggle value={downloadOnlyOnWifi} onChange={() => toggleSetting("downloadOnlyOnWifi")} />
              </View>
            </View>
            <Divider />
            {/* Auto-download liked */}
            <View style={st.row}>
              <View style={st.rowInner}>
                <View style={st.rowLeft}>
                  <View>
                    <Text style={st.rowLabel}>Auto-download Liked</Text>
                    <Text style={st.rowSub}>Save new favorites automatically</Text>
                  </View>
                </View>
                <Toggle value={autoDownloadLikedSongs} onChange={() => toggleSetting("autoDownloadLikedSongs")} />
              </View>
            </View>
            <Divider />
            {/* Cache limit pills */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.40)", letterSpacing: 2.0, marginBottom: 12, textTransform: "uppercase" }}>
                Max Song Cache
              </Text>
              <CachePills current={maxSongCacheGB} onSelect={setMaxSongCache} />
            </View>
          </GlassCard>
        </Section>

        {/* ── GOOGLE CLOUD BACKUP & SYNC (section 4) ─────────────────────────── */}
        <Section index={4}>
          <SectionLabel icon="cloud-sync" title="Google Account Backup & Restore" />
          <GlassCard r={32} style={{ overflow: "hidden" }}>
            {/* Google Sync Master Toggle */}
            <Row
              icon="backup" iconColor="#60A5FA" iconBg="rgba(96,165,250,0.10)"
              label="Google Cloud Backup" sub="Sync library, playlists & favorites automatically"
              right={<Toggle value={googleSyncEnabled} onChange={() => toggleSetting("googleSyncEnabled")} />}
            />
            <Divider />

            {/* Scope description */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <MaterialIcons name={googleSyncEnabled ? "check-circle" : "pause-circle"} size={16} color={googleSyncEnabled ? "#34D399" : "#F87171"} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: googleSyncEnabled ? "#34D399" : "#F87171" }}>
                  {googleSyncEnabled ? "Backup Active (Encrypted Google Drive)" : "Cloud Backup Disabled"}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 16 }}>
                {googleSyncEnabled
                  ? "Your playlists, liked songs, listening history, and preferences are safely preserved. Audio files and caches are never backed up (< 1 MB quota)."
                  : "Automatic backup to your Google Account is paused. Your data will remain on this device only."}
              </Text>
            </View>

            {googleSyncEnabled && (
              <>
                <Divider />
                {/* Manual Sync Now */}
                <TouchableOpacity
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setIsSyncing(true);
                    try {
                      const { AuraRestore } = await import("@/src/services/native-core");
                      if (AuraRestore && typeof AuraRestore.triggerCloudSync === "function") {
                        await AuraRestore.triggerCloudSync();
                      }
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert(
                        "Backup Checkpoint Complete",
                        "Your library, playlists, and preferences have been committed and scheduled for Google Cloud Backup."
                      );
                    } catch (e: any) {
                      Alert.alert("Backup Notice", e?.message || "Failed to notify backup service.");
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  style={st.row}
                  disabled={isSyncing}
                >
                  <View style={st.rowInner}>
                    <View style={st.rowLeft}>
                      <View style={[st.iconBadge, { backgroundColor: "rgba(96,165,250,0.10)" }]}>
                        {isSyncing ? (
                          <ActivityIndicator size="small" color="#60A5FA" />
                        ) : (
                          <MaterialIcons name="sync" size={20} color="#60A5FA" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.rowLabel}>Back Up Now</Text>
                        <Text style={st.rowSub}>Commit pending data to Google Backup</Text>
                      </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.28)" />
                  </View>
                </TouchableOpacity>
              </>
            )}
          </GlassCard>
        </Section>

        {/* ── SUPPORT & ABOUT (section 5) ──────────────────────────────────── */}
        <Section index={5}>
          <SectionLabel icon="info" title="Support & About" />
          <GlassCard r={32} style={{ overflow: "hidden" }}>
            {/* FAQ */}
            <TouchableOpacity
              onPress={() => Alert.alert("FAQ", "Frequently Asked Questions coming soon.")}
              activeOpacity={0.7}
              delayPressIn={0}
              style={st.row}
            >
              <View style={st.rowInner}>
                <View style={st.rowLeft}>
                  <View style={[st.iconBadge, { backgroundColor: "rgba(148,163,184,0.10)" }]}>
                    <MaterialIcons name="help" size={20} color="#cbc3d9" />
                  </View>
                  <Text style={st.rowLabel}>Frequently Asked Questions</Text>
                </View>
                <MaterialIcons name="open-in-new" size={18} color="rgba(255,255,255,0.28)" />
              </View>
            </TouchableOpacity>
            <Divider />
            {/* Privacy Policy */}
            <TouchableOpacity
              onPress={() => Alert.alert("Privacy Policy", "AuraMusic Privacy Policy coming soon.")}
              activeOpacity={0.7}
              delayPressIn={0}
              style={st.row}
            >
              <View style={st.rowInner}>
                <View style={st.rowLeft}>
                  <View style={[st.iconBadge, { backgroundColor: "rgba(148,163,184,0.10)" }]}>
                    <MaterialIcons name="verified-user" size={20} color="#cbc3d9" />
                  </View>
                  <Text style={st.rowLabel}>Privacy Policy</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.28)" />
              </View>
            </TouchableOpacity>
            <Divider />
            {/* Branding footer — matches HTML section exactly */}
            <View style={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 20 }}>
              <LinearGradient
                colors={["#a855f7", "#22d3ee"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12, shadowColor: "#22d3ee", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
              >
                <MaterialIcons name="blur-on" size={38} color="#FFF" />
              </LinearGradient>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#FFF", letterSpacing: -0.5, marginBottom: 4 }}>Aura Music</Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>Version 1.4.2 • Build 2024.05</Text>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontStyle: "italic", marginTop: 14 }}>Made with ❤️ for music lovers</Text>
            </View>
          </GlassCard>
        </Section>

      </ScrollView>

      {/* QUALITY MODAL */}
      <QualityModal
        visible={!!modalType}
        onClose={() => setModalType(null)}
        title={
          modalType === "streamingWifi" ? "Streaming · Wi-Fi" :
            modalType === "streamingCellular" ? "Streaming · Cellular" :
              modalType === "downloadWifi" ? "Download · Wi-Fi" : "Download · Cellular"
        }
        selectedOption={
          modalType === "streamingWifi" ? streamingQualityWifi :
            modalType === "streamingCellular" ? streamingQualityCellular :
              modalType === "downloadWifi" ? downloadQualityWifi : downloadQualityCellular
        }
        onSelect={(q) => {
          if (modalType === "streamingWifi") setStreamingQuality("wifi", q);
          else if (modalType === "streamingCellular") setStreamingQuality("cellular", q);
          else if (modalType === "downloadWifi") setDownloadQuality("wifi", q);
          else setDownloadQuality("cellular", q);
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  blob: { position: "absolute" },

  scroll: { paddingHorizontal: 16 },

  // Header
  headerTitle: { fontSize: 32, fontWeight: "900", color: "#FFF", letterSpacing: -1.0, lineHeight: 38 },
  headerSub: { fontSize: 13, color: "rgba(170,170,185,0.55)", marginTop: 4, fontWeight: "500" },

  // Row
  row: { paddingVertical: 2 },
  rowInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 20 },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 14 },
  rowLabel: { fontSize: 15, fontWeight: "700", color: "#FFF", letterSpacing: -0.1 },
  rowSub: { fontSize: 12, color: "rgba(170,170,185,0.50)", marginTop: 2 },
  iconBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  // Toggle
  toggleTrack: { width: 48, height: 24, borderRadius: 12, justifyContent: "center", paddingHorizontal: 2 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFF", shadowColor: "#000", shadowOpacity: 0.20, shadowRadius: 3, shadowOffset: { width: 0, height: 1.5 }, elevation: 2 },

  // Slider
  sliderThumb: { position: "absolute", top: -8, width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFF", borderWidth: 2.5, marginLeft: -10, shadowOpacity: 0.65, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 6, zIndex: 10 },

  // Pills
  pill: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pillTxt: { fontSize: 12, fontWeight: "800" },

  // Select
  selectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(14,14,19,0.40)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13 },
  selectTxt: { fontSize: 13, color: "rgba(255,255,255,0.95)", fontWeight: "500" },

  // Modal
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#FFF", textAlign: "center", paddingTop: 4, paddingBottom: 14, letterSpacing: -0.3 },
  modalOpt: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15 },
  modalOptIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 14, borderWidth: 0.75 },
  modalOptLabel: { fontSize: 15, fontWeight: "500", color: "#FFF" },
  modalOptSub: { fontSize: 12, color: "rgba(170,170,185,0.65)", marginTop: 2 },
  modalDismiss: { margin: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", borderWidth: 0.75, borderColor: "rgba(255,255,255,0.08)" },
  modalDismissText: { color: "rgba(170,170,185,0.65)", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
});