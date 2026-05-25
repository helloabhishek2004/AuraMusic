import { usePlayerStore } from "@/src/features/player/store/player.store";
import { LyricLine as LyricLineType } from "@/src/features/player/utils/lyrics-parser";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, {
  SharedValue,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProgress } from "@rntp/player";

const { width: SW, height: SH } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS  (unchanged from existing file)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg: "#08080D",
  text: "#FFFFFF",
  muted: "rgba(170,170,185,0.65)",
  primary: "#BF5AF2",
  accent: "#46f5e0",
} as const;

const SP = {
  LINE: { damping: 18, stiffness: 130, mass: 0.8 },
  THUMB: { damping: 20, stiffness: 320, mass: 0.5 },
  // Smooth spring — same feel as Spotify/YT Music centring
  SCROLL: { damping: 26, stiffness: 180, mass: 0.7 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// iOS 26 LIQUID GLASS  (Android-safe: no BlurView inside the list)
// ─────────────────────────────────────────────────────────────────────────────
const LiquidGlass = memo(({
  children, style, r = 24, blur = 52, glowColor,
}: {
  children: React.ReactNode;
  style?: any;
  r?: number;
  blur?: number;
  glowColor?: string;
}) => (
  <View style={[{ borderRadius: r, overflow: "hidden" }, style]}>
    {Platform.OS === "ios"
      ? <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
      : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(20,20,28,0.95)" }]} />
    }
    {/* Outer border */}
    <View pointerEvents="none" style={{
      ...StyleSheet.absoluteFillObject, borderRadius: r,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    }} />
    {/* Top specular */}
    <View pointerEvents="none" style={{
      position: "absolute", top: 0, left: r * 0.4, right: r * 0.4,
      height: 1.5, backgroundColor: "rgba(255,255,255,0.22)",
    }} />
    {/* iOS 26 left-edge glow */}
    {glowColor && (
      <>
        <View pointerEvents="none" style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 3, backgroundColor: glowColor, opacity: 0.75,
        }} />
        <View pointerEvents="none" style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 18, backgroundColor: glowColor, opacity: 0.14,
        }} />
      </>
    )}
    {children}
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT BACKGROUND  (identical to existing)
// ─────────────────────────────────────────────────────────────────────────────
const AmbientBG = memo(({ accent }: { accent: string }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
    <LinearGradient colors={[`${accent}12`, "transparent", C.bg]} style={StyleSheet.absoluteFill} />
    <View style={{
      position: "absolute", top: -100, left: SW * 0.1,
      width: SW * 0.9, height: SW * 0.9, borderRadius: SW * 0.45,
      backgroundColor: accent, opacity: 0.12,
    }} />
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBACK BRIDGE  (identical to existing — keep the seek-lock window)
// ─────────────────────────────────────────────────────────────────────────────
const PlaybackBridge = memo(({
  progressMs, durationMs, offset, isScrubbing, lastSeekTime,
}: {
  progressMs: SharedValue<number>;
  durationMs: SharedValue<number>;
  offset: number;
  isScrubbing: SharedValue<boolean>;
  lastSeekTime: SharedValue<number>;
}) => {
  const { useProgress } = require("@rntp/player");
  const { position, duration } = useProgress(0.25);

  useEffect(() => {
    const timeSinceSeek = Date.now() - lastSeekTime.value;
    const nativeMs = position * 1000 + offset;
    if (!isScrubbing.value) {
      if (timeSinceSeek > 1500) {
        progressMs.value = Math.max(0, nativeMs);
      } else {
        if (Math.abs(nativeMs - progressMs.value) < 1500)
          progressMs.value = Math.max(0, nativeMs);
      }
    }
    if (duration > 0) durationMs.value = duration * 1000;
  }, [position, duration, offset]);
  return null;
});

// ─────────────────────────────────────────────────────────────────────────────
// LYRIC LINE
//
// Visual design:
//  • Active line:   full opacity (1.0) + scale 1.02 + left accent bar + glass tint
//  • distance-1:    opacity 0.38 + scale 0.98
//  • distance 2+:   opacity 0.20 + scale 0.96
//  • past lines:    opacity 0.15
//
// PERF: all style math is a worklet. No BlurView inside list rows (Android).
// ─────────────────────────────────────────────────────────────────────────────
const LyricLine = memo(({
  text, lineIndex, activeLineIndex, onPress, isSynced, onLayout, accentColor,
}: {
  text: string;
  lineIndex: number;
  activeLineIndex: SharedValue<number>;
  onPress: () => void;
  isSynced: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  accentColor: string;
}) => {
  const textStyle = useAnimatedStyle(() => {
    "worklet";
    const ai = activeLineIndex.value;
    const isActive = ai === lineIndex;
    const dist = Math.abs(lineIndex - ai);
    const isUpcoming = lineIndex > ai;

    let opacity: number;
    let scale: number;
    if (isActive) {
      opacity = 1.0; scale = 1.02;
    } else if (dist === 1) {
      opacity = 0.38; scale = 0.98;
    } else {
      opacity = isUpcoming ? 0.24 : 0.15; scale = 0.96;
    }

    return {
      opacity: withTiming(opacity, { duration: 160 }),
      transform: [{ scale: withSpring(scale, SP.LINE) }],
    };
  });

  // Thin left bar — only rendered when active
  const barStyle = useAnimatedStyle(() => {
    "worklet";
    const isActive = activeLineIndex.value === lineIndex;
    return {
      opacity: withTiming(isActive ? 1 : 0, { duration: 160 }),
      transform: [{ scaleY: withSpring(isActive ? 1 : 0.3, SP.LINE) }],
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={isSynced ? 0.7 : 1}
      onPress={onPress}
      disabled={!isSynced}
      onLayout={onLayout}
      style={lnSt.row}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      {/* iOS 26 left accent bar */}
      <Reanimated.View
        pointerEvents="none"
        style={[lnSt.accentBar, { backgroundColor: accentColor }, barStyle]}
      />
      <Reanimated.Text style={[lnSt.text, textStyle]} selectable={false}>
        {text}
      </Reanimated.Text>
    </TouchableOpacity>
  );
});

const lnSt = StyleSheet.create({
  row: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    position: "relative",
  },
  accentBar: {
    position: "absolute",
    left: 4,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  text: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
    letterSpacing: -0.5,
    fontFamily: Platform.OS === "android" ? "sans-serif-condensed" : "System",
    color: "#FFFFFF",
    paddingLeft: 10,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR  (identical logic to existing, unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const MinimalProgressBar = memo(({
  accent, progressMs, durationMs, isScrubbing, lastSeekTime,
}: {
  accent: string;
  progressMs: SharedValue<number>;
  durationMs: SharedValue<number>;
  isScrubbing: SharedValue<boolean>;
  lastSeekTime: SharedValue<number>;
}) => {
  const trackW = useSharedValue(SW - 40);
  const thumbSc = useSharedValue(1);

  const fillStyle = useAnimatedStyle(() => {
    "worklet";
    const d = durationMs.value;
    return { width: d > 0 ? `${Math.min(progressMs.value / d, 1) * 100}%` : "0%" };
  });
  const thumbStyle = useAnimatedStyle(() => {
    "worklet";
    const d = durationMs.value;
    const pct = d > 0 ? Math.min(progressMs.value / d, 1) : 0;
    return { transform: [{ translateX: pct * trackW.value }, { scale: thumbSc.value }] };
  });

  const [posSec, setPosSec] = useState(0);
  const [totSec, setTotSec] = useState(0);

  useAnimatedReaction(
    () => ({ p: Math.floor(progressMs.value / 1000), d: Math.floor(durationMs.value / 1000) }),
    (cur, prev) => {
      "worklet";
      if (!prev || cur.p !== prev.p) runOnJS(setPosSec)(cur.p);
      if (!prev || cur.d !== prev.d) runOnJS(setTotSec)(cur.d);
    }
  );

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const seekToX = (x: number) => {
    "worklet";
    progressMs.value = Math.min(Math.max(0, x / trackW.value), 1) * durationMs.value;
  };

  const commitSeek = useCallback(() => {
    const ms = progressMs.value;
    lastSeekTime.value = Date.now();
    usePlayerStore.getState().seek(ms);
  }, [progressMs, lastSeekTime]);

  const pan = Gesture.Pan()
    .onStart((e) => { "worklet"; isScrubbing.value = true; thumbSc.value = withSpring(1.5, SP.THUMB); seekToX(e.x); })
    .onUpdate((e) => { "worklet"; seekToX(e.x); })
    .onEnd(() => { "worklet"; isScrubbing.value = false; thumbSc.value = withSpring(1, SP.THUMB); runOnJS(commitSeek)(); });

  const tap = Gesture.Tap()
    .onStart((e) => { "worklet"; seekToX(e.x); runOnJS(commitSeek)(); });

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Reanimated.View
          style={{ height: 28, justifyContent: "center" }}
          onLayout={(e) => { trackW.value = e.nativeEvent.layout.width; }}
        >
          <View style={{ height: 4, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 2, overflow: "visible" }}>
            <Reanimated.View style={[{ height: "100%", borderRadius: 2, backgroundColor: accent }, fillStyle]} />
            <Reanimated.View style={[
              { position: "absolute", top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: accent },
              thumbStyle,
            ]} />
          </View>
        </Reanimated.View>
      </GestureDetector>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 14 }}>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600" }}>{fmt(posSec)}</Text>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600" }}>-{fmt(Math.max(0, totSec - posSec))}</Text>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// OFFSET CONTROLS  (identical to existing)
// ─────────────────────────────────────────────────────────────────────────────
const OffsetControls = memo(({ offset, onAdjust, onReset }: {
  offset: number; onAdjust: (n: number) => void; onReset: () => void;
}) => (
  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14 }}>
    <TouchableOpacity onPress={() => onAdjust(-100)} style={styles.offsetBtn}>
      <Text style={styles.offsetText}>-100ms</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onReset} style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 13, color: "#FFF", fontWeight: "700" }}>
        {offset === 0 ? "In Sync" : `${offset > 0 ? "+" : ""}${offset}ms`}
      </Text>
      <Text style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>Reset</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => onAdjust(100)} style={styles.offsetBtn}>
      <Text style={styles.offsetText}>+100ms</Text>
    </TouchableOpacity>
  </View>
));

const styles = StyleSheet.create({
  offsetBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  offsetText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SCROLL PAUSED PILL
// ─────────────────────────────────────────────────────────────────────────────
const PausedPill = memo(({ visible, accent }: { visible: boolean; accent: string }) => {
  const op = useSharedValue(0);
  const sc = useSharedValue(0.88);

  useEffect(() => {
    op.value = withTiming(visible ? 1 : 0, { duration: 220 });
    sc.value = withSpring(visible ? 1 : 0.88, { damping: 20, stiffness: 220 });
  }, [visible]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: sc.value }],
  }));

  return (
    <Reanimated.View pointerEvents="none" style={[
      { position: "absolute", top: 8, alignSelf: "center" },
      pillStyle,
    ]}>
      <LiquidGlass r={14} blur={36} style={{ paddingHorizontal: 13, paddingVertical: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
          <Text style={{ fontSize: 10, color: accent, fontWeight: "800", letterSpacing: 0.6 }}>
            AUTO-SCROLL PAUSED
          </Text>
        </View>
      </LiquidGlass>
    </Reanimated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function LyricsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const currentTrack = usePlayerStore(s => s.currentTrack);
  const lyricsData = usePlayerStore(s => s.lyrics);
  const isLoading = usePlayerStore(s => s.isLyricsLoading);

  const [offset, setOffset] = useState(0);
  const [offsetOpen, setOffsetOpen] = useState(false);
  const [showPaused, setShowPaused] = useState(false);

  // ── Shared values ────────────────────────────────────────────────────────
  const progressMs = useSharedValue(0);
  const durationMs = useSharedValue(0);
  const isScrubbing = useSharedValue(false);
  const isUserScrolling = useSharedValue(false);
  const lastSeekTime = useSharedValue(0);

  // lineOffsets[i] = { y: offset from top of scroll content, h: line height }
  // These are measured via onLayout — the only source of truth for scroll math.
  const lineOffsets = useSharedValue<{ y: number; h: number }[]>([]);
  // Viewport height of the ScrollView (not screen height)
  const viewportH = useSharedValue(SH * 0.62);

  // The target scroll Y we want to drive to (UI-thread spring target)
  const targetScrollY = useSharedValue(0);

  const scrollRef = useAnimatedRef<Reanimated.ScrollView>();
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rntpProgress = useProgress(100);

  useEffect(() => {
    if (!isScrubbing.value) {
      progressMs.value = rntpProgress.position * 1000;
    }
    if (rntpProgress.duration > 0) {
      durationMs.value = rntpProgress.duration * 1000;
    }
  }, [rntpProgress.position, rntpProgress.duration]);

  // Track initialisation
  useEffect(() => {
    if (!currentTrack) return;
    progressMs.value = 0;
    durationMs.value = currentTrack.duration ? currentTrack.duration * 1000 : 0;
    lineOffsets.value = [];

    const { getCanonicalTrackId } = require("@/src/features/player/utils/track-identity");
    const AsyncLib = require("@react-native-async-storage/async-storage").default;
    AsyncLib.getItem(`cache:lyrics-offset:${getCanonicalTrackId(currentTrack)}`)
      .then((v: string | null) => setOffset(v ? parseInt(v, 10) : 0))
      .catch(() => setOffset(0));
  }, [currentTrack?.id]);

  // Lyrics fetch
  useEffect(() => {
    if (!currentTrack || lyricsData || isLoading) return;
    usePlayerStore.getState().fetchLyrics(currentTrack);
  }, [currentTrack?.id, lyricsData, isLoading]);

  const isSynced = useMemo(() => lyricsData?.synced ?? false, [lyricsData]);
  const lyrics: LyricLineType[] = useMemo(() => lyricsData?.lyrics ?? [], [lyricsData]);
  const accent = currentTrack?.dominantColors?.[0] ?? C.primary;

  // Reset layout array when lyrics change
  useEffect(() => {
    lineOffsets.value = new Array(lyrics.length).fill(undefined);
  }, [lyrics]);

  // ── Active index (UI thread) ─────────────────────────────────────────────
  const activeLineIndex = useDerivedValue(() => {
    "worklet";
    if (!isSynced || !lyrics.length) return -1;
    const t = progressMs.value;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= t) idx = i;
      else break;
    }
    return idx;
  }, [isSynced, lyrics]);

  // ── Core scroll mechanic ─────────────────────────────────────────────────
  //
  // Goal: keep the ACTIVE LINE visually centred in the viewport at all times.
  //
  // How it works:
  //   targetScrollY = lineY + lineH/2  -  viewportH/2
  //
  // This means the scroll content moves UP so the active line's midpoint
  // sits at the viewport midpoint — exactly like Spotify & YT Music.
  // The line itself never moves; only the scroll offset changes.
  //
  // `scrollTo(scrollRef, 0, val, false)` drives the Reanimated ScrollView
  // on the UI thread with no JS bridge round-trip.
  //
  useAnimatedReaction(
    () => {
      const idx = activeLineIndex.value;
      const layout = idx >= 0 ? lineOffsets.value[idx] : undefined;
      return {
        idx,
        userScroll: isUserScrolling.value,
        layoutY: layout?.y,
        layoutH: layout?.h,
      };
    },
    (cur, prev) => {
      "worklet";
      // Never drive scroll while user is manually scrolling
      if (cur.userScroll) return;
      if (cur.idx < 0 || cur.layoutY === undefined || cur.layoutH === undefined) return;

      const idxChanged = !prev || cur.idx !== prev.idx;
      const layoutArrived = !prev || cur.layoutY !== prev.layoutY || cur.layoutH !== prev.layoutH;
      const scrollResumed = prev?.userScroll && !cur.userScroll;

      if (idxChanged || layoutArrived || scrollResumed) {
        // Centre the active line in the viewport
        const centredY = cur.layoutY + cur.layoutH * 0.5 - viewportH.value * 0.5;
        const clamped = Math.max(0, centredY);
        targetScrollY.value = withSpring(clamped, SP.SCROLL);
      }
    }
  );

  // Apply the spring-driven target to the actual ScrollView (UI thread)
  useAnimatedReaction(
    () => targetScrollY.value,
    (val) => {
      "worklet";
      if (!isUserScrolling.value) {
        scrollTo(scrollRef, 0, val, false);
      }
    }
  );

  // ── User-scroll guards ───────────────────────────────────────────────────
  const cancelResume = useCallback(() => {
    if (resumeTimer.current) { clearTimeout(resumeTimer.current); resumeTimer.current = null; }
  }, []);

  const scheduleResume = useCallback(() => {
    cancelResume();
    resumeTimer.current = setTimeout(() => {
      isUserScrolling.value = false;
      runOnJS(setShowPaused)(false);
    }, 2000);
  }, [cancelResume]);

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      "worklet";
      isUserScrolling.value = true;
      runOnJS(cancelResume)();
      runOnJS(setShowPaused)(true);
    },
    onEndDrag: () => { "worklet"; runOnJS(scheduleResume)(); },
    onMomentumEnd: () => { "worklet"; runOnJS(scheduleResume)(); },
  });

  // ── Lyric line tap ───────────────────────────────────────────────────────
  //
  // On tap:
  //  1. Optimistically write progressMs (instant highlight, zero bridge lag)
  //  2. Scroll that line to centre (spring, UI thread)
  //  3. Fire native seek() (async, doesn't block UI)
  //
  const handlePress = useCallback((item: LyricLineType, index: number) => {
    if (!isSynced || item.time < 0) return;

    // Optimistic update — highlight moves instantly
    progressMs.value = item.time;
    lastSeekTime.value = Date.now();

    // Scroll the tapped line to viewport centre
    const layout = lineOffsets.value[index];
    if (layout) {
      const centredY = Math.max(0, layout.y + layout.h * 0.5 - viewportH.value * 0.5);
      targetScrollY.value = withSpring(centredY, SP.SCROLL);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isUserScrolling.value = false;
    cancelResume();
    setShowPaused(false);

    // Native seek — doesn't block the touch response above
    usePlayerStore.getState().seek(item.time);
  }, [isSynced, cancelResume, progressMs, lastSeekTime]);

  useEffect(() => () => cancelResume(), [cancelResume]);

  if (!currentTrack) return null;

  // ── Padding strategy ─────────────────────────────────────────────────────
  //
  // paddingTop  = viewportH / 2  →  first lyric can reach viewport centre
  // paddingBottom = viewportH / 2  →  last lyric can reach viewport centre
  //
  // This is identical to how Spotify and YT Music implement it.
  // We use a JS state value derived from onLayout so it's accurate.
  const [vpH, setVpH] = useState(SH * 0.62);

  const onListLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    viewportH.value = h;
    setVpH(h);
  }, []);

  const handleAdjustOffset = useCallback(async (n: number) => {
    if (!currentTrack) return;
    const { getCanonicalTrackId } = require("@/src/features/player/utils/track-identity");
    const AsyncLib = require("@react-native-async-storage/async-storage").default;
    const next = offset + n;
    setOffset(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await AsyncLib.setItem(`cache:lyrics-offset:${getCanonicalTrackId(currentTrack)}`, String(next)); } catch (_) { }
  }, [currentTrack, offset]);

  const handleResetOffset = useCallback(async () => {
    if (!currentTrack) return;
    const { getCanonicalTrackId } = require("@/src/features/player/utils/track-identity");
    const AsyncLib = require("@react-native-async-storage/async-storage").default;
    setOffset(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try { await AsyncLib.removeItem(`cache:lyrics-offset:${getCanonicalTrackId(currentTrack)}`); } catch (_) { }
  }, [currentTrack]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <AmbientBG accent={accent} />
        <PlaybackBridge
          progressMs={progressMs} durationMs={durationMs}
          offset={offset} isScrubbing={isScrubbing} lastSeekTime={lastSeekTime}
        />

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 10,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            accessibilityRole="button" accessibilityLabel="Close lyrics"
          >
            <LiquidGlass r={20} blur={40}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="chevron-down" size={24} color={C.text} />
            </LiquidGlass>
          </TouchableOpacity>

          <View style={{ alignItems: "center", flex: 1, paddingHorizontal: 15 }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: "800", letterSpacing: -0.2 }} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: "500", marginTop: 2 }} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>

          <TouchableOpacity
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              try { await Share.share({ message: `🎵 "${currentTrack.title}" by ${currentTrack.artist}` }); } catch (_) { }
            }}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            accessibilityRole="button" accessibilityLabel="Share"
          >
            <LiquidGlass r={20} blur={40}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="share-outline" size={20} color={C.text} />
            </LiquidGlass>
          </TouchableOpacity>
        </View>

        {/* ── LYRICS LIST ─────────────────────────────────────────────────── */}
        <View style={{ flex: 1 }} onLayout={onListLayout}>
          {/*
            PausedPill sits above the scroll list, positioned relative to this View.
            It never affects layout.
          */}
          <PausedPill visible={showPaused} accent={accent} />

          <Reanimated.ScrollView
            ref={scrollRef}
            contentContainerStyle={
              isLoading || lyrics.length === 0
                ? { flexGrow: 1, alignItems: "center", justifyContent: "center" }
                : {
                  // Half-viewport padding top & bottom so any line can be centred
                  paddingTop: vpH * 0.5,
                  paddingBottom: vpH * 0.5,
                }
            }
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            // Allow manual scrolling (scrollEnabled) but also allow Reanimated to
            // drive it — both work simultaneously via scrollTo() on the UI thread.
            scrollEnabled
          >
            {isLoading ? (
              <View style={{ alignItems: "center" }}>
                <Ionicons name="musical-note" size={32} color={accent} style={{ opacity: 0.5, marginBottom: 12 }} />
                <Text style={{ color: C.muted, fontSize: 14, fontWeight: "600" }}>Loading lyrics…</Text>
              </View>
            ) : lyrics.length === 0 ? (
              <View style={{ alignItems: "center" }}>
                <Ionicons name="musical-notes-outline" size={32} color={accent} style={{ opacity: 0.5, marginBottom: 12 }} />
                <Text style={{ color: C.muted, fontSize: 14, fontWeight: "600" }}>No lyrics available</Text>
              </View>
            ) : (
              lyrics.map((item: LyricLineType, index: number) => (
                <LyricLine
                  key={index}
                  text={item.text}
                  lineIndex={index}
                  activeLineIndex={activeLineIndex}
                  onPress={() => handlePress(item, index)}
                  isSynced={isSynced}
                  accentColor={accent}
                  onLayout={(e: LayoutChangeEvent) => {
                    // Capture absolute y + height for scroll-centering math
                    const { y, height } = e.nativeEvent.layout;
                    const newOffsets = [...lineOffsets.value];
                    newOffsets[index] = { y, h: height };
                    lineOffsets.value = newOffsets;
                  }}
                />
              ))
            )}
          </Reanimated.ScrollView>
        </View>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: insets.bottom + 14 }}>
          <LiquidGlass r={28} blur={50} glowColor={accent} style={{ width: "100%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingBottom: 10 }}>
              {currentTrack.art
                ? <Image source={{ uri: currentTrack.art }} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" transition={200} />
                : <LiquidGlass r={12} blur={30} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="musical-note" size={20} color={accent} />
                </LiquidGlass>
              }
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{currentTrack.artist}</Text>
              </View>
              {isSynced && (
                <TouchableOpacity
                  onPress={() => { setOffsetOpen(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={{ padding: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12 }}
                  accessibilityRole="button" accessibilityLabel="Sync offset"
                >
                  <Ionicons name="options-outline" size={16} color={accent} />
                </TouchableOpacity>
              )}
            </View>

            {offsetOpen
              ? <OffsetControls offset={offset} onAdjust={handleAdjustOffset} onReset={handleResetOffset} />
              : <MinimalProgressBar
                accent={accent}
                progressMs={progressMs}
                durationMs={durationMs}
                isScrubbing={isScrubbing}
                lastSeekTime={lastSeekTime}
              />
            }
          </LiquidGlass>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}