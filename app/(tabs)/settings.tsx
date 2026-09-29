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
import Constants from "expo-constants";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import packageJson from "../../package.json";
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
import { downloadCleanupService } from "../../src/features/download/services/download-cleanup.service";
import { useScrollToTopOnTabPress } from "../../src/hooks/use-scroll-to-top";
import { LiquidToggle } from "@/src/components/ui/liquid-toggle";
import { useUpdateStore } from "../../src/features/update/store/update.store";
import { useTasteProfileStore } from "../../src/features/taste-profile/store/taste-profile.store";

const { width: SW } = Dimensions.get("window");
const APP_VERSION =
  Constants.expoConfig?.version ??
  (Constants as any).nativeAppVersion ??
  packageJson.version ??
  "3.0.0";

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
    <BlurView intensity={frosted ? 75 : 45} tint="dark" style={StyleSheet.absoluteFill} />
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: frosted ? "rgba(16, 14, 24, 0.94)" : "rgba(22, 19, 32, 0.84)" },
      ]}
    />
    {/* Subtle top specular */}
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: r * 0.4, right: r * 0.4, height: 1.5, backgroundColor: "rgba(255,255,255,0.22)", zIndex: 9 }} />
    {/* Border ring */}
    <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }} />
    {/* Inner sheen */}
    <LinearGradient colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
    {children}
  </View>
));
GlassCard.displayName = "GlassCard";

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
Section.displayName = "Section";

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
SectionLabel.displayName = "SectionLabel";

// ─────────────────────────────────────────────────────────────────────────────
// LIQUID TOGGLE (Optical pop, refraction flare, and liquid fill animation)
// ─────────────────────────────────────────────────────────────────────────────
const Toggle = React.memo(({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => {
  return <LiquidToggle value={value} onChange={onChange} />;
});
Toggle.displayName = 'Toggle';

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER  (divide-y divide-white/5)
// ─────────────────────────────────────────────────────────────────────────────
const Divider = React.memo(() => <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginHorizontal: 0 }} />);
Divider.displayName = "Divider";

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
Row.displayName = "Row";

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
SelectBtn.displayName = "SelectBtn";

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// QUALITY MODAL  (Apple-grade calm, effortless Liquid Glass sheet)
// ─────────────────────────────────────────────────────────────────────────────
const QualityModal = React.memo(({ visible, onClose, title, selectedOption, onSelect }: {
  visible: boolean; onClose: () => void; title: string;
  selectedOption: AudioQuality; onSelect: (q: AudioQuality) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const isClosingRef = useRef(false);

  // Preserve title and selected option across closing transition to prevent visual jumps
  const persistentTitleRef = useRef(title);
  const persistentSelectedRef = useRef(selectedOption);

  if (visible) {
    persistentTitleRef.current = title;
    persistentSelectedRef.current = selectedOption;
  }

  const activeTitle = visible ? title : persistentTitleRef.current;
  const activeSelected = visible ? selectedOption : persistentSelectedRef.current;

  // Single coherent motion values — zero spring overshoot, pure ease-out
  const overlayOp = useSharedValue(0);
  const sheetTranslateY = useSharedValue(64);
  const sheetOpacity = useSharedValue(0);
  const sheetScale = useSharedValue(0.985);

  const finishClose = useCallback(() => {
    isClosingRef.current = false;
    setRendered(false);
    onClose();
  }, [onClose]);

  const triggerClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    overlayOp.value = withTiming(0, {
      duration: 190,
      easing: ReanimatedEasing.in(ReanimatedEasing.quad),
    });
    sheetOpacity.value = withTiming(0, {
      duration: 170,
      easing: ReanimatedEasing.in(ReanimatedEasing.quad),
    });
    sheetTranslateY.value = withTiming(48, {
      duration: 190,
      easing: ReanimatedEasing.bezier(0.4, 0, 0.6, 1),
    });
    sheetScale.value = withTiming(
      0.985,
      {
        duration: 190,
        easing: ReanimatedEasing.bezier(0.4, 0, 0.6, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      }
    );
  }, [overlayOp, sheetOpacity, sheetTranslateY, sheetScale, finishClose]);

  // Pan responder for natural downward swipe to dismiss without spring oscillation
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 7 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_e, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.value = gestureState.dy;
        }
      },
      onPanResponderRelease: (_e, gestureState) => {
        if (gestureState.dy > 70 || gestureState.vy > 0.4) {
          triggerClose();
        } else {
          sheetTranslateY.value = withTiming(0, {
            duration: 220,
            easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
          });
        }
      },
    })
  ).current;

  // React to visible prop
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setRendered(true);

      // Start values
      overlayOp.value = 0;
      sheetOpacity.value = 0;
      sheetTranslateY.value = 64;
      sheetScale.value = 0.985;

      // Reveal smoothly: 280ms Apple ease-out curve, zero overshoot, settles once
      overlayOp.value = withTiming(1, {
        duration: 280,
        easing: ReanimatedEasing.out(ReanimatedEasing.quad),
      });
      sheetOpacity.value = withTiming(1, {
        duration: 240,
        easing: ReanimatedEasing.out(ReanimatedEasing.quad),
      });
      sheetTranslateY.value = withTiming(0, {
        duration: 280,
        easing: ReanimatedEasing.bezier(0.16, 1, 0.3, 1),
      });
      sheetScale.value = withTiming(1, {
        duration: 280,
        easing: ReanimatedEasing.bezier(0.16, 1, 0.3, 1),
      });
    } else if (rendered && !isClosingRef.current) {
      triggerClose();
    }
  }, [visible, rendered, triggerClose, overlayOp, sheetOpacity, sheetTranslateY, sheetScale]);

  const handleOptionPress = useCallback((optVal: AudioQuality) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // 1. Immediately apply selection
    onSelect(optVal);
    // 2. Smoothly dismiss surface
    triggerClose();
  }, [onSelect, triggerClose]);

  const OPTIONS: { label: string; value: AudioQuality; sub: string; icon: string }[] = [
    { label: "Low", value: "low", sub: "96 kbps · Data saver", icon: "speed" },
    { label: "Normal", value: "normal", sub: "128 kbps · Balanced", icon: "graphic-eq" },
    { label: "High", value: "high", sub: "160 kbps · Great quality", icon: "high-quality" },
    { label: "Best", value: "best", sub: "Original / Best · Maximum fidelity", icon: "workspace-premium" },
  ];

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOp.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [
      { translateY: sheetTranslateY.value },
      { scale: sheetScale.value },
    ],
  }));

  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={triggerClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5, 5, 9, 0.62)" }, overlayStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={triggerClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss popup"
        />
      </Animated.View>

      <View style={{ flex: 1, justifyContent: "flex-end", pointerEvents: "box-none" }}>
        <Animated.View
          style={[
            {
              paddingHorizontal: 14,
              paddingBottom: Math.max(insets.bottom, 14) + 6,
            },
            sheetStyle,
          ]}
          {...panResponder.panHandlers}
        >
          <GlassCard r={30} frosted>
            {/* Grab handle */}
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 6 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(255, 255, 255, 0.22)",
                }}
              />
            </View>

            {/* Title */}
            <Text style={st.modalTitle}>{activeTitle}</Text>

            {/* Option rows — entire surface composed at once, zero child stagger */}
            {OPTIONS.map((opt, i) => {
              const isSelected = activeSelected === opt.value;
              return (
                <React.Fragment key={opt.value}>
                  {i > 0 && (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        marginHorizontal: 16,
                      }}
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => handleOptionPress(opt.value)}
                    style={[
                      st.modalOpt,
                      isSelected && { backgroundColor: "rgba(218, 185, 255, 0.10)" },
                    ]}
                    activeOpacity={0.72}
                    delayPressIn={0}
                  >
                    <View
                      style={[
                        st.modalOptIcon,
                        {
                          backgroundColor: isSelected
                            ? "rgba(218, 185, 255, 0.18)"
                            : "rgba(255, 255, 255, 0.05)",
                          borderColor: isSelected
                            ? "rgba(218, 185, 255, 0.35)"
                            : "rgba(255, 255, 255, 0.08)",
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={opt.icon as any}
                        size={18}
                        color={isSelected ? PRIMARY : "rgba(170, 170, 185, 0.65)"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          st.modalOptLabel,
                          isSelected && { color: "#FFFFFF", fontWeight: "700" },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={st.modalOptSub}>{opt.sub}</Text>
                    </View>
                    {isSelected && (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: PRIMARY,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="checkmark" size={14} color="#0B0B0F" />
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
QualityModal.displayName = "QualityModal";

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
CachePills.displayName = "CachePills";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
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

  // Update store selectors
  const hasUpdate = useUpdateStore(s => s.hasUpdate);
  const releaseInfo = useUpdateStore(s => s.releaseInfo);
  const checkForUpdates = useUpdateStore(s => s.checkForUpdates);
  const tasteProfile = useTasteProfileStore();

  // Background update check on settings view (cached, respects 4hr interval)
  useEffect(() => {
    checkForUpdates(false);
  }, [checkForUpdates]);

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [modalType, setModalType] = useState<null | "streamingWifi" | "streamingCellular" | "downloadWifi" | "downloadCellular">(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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
    switch (val) {
      case "low":
        return "Low (96 kbps)";
      case "normal":
        return "Normal (128 kbps)";
      case "high":
        return "High (160 kbps)";
      case "best":
        return "Best (Original)";
      default:
        return "Normal (128 kbps)";
    }
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

        {/* ── MUSIC TASTE PROFILE (section 1) ───────────────────────────────── */}
        <Section index={1}>
          <SectionLabel icon="auto-awesome" title="Music Taste" />
          <GlassCard r={32} style={{ overflow: "hidden" }}>
            <Row
              icon="palette" iconColor="#BF5AF2" iconBg="rgba(191,90,242,0.12)"
              label="Music Taste Profile"
              sub={`${tasteProfile.name} • ${tasteProfile.songLanguages?.length || 0} languages • ${tasteProfile.favoriteArtists?.length || 0} artists`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/music_taste');
              }}
              chevron
            />
          </GlassCard>
        </Section>

        {/* ── PLAYBACK (section 2) ─────────────────────────────────────────── */}
        <Section index={2}>
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

                <Divider />
                {/* Manual Fetch Latest Backup */}
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(
                      "Fetch Latest Backup",
                      "Re-synchronize your library, playlists, listening history, and preferences with your stored backup data?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Fetch & Restore",
                          onPress: async () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setIsRestoring(true);
                            try {
                              const { RestoreValidatorService } = await import("@/src/services/restore-validator.service");
                              const result = await RestoreValidatorService.triggerManualRestore();
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              Alert.alert("Restore Complete", result.message);
                            } catch (e: any) {
                              Alert.alert("Restore Notice", e?.message || "Failed to complete restore.");
                            } finally {
                              setIsRestoring(false);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                  delayPressIn={0}
                  style={st.row}
                  disabled={isRestoring || isSyncing}
                >
                  <View style={st.rowInner}>
                    <View style={st.rowLeft}>
                      <View style={[st.iconBadge, { backgroundColor: "rgba(52,211,153,0.10)" }]}>
                        {isRestoring ? (
                          <ActivityIndicator size="small" color="#34D399" />
                        ) : (
                          <MaterialIcons name="cloud-download" size={20} color="#34D399" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.rowLabel}>Fetch Latest Backup</Text>
                        <Text style={st.rowSub}>Re-sync library, playlists & preferences</Text>
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
            {/* Software Update (Matches Stitch Design) */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/software_update' as any);
              }}
              activeOpacity={0.7}
              delayPressIn={0}
              style={st.row}
            >
              <View style={st.rowInner}>
                <View style={st.rowLeft}>
                  <View style={[st.iconBadge, { backgroundColor: hasUpdate ? "rgba(218,185,255,0.15)" : "rgba(148,163,184,0.10)" }]}>
                    <MaterialIcons
                      name={hasUpdate ? "system-update" : "verified"}
                      size={20}
                      color={hasUpdate ? PRIMARY : "#cbc3d9"}
                    />
                    {hasUpdate && (
                      <View
                        style={{
                          position: "absolute",
                          top: -2,
                          right: -2,
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: "#ff5c6a",
                          borderWidth: 2,
                          borderColor: BG,
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={st.rowLabel}>Software Update</Text>
                      {hasUpdate && releaseInfo?.version && (
                        <View
                          style={{
                            paddingHorizontal: 7,
                            paddingVertical: 1.5,
                            borderRadius: 999,
                            backgroundColor: "rgba(218,185,255,0.15)",
                            borderWidth: 1,
                            borderColor: "rgba(218,185,255,0.25)",
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: PRIMARY }}>
                            {releaseInfo.version}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={st.rowSub}>
                      {hasUpdate
                        ? "New version available"
                        : `AuraMusic is up to date (${APP_VERSION})`}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {hasUpdate && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: PRIMARY }}>Update</Text>
                  )}
                  <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.28)" />
                </View>
              </View>
            </TouchableOpacity>
            <Divider />

            {/* FAQ */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/faq' as any);
              }}
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
                <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.28)" />
              </View>
            </TouchableOpacity>
            <Divider />
            {/* Privacy Policy */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/privacy_policy' as any);
              }}
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
            {/* Branding footer */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/about_creator' as any);
              }}
              activeOpacity={0.85}
              style={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 20 }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  marginBottom: 12,
                  shadowColor: "#a855f7",
                  shadowOpacity: 0.25,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <Image
                  source={require("../../assets/images/icon.png")}
                  style={{ width: 64, height: 64, borderRadius: 16 }}
                  contentFit="cover"
                />
              </View>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#FFF", letterSpacing: -0.5, marginBottom: 4 }}>AuraMusic</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", fontWeight: "600", marginBottom: 2 }}>Version {APP_VERSION}</Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>Updated September 2026</Text>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontStyle: "italic", marginTop: 14 }}>Made with ❤️ for music lovers</Text>
            </TouchableOpacity>
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