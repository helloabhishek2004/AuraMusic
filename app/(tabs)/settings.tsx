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
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated as RNAnimated,
  Dimensions,
  Easing as RNEasing,
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
  Easing as ReanimatedEasing,
} from "react-native-reanimated";

import { useSettingsStore, AudioQuality } from "../../src/features/settings/store/settings.store";
import { CacheManager, StorageStats } from "../../src/features/cache/services/cache-manager.service";
import { useDownloadStore } from "../../src/features/download/store/download.store";
import { AudioSessionController } from "../../src/features/audio/native/audio-session";
import { downloadCleanupService } from "../../src/features/download/services/download-cleanup.service";
import { useAnalyticsStore, getRecentHistory, getTopArtists, getTopAlbums, getTopTracks } from "../../src/features/analytics/store/analytics.store";
import { useRecommendationsStore } from "../../src/features/recommendations/store/recommendations.store";
import { useScrollToTopOnTabPress } from "../../src/hooks/use-scroll-to-top";
import { useTelemetryStore } from "../../src/features/player/store/telemetry.store";
import { RenderDiagnostics } from "../../src/utils/render-diagnostics";

const { width: SW } = Dimensions.get("window");

// ── Palette (matches HTML exactly) ───────────────────────────────────────────
const PRIMARY = "#BF5AF2";  // purple toggle / ring slice 1
const SECONDARY = "#46f5e0";  // aqua / ring slice 2
const BG = "#0F0F13";

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
const GlassCard = ({ children, style, r = 32, frosted = false }: {
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
);

// ─────────────────────────────────────────────────────────────────────────────
// STAGGERED SECTION  (matches .animate-stagger > *:nth-child(n))
// fadeInUp 0.8s cubic-bezier(0.2,1,0.3,1) forwards with per-index delay
// ─────────────────────────────────────────────────────────────────────────────
const Section = ({ children, index }: { children: React.ReactNode; index: number }) => {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const translateY = useRef(new RNAnimated.Value(30)).current;

  useEffect(() => {
    const delay = 100 + index * 100;
    RNAnimated.parallel([
      RNAnimated.timing(opacity, { toValue: 1, duration: 800, delay, easing: RNEasing.bezier(0.2, 1, 0.3, 1), useNativeDriver: true }),
      RNAnimated.timing(translateY, { toValue: 0, duration: 800, delay, easing: RNEasing.bezier(0.2, 1, 0.3, 1), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <RNAnimated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </RNAnimated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER LABEL
// ─────────────────────────────────────────────────────────────────────────────
const SectionLabel = ({ icon, title }: { icon: string; title: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 36, marginBottom: 12, paddingLeft: 4, opacity: 0.6 }}>
    <MaterialIcons name={icon as any} size={14} color="rgba(255,255,255,0.9)" />
    <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 2.0, color: "#FFFFFF", textTransform: "uppercase" }}>
      {title}
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SPRING TOGGLE  (matches .custom-toggle / .custom-toggle.active)
// cubic-bezier(0.175,0.885,0.32,1.275) bounce
// ─────────────────────────────────────────────────────────────────────────────
const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => {
  const anim = useRef(new RNAnimated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    RNAnimated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      tension: 190, friction: 16,   // approximates cubic-bezier(0.175,0.885,0.32,1.275)
    }).start();
  }, [value]);

  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(255,255,255,0.10)", PRIMARY] });
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 26] });
  const sc = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.88, 1] });

  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(!value); }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <RNAnimated.View style={[st.toggleTrack, { backgroundColor: bg }]}>
        <RNAnimated.View style={[st.toggleThumb, { transform: [{ translateX: tx }, { scale: sc }] }]} />
      </RNAnimated.View>
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER  (divide-y divide-white/5)
// ─────────────────────────────────────────────────────────────────────────────
const Divider = () => <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginHorizontal: 0 }} />;

// ─────────────────────────────────────────────────────────────────────────────
// ROW  (p-6 flex items-center justify-between hover:bg-white/[0.03])
// ─────────────────────────────────────────────────────────────────────────────
const Row = ({
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
      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.78} style={st.row}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return <View style={st.row}>{Inner}</View>;
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM SELECT BUTTON  (mimics <select> from HTML)
// ─────────────────────────────────────────────────────────────────────────────
const SelectBtn = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity
    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
    activeOpacity={0.78}
    style={st.selectBtn}
  >
    <Text style={st.selectTxt}>{label}</Text>
    <MaterialIcons name="keyboard-arrow-down" size={20} color="rgba(255,255,255,0.40)" />
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY MODAL  (bottom-sheet, spring slide-up)
// ─────────────────────────────────────────────────────────────────────────────
const QualityModal = ({ visible, onClose, title, selectedOption, onSelect }: {
  visible: boolean; onClose: () => void; title: string;
  selectedOption: AudioQuality; onSelect: (q: AudioQuality) => void;
}) => {
  const [rendered, setRendered] = useState(visible);
  const slideY = useRef(new RNAnimated.Value(550)).current;
  const overlayOp = useRef(new RNAnimated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Capture downward vertical swipes that are distinct from static taps
        return gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dy > 0) {
          slideY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.4) {
          // Quick swipe-down dismissal animation
          RNAnimated.parallel([
            RNAnimated.timing(overlayOp, {
              toValue: 0,
              duration: 150,
              easing: RNEasing.in(RNEasing.ease),
              useNativeDriver: true,
            }),
            RNAnimated.timing(slideY, {
              toValue: 550,
              duration: 180,
              easing: RNEasing.out(RNEasing.ease),
              useNativeDriver: true,
            }),
          ]).start(() => {
            onClose();
            setRendered(false);
          });
        } else {
          // Snap back into place
          RNAnimated.spring(slideY, {
            toValue: 0,
            tension: 280,
            friction: 24,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      RNAnimated.parallel([
        RNAnimated.timing(overlayOp, {
          toValue: 1,
          duration: 180,
          easing: RNEasing.out(RNEasing.ease),
          useNativeDriver: true,
        }),
        RNAnimated.spring(slideY, {
          toValue: 0,
          tension: 280,
          friction: 24,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(overlayOp, {
          toValue: 0,
          duration: 150,
          easing: RNEasing.in(RNEasing.ease),
          useNativeDriver: true,
        }),
        RNAnimated.timing(slideY, {
          toValue: 550,
          duration: 180,
          easing: RNEasing.out(RNEasing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  const OPTIONS: { label: string; value: AudioQuality; sub: string; icon: string }[] = [
    { label: "Low", value: "low", sub: "96 kbps · Data saver", icon: "speed" },
    { label: "Normal", value: "normal", sub: "128 kbps · Balanced", icon: "graphic-eq" },
    { label: "High", value: "high", sub: "160 kbps · Great quality", icon: "high-quality" },
    { label: "Best", value: "best", sub: "320 kbps / Lossless · Premium", icon: "workspace-premium" },
  ];

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.65)", opacity: overlayOp }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </RNAnimated.View>
      <View style={{ flex: 1, justifyContent: "flex-end", pointerEvents: "box-none" }}>
        <RNAnimated.View
          style={{ transform: [{ translateY: slideY }], paddingHorizontal: 14, paddingBottom: 14 }}
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
                    activeOpacity={0.72}
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
        </RNAnimated.View>
      </View>
    </Modal>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// CROSSFADE SLIDER
// ─────────────────────────────────────────────────────────────────────────────
const CrossfadeSlider = ({ value, panHandlers }: { value: number; panHandlers: any }) => (
  <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", width: 24, textAlign: "center" }}>0s</Text>
      <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", position: "relative" }}>
        <View style={[StyleSheet.absoluteFill, { width: `${(value / 12) * 100}%`, borderRadius: 3, overflow: "hidden" }]}>
          <LinearGradient colors={[PRIMARY, `${PRIMARY}99`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </View>
        <View style={[st.sliderThumb, { left: `${(value / 12) * 100}%`, borderColor: PRIMARY, shadowColor: PRIMARY }]} />
        <View style={[StyleSheet.absoluteFill, { marginVertical: -14 }]} {...panHandlers} />
      </View>
      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", width: 28, textAlign: "center" }}>12s</Text>
    </View>
    <View style={{ alignItems: "center", marginTop: 8 }}>
      <Text style={{ fontSize: 12, color: PRIMARY, fontWeight: "700" }}>{value === 0 ? "Off" : `${value}s crossfade`}</Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// CACHE LIMIT PILLS  (2 GB / 5 GB / 10 GB / ∞)
// ─────────────────────────────────────────────────────────────────────────────
const CachePills = ({ current, onSelect }: { current: number | "unlimited"; onSelect: (v: number | "unlimited") => void }) => (
  <View style={{ flexDirection: "row", gap: 8 }}>
    {([2, 5, 10, "unlimited"] as const).map(v => {
      const active = current === v;
      return (
        <TouchableOpacity
          key={v}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(v); }}
          activeOpacity={0.8}
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
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnTabPress(scrollRef);
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  const telemetry = useTelemetryStore();

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [modalType, setModalType] = useState<null | "streamingWifi" | "streamingCellular" | "downloadWifi" | "downloadCellular">(null);
  const [devOpen, setDevOpen] = useState(false);
  const [displayRefreshStats, setDisplayRefreshStats] = useState<any>(null);
  const [telemetryStats, setTelemetryStats] = useState<any>({
    uiLongFrames: 0,
    uiJankyFrames: 0,
    uiFrozenFrames: 0,
    uiAvgFrameTime: 0,
    uiFps: 0,
    jsLongFrames: 0,
    jsJankyFrames: 0,
    jsFrozenFrames: 0,
    jsAvgFrameTime: 0,
    jsFps: 0,
  });

  useEffect(() => {
    if (!devOpen) {
      if (!__DEV__) {
        RenderDiagnostics.stopMonitoring();
      }
      return;
    }

    if (!__DEV__) {
      RenderDiagnostics.startMonitoring();
    }

    let active = true;
    const update = async () => {
      if (!active) return;
      const specs = await RenderDiagnostics.getCurrentRefreshRate();
      if (active) {
        setDisplayRefreshStats(specs);
        setTelemetryStats({
          uiLongFrames: RenderDiagnostics.uiLongFrames.value,
          uiJankyFrames: RenderDiagnostics.uiJankyFrames.value,
          uiFrozenFrames: RenderDiagnostics.uiFrozenFrames.value,
          uiAvgFrameTime: RenderDiagnostics.uiAvgFrameTime.value,
          uiFps: RenderDiagnostics.uiFps.value,
          jsLongFrames: RenderDiagnostics.jsLongFrames.value,
          jsJankyFrames: RenderDiagnostics.jsJankyFrames.value,
          jsFrozenFrames: RenderDiagnostics.jsFrozenFrames.value,
          jsAvgFrameTime: RenderDiagnostics.jsAvgFrameTime.value,
          jsFps: RenderDiagnostics.jsFps.value,
        });
      }
    };

    update();
    const interval = setInterval(update, 500);
    return () => {
      active = false;
      clearInterval(interval);
      if (!__DEV__) {
        RenderDiagnostics.stopMonitoring();
      }
    };
  }, [devOpen]);
  const [isClearing, setIsClearing] = useState(false);

  const analyticsHistory = useAnalyticsStore(s => s.history);
  const artistAffinities = useAnalyticsStore(s => s.artistAffinities);
  const albumAffinities = useAnalyticsStore(s => s.albumAffinities);
  const trackAffinities = useAnalyticsStore(s => s.trackAffinities);
  const resetAnalytics = useAnalyticsStore(s => s.resetAnalytics);

  const topArtists = useMemo(() => {
    return Object.keys(artistAffinities)
      .map((key) => ({ key, ...artistAffinities[key] }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.playCount - a.playCount;
      });
  }, [artistAffinities]);

  const topAlbums = useMemo(() => {
    return Object.keys(albumAffinities)
      .map((key) => ({ key, ...albumAffinities[key] }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.playCount - a.playCount;
      });
  }, [albumAffinities]);

  const topTracks = useMemo(() => {
    return Object.keys(trackAffinities)
      .map((key) => ({ key, ...trackAffinities[key] }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.playCount - a.playCount;
      });
  }, [trackAffinities]);

  const recStore = useRecommendationsStore();

  const totalPlays = useMemo(() => {
    return Object.values(trackAffinities).reduce((acc, t) => acc + (t.playCount || 0), 0);
  }, [trackAffinities]);

  const totalCompletions = useMemo(() => {
    return Object.values(trackAffinities).reduce((acc, t) => acc + (t.completionCount || 0), 0);
  }, [trackAffinities]);

  const totalSkips = useMemo(() => {
    return Object.values(trackAffinities).reduce((acc, t) => acc + (t.skipCount || 0), 0);
  }, [trackAffinities]);

  const refreshStats = async () => {
    const stats = await CacheManager.getCacheStats();
    setStorageStats(stats);
  };

  useEffect(() => { refreshStats(); }, []);

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
    const res = await AudioSessionController.openEqualizer();
    if (!res.success) Alert.alert("Equalizer", "No compatible equalizer found on this device.");
  };

  const crossfadePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const v = Math.round((e.nativeEvent.locationX / (SW - 96)) * 12);
        settings.setCrossfadeDuration(Math.max(0, Math.min(12, v)));
        Haptics.selectionAsync();
      },
      onPanResponderMove: (e) => {
        const v = Math.round((e.nativeEvent.locationX / (SW - 96)) * 12);
        settings.setCrossfadeDuration(Math.max(0, Math.min(12, v)));
      },
    })
  ).current;

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

  const maxBytes = settings.maxSongCacheGB === "unlimited"
    ? 20 * 1024 * 1024 * 1024
    : (settings.maxSongCacheGB as number) * 1024 * 1024 * 1024;

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
                  {dlFill > 0 && (
                    <Circle cx="96" cy="96" r={RADIUS} fill="transparent" stroke={PRIMARY} strokeWidth={STROKE_W}
                      strokeDasharray={`${dlFill} ${CIRC}`} strokeDashoffset={0} strokeLinecap="round" />
                  )}
                  {cacheFill > 0 && (
                    <Circle cx="96" cy="96" r={RADIUS} fill="transparent" stroke={SECONDARY} strokeWidth={STROKE_W}
                      strokeDasharray={`${cacheFill} ${CIRC}`} strokeDashoffset={-dlFill} strokeLinecap="round" />
                  )}
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
                <TouchableOpacity onPress={handleClearCache} activeOpacity={0.78}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFF" }}>Clear Cache</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClearDownloads} activeOpacity={0.78}
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
            {/* Crossfade */}
            <Row
              icon="compare-arrows" iconColor="#D8B4FE" iconBg="rgba(168,85,247,0.10)"
              label="Crossfade" sub="Seamlessly blend tracks"
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {settings.crossfadeEnabled && <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontWeight: "600" }}>{settings.crossfadeDuration}s</Text>}
                  <Toggle value={settings.crossfadeEnabled} onChange={() => settings.toggleSetting("crossfadeEnabled")} />
                </View>
              }
            />
            {settings.crossfadeEnabled && <CrossfadeSlider value={settings.crossfadeDuration} panHandlers={crossfadePan.panHandlers} />}
            <Divider />
            {/* Gapless */}
            <Row
              icon="linear-scale" iconColor="#67E8F9" iconBg="rgba(6,182,212,0.10)"
              label="Gapless Playback" sub="No silence between tracks"
              right={<Toggle value={settings.gaplessPlayback} onChange={() => settings.toggleSetting("gaplessPlayback")} />}
            />
            <Divider />
            {/* Normalize */}
            <Row
              icon="volume-up" iconColor="#F9A8D4" iconBg="rgba(236,72,153,0.10)"
              label="Normalize Volume" sub="Consistent level for all songs"
              right={<Toggle value={settings.normalizeVolume} onChange={() => settings.toggleSetting("normalizeVolume")} />}
            />
            <Divider />
            {/* Equalizer */}
            <Row
              icon="equalizer" iconColor="#FDE047" iconBg="rgba(234,179,8,0.10)"
              label="Equalizer" sub="Custom frequency adjustment"
              onPress={handleOpenEQ} chevron
            />
            <Divider />
            {/* Autoplay Radio */}
            <Row
              icon="radio" iconColor="#34D399" iconBg="rgba(52,211,153,0.10)"
              label="Autoplay Radio" sub="Continuation mix when queue ends"
              right={<Toggle value={settings.autoplayEnabled} onChange={() => settings.toggleSetting("autoplayEnabled")} />}
            />
            <Divider />
            {/* Smart Shuffle */}
            <Row
              icon="shuffle" iconColor="#60A5FA" iconBg="rgba(96,165,250,0.10)"
              label="Smart Shuffle" sub="Weighted smart track shuffle"
              right={<Toggle value={settings.smartShuffleEnabled} onChange={() => settings.toggleSetting("smartShuffleEnabled")} />}
            />
          </GlassCard>
        </Section>

        {/* ── AUDIO QUALITY (section 3) ────────────────────────────────────── */}
        <Section index={2}>
          <SectionLabel icon="high-quality" title="Audio Quality" />
          <View style={{ gap: 16 }}>
            {[
              { key: "streamingWifi", icon: "wifi", iconColor: "#22d3ee", title: "Wi-Fi Streaming", val: settings.streamingQualityWifi },
              { key: "streamingCellular", icon: "signal-cellular-alt", iconColor: "#c084fc", title: "Cellular Streaming", val: settings.streamingQualityCellular },
              { key: "downloadWifi", icon: "downloading", iconColor: "#22d3ee", title: "Download • Wi-Fi", val: settings.downloadQualityWifi },
              { key: "downloadCellular", icon: "downloading", iconColor: "#c084fc", title: "Download • Cellular", val: settings.downloadQualityCellular },
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
                <Toggle value={settings.downloadOnlyOnWifi} onChange={() => settings.toggleSetting("downloadOnlyOnWifi")} />
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
                <Toggle value={settings.autoDownloadLikedSongs} onChange={() => settings.toggleSetting("autoDownloadLikedSongs")} />
              </View>
            </View>
            <Divider />
            {/* Cache limit pills */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.40)", letterSpacing: 2.0, marginBottom: 12, textTransform: "uppercase" }}>
                Max Song Cache
              </Text>
              <CachePills current={settings.maxSongCacheGB} onSelect={settings.setMaxSongCache} />
            </View>
          </GlassCard>
        </Section>

        {/* ── SUPPORT & ABOUT (section 5) ──────────────────────────────────── */}
        <Section index={4}>
          <SectionLabel icon="info" title="Support & About" />
          <GlassCard r={32} style={{ overflow: "hidden" }}>
            {/* FAQ */}
            <TouchableOpacity
              onPress={() => Alert.alert("FAQ", "Frequently Asked Questions coming soon.")}
              activeOpacity={0.78}
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
              activeOpacity={0.78}
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

        {/* ── TELEMETRY DIAGNOSTICS & DEVELOPER DASHBOARD (section 6) ────────────────── */}
        <Section index={5}>
          <SectionLabel icon="bug-report" title="Developer Diagnostics" />
          <GlassCard r={32} style={{ overflow: "hidden" }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setDevOpen(!devOpen);
              }}
              activeOpacity={0.78}
              style={st.row}
            >
              <View style={st.rowInner}>
                <View style={st.rowLeft}>
                  <View style={[st.iconBadge, { backgroundColor: "rgba(191,90,242,0.12)" }]}>
                    <MaterialIcons name="developer-mode" size={20} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.rowLabel}>Telemetry Validation Dashboard</Text>
                    <Text style={st.rowSub}>{devOpen ? "Collapse diagnostic metrics" : "Inspect raw affinity data & logs"}</Text>
                  </View>
                </View>
                <MaterialIcons 
                  name={devOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color="rgba(255,255,255,0.40)" 
                />
              </View>
            </TouchableOpacity>

            {devOpen && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
                <Divider />
                
                {/* Rendering & Refresh Rate Telemetry */}
                <Text style={st.devSectionHeader}>Rendering & Refresh Rate Telemetry</Text>
                
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Display Mode Spec</Text>
                  <Text style={{ fontSize: 14, color: '#FFF', fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                    {displayRefreshStats?.displayMode || 'Loading...'}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                    Preferred Mode ID: {displayRefreshStats?.preferredDisplayModeId ?? 0} | Preferred Rate: {displayRefreshStats?.preferredRefreshRate ?? 0} Hz
                  </Text>
                </View>

                <View style={st.devOverviewGrid}>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{displayRefreshStats?.currentRefreshRate?.toFixed(1) ?? '60.0'} Hz</Text>
                    <Text style={st.devOverviewLabel}>Current Refresh Rate</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{displayRefreshStats?.frameInterval?.toFixed(2) ?? '16.67'} ms</Text>
                    <Text style={st.devOverviewLabel}>Frame Interval</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetryStats.uiFps} / {telemetryStats.jsFps}</Text>
                    <Text style={st.devOverviewLabel}>FPS (UI / JS)</Text>
                  </View>
                </View>

                <View style={st.devOverviewGrid}>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetryStats.uiAvgFrameTime.toFixed(1)} ms</Text>
                    <Text style={st.devOverviewLabel}>UI Avg Frame Time</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetryStats.jsAvgFrameTime.toFixed(1)} ms</Text>
                    <Text style={st.devOverviewLabel}>JS Avg Frame Time</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetryStats.uiLongFrames} / {telemetryStats.jsLongFrames}</Text>
                    <Text style={st.devOverviewLabel}>Long (UI / JS)</Text>
                  </View>
                </View>

                <View style={st.devOverviewGrid}>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetryStats.uiJankyFrames} / {telemetryStats.jsJankyFrames}</Text>
                    <Text style={st.devOverviewLabel}>Janky (UI / JS)</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetryStats.uiFrozenFrames} / {telemetryStats.jsFrozenFrames}</Text>
                    <Text style={st.devOverviewLabel}>Frozen (UI / JS)</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      RenderDiagnostics.resetTelemetry();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert("Success", "Rendering telemetry reset.");
                    }}
                    activeOpacity={0.78}
                    style={[st.devOverviewItem, { backgroundColor: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.18)" }]}
                  >
                    <MaterialIcons name="refresh" size={18} color="#f87171" style={{ marginBottom: 2 }} />
                    <Text style={[st.devOverviewLabel, { color: "#f87171" }]}>Reset Render Stats</Text>
                  </TouchableOpacity>
                </View>

                <Divider />
                
                {/* 0. Resolver Diagnostics */}
                <Text style={st.devSectionHeader}>Resolver Telemetry</Text>
                <View style={st.devOverviewGrid}>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetry.sourceErrorCount}</Text>
                    <Text style={st.devOverviewLabel}>Source Errors</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetry.localRecoveryCount}</Text>
                    <Text style={st.devOverviewLabel}>Local Recoveries</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetry.streamRecoveryCount}</Text>
                    <Text style={st.devOverviewLabel}>Stream Recoveries</Text>
                  </View>
                </View>

                <View style={st.devOverviewGrid}>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetry.queueRepairCount}</Text>
                    <Text style={st.devOverviewLabel}>Queue Repairs</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{telemetry.resolverCooldownHits}</Text>
                    <Text style={st.devOverviewLabel}>Cooldown Hits</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      telemetry.resetTelemetry();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert("Success", "Resolver telemetry cleared.");
                    }}
                    activeOpacity={0.78}
                    style={[st.devOverviewItem, { backgroundColor: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.18)" }]}
                  >
                    <MaterialIcons name="refresh" size={18} color="#f87171" style={{ marginBottom: 2 }} />
                    <Text style={[st.devOverviewLabel, { color: "#f87171" }]}>Reset Telemetry</Text>
                  </TouchableOpacity>
                </View>

                <Divider />

                {/* 1. Analytics Overview */}
                <Text style={st.devSectionHeader}>Analytics Overview</Text>
                <View style={st.devOverviewGrid}>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{totalPlays}</Text>
                    <Text style={st.devOverviewLabel}>Played</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{totalCompletions}</Text>
                    <Text style={st.devOverviewLabel}>Completed</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{totalSkips}</Text>
                    <Text style={st.devOverviewLabel}>Skipped</Text>
                  </View>
                </View>

                <View style={st.devOverviewGrid}>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{Object.keys(artistAffinities).length}</Text>
                    <Text style={st.devOverviewLabel}>Unique Artists</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{Object.keys(albumAffinities).length}</Text>
                    <Text style={st.devOverviewLabel}>Unique Albums</Text>
                  </View>
                  <View style={st.devOverviewItem}>
                    <Text style={st.devOverviewVal}>{Object.keys(trackAffinities).length}</Text>
                    <Text style={st.devOverviewLabel}>Unique Tracks</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, opacity: 0.7 }}>
                  <Text style={st.devInfoText}>History Size: {analyticsHistory.length} / 200</Text>
                  <Text style={st.devInfoText}>Last Flush: {analyticsHistory[0]?.playedAt ? new Date(analyticsHistory[0].playedAt).toLocaleTimeString() : "Never"}</Text>
                </View>

                <Divider />

                {/* 2. Top Artists Table */}
                <Text style={st.devSectionHeader}>Top Artists</Text>
                {topArtists.length === 0 ? (
                  <Text style={st.devEmptyText}>No artist telemetry recorded yet.</Text>
                ) : (
                  topArtists.map((artist, idx) => (
                    <View key={artist.key} style={st.devTableRow}>
                      <Text style={st.devTableTextMain} numberOfLines={1}>{idx + 1}. {artist.key}</Text>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Text style={st.devTableTextBadge}>Score: {artist.score.toFixed(1)}</Text>
                        <Text style={st.devTableTextSub}>P: {artist.playCount} | C: {artist.completionCount}</Text>
                      </View>
                    </View>
                  ))
                )}

                <Divider />

                {/* 3. Top Albums Table */}
                <Text style={st.devSectionHeader}>Top Albums</Text>
                {topAlbums.length === 0 ? (
                  <Text style={st.devEmptyText}>No album telemetry recorded yet.</Text>
                ) : (
                  topAlbums.map((album, idx) => (
                    <View key={album.key} style={st.devTableRow}>
                      <Text style={st.devTableTextMain} numberOfLines={1}>{idx + 1}. {album.key}</Text>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Text style={st.devTableTextBadge}>Score: {album.score.toFixed(1)}</Text>
                        <Text style={st.devTableTextSub}>P: {album.playCount} | C: {album.completionCount}</Text>
                      </View>
                    </View>
                  ))
                )}

                <Divider />

                {/* 4. Top Tracks Table */}
                <Text style={st.devSectionHeader}>Top Tracks</Text>
                {topTracks.length === 0 ? (
                  <Text style={st.devEmptyText}>No track telemetry recorded yet.</Text>
                ) : (
                  topTracks.map((track, idx) => {
                    const match = analyticsHistory.find((h) => h.id === track.key);
                    const title = match?.title || track.key;
                    const artist = match?.artist || "Unknown";
                    return (
                      <View key={track.key} style={st.devTableRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={st.devTableTextMain} numberOfLines={1}>{idx + 1}. {title}</Text>
                          <Text style={st.devTableTextSubSmall} numberOfLines={1}>{artist}</Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                          <Text style={st.devTableTextBadge}>Score: {track.score.toFixed(1)}</Text>
                          <Text style={st.devTableTextSub}>P: {track.playCount} | S: {track.skipCount}</Text>
                        </View>
                      </View>
                    );
                  })
                )}

                <Divider />

                {/* 5. Recent History Log */}
                <Text style={st.devSectionHeader}>Recent History Log</Text>
                {analyticsHistory.length === 0 ? (
                  <Text style={st.devEmptyText}>No listening history recorded yet.</Text>
                ) : (
                  analyticsHistory.slice(0, 5).map((entry, idx) => (
                    <View key={`${entry.id}-${entry.playedAt}`} style={st.devTableRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={st.devTableTextMain} numberOfLines={1}>{idx + 1}. {entry.title}</Text>
                        <Text style={st.devTableTextSubSmall} numberOfLines={1}>
                          {new Date(entry.playedAt).toLocaleTimeString()} • {Math.round(entry.completionRatio * 100)}%
                        </Text>
                      </View>
                      <Text style={[st.devTableTextBadge, entry.skipped && { backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }]}>
                        {entry.skipped ? "Skipped" : "Played"}
                      </Text>
                    </View>
                  ))
                )}

                <Divider />

                {/* 6. Dangerous Actions */}
                <Text style={st.devSectionHeader}>Dangerous Actions</Text>
                <View style={{ gap: 12, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      recStore.generateRecommendations();
                      const time = recStore.generatedAt ? new Date(recStore.generatedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
                      Alert.alert("Recommendations", `Seeds successfully regenerated at ${time}.`);
                    }}
                    activeOpacity={0.78}
                    style={st.devActionBtn}
                  >
                    <MaterialIcons name="sync" size={16} color={PRIMARY} />
                    <Text style={st.devActionBtnTxt}>Regenerate Recommendations</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        Alert.alert(
                          "Clear Analytics",
                          "Reset all persistent playback analytics history and affinity scores? This cannot be undone.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Reset",
                              style: "destructive",
                              onPress: () => {
                                resetAnalytics();
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                Alert.alert("Success", "Analytics telemetry cleared.");
                              }
                            }
                          ]
                        );
                      }}
                      activeOpacity={0.78}
                      style={[st.devActionBtn, { flex: 1, borderColor: "rgba(239,68,68,0.2)" }]}
                    >
                      <MaterialIcons name="delete-forever" size={16} color="#f87171" />
                      <Text style={[st.devActionBtnTxt, { color: "#f87171" }]}>Clear Analytics</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        recStore.resetRecommendations();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert("Success", "Recommendations store cleared.");
                      }}
                      activeOpacity={0.78}
                      style={[st.devActionBtn, { flex: 1 }]}
                    >
                      <MaterialIcons name="refresh" size={16} color="#cbc3d9" />
                      <Text style={st.devActionBtnTxt}>Reset Recs</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
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
          modalType === "streamingWifi" ? settings.streamingQualityWifi :
            modalType === "streamingCellular" ? settings.streamingQualityCellular :
              modalType === "downloadWifi" ? settings.downloadQualityWifi : settings.downloadQualityCellular
        }
        onSelect={(q) => {
          if (modalType === "streamingWifi") settings.setStreamingQuality("wifi", q);
          else if (modalType === "streamingCellular") settings.setStreamingQuality("cellular", q);
          else if (modalType === "downloadWifi") settings.setDownloadQuality("wifi", q);
          else settings.setDownloadQuality("cellular", q);
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
  devSectionHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 10,
  },
  devOverviewGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  devOverviewItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  devOverviewVal: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFF",
  },
  devOverviewLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.40)",
    textTransform: "uppercase",
    marginTop: 2,
  },
  devInfoText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
  },
  devTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  devTableTextMain: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  devTableTextSub: {
    fontSize: 10,
    color: "rgba(255,255,255,0.40)",
    fontWeight: "600",
  },
  devTableTextSubSmall: {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  devTableTextBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: SECONDARY,
    backgroundColor: "rgba(70,245,224,0.10)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  devEmptyText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.30)",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  devActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    paddingVertical: 12,
  },
  devActionBtnTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
});