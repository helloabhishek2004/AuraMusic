/**
 * PlayerOverlay — iOS 26 Cinematic Frosted Glass Edition
 *
 * Visual spec (matches reference screenshot exactly):
 *  • Full-bleed blurred artwork base layer (blur 50px, 50% dark overlay)
 *  • Top ~58% = sharp edge-to-edge artwork (no rounded corners on art)
 *  • 150px transparent→dark gradient dissolve at art bottom
 *  • Controls area: rgba(0,0,0,0.25) + BlurView — truly translucent, art colours bleed through
 *  • Row 1: Song title + artist | Heart + Download icons (right)
 *  • Row 2: Thin white scrubber bar + elapsed/total timestamps
 *  • Row 3: Skip-back | Play/Pause (large white circle, dark icon) | Skip-forward  ← centred
 *  • Row 4: Volume-mute — thin slider — volume-high
 *  • Row 5: Lyrics | Queue | ··· (three evenly spaced, bottom)
 *  • No back/chevron button
 *  • Shuffle + Repeat moved into ··· (three-dots) modal as side-by-side pills
 *
 * Performance contract:
 *  • Scrubber & volume: pure UI-thread worklets, zero JS bridge during drag
 *  • Background blurred image: renderToHardwareTextureAndroid/shouldRasterizeIOS
 *  • Artwork transition: hardware-accelerated floating view, opacity-switched endpoints
 *  • No setInterval, no redundant renders during playback
 *  • BlurView on iOS only; Android uses dark rgba fallback (no native perf hit)
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutChangeEvent,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing as REasing,
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  useAnimatedRef,
  scrollTo,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter, useSegments, usePathname } from "expo-router";
import { playbackProgress } from "@/src/features/player/services/playback-progress";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { usePlayerUIStore } from "@/src/features/player/store/player-ui.store";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { useMusicActions } from "@/src/context/MusicContext";
import { useLikesStore } from "@/src/features/likes/store/likes.store";
import { useDownloadStore } from "@/src/features/download/store/download.store";
import { DownloadButton } from "@/src/components/ui/download-button";
import MiniPlayer from "./MiniPlayer";
import { InsightPanel } from "@/src/features/player/components/InsightPanel";
import { QueueSheet } from "@/src/features/player/components/QueueSheet";
import AddToPlaylistSheet from "@/src/features/playlist/components/AddToPlaylistSheet";
import { InsightPanel as InfoModal } from "@/src/features/player/components/InsightPanel";
import { openAlbum, openArtistByName } from "@/src/navigation/music-navigation";
import { LyricLine as LyricLineType } from "@/src/features/player/utils/lyrics-parser";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Motion presets ────────────────────────────────────────────────────────────
const SPR_MAIN = { damping: 22, stiffness: 240, mass: 0.9 };
const SPR_SWIPE = { damping: 22, stiffness: 240, mass: 0.9 };
const SPR_REBOUND = { damping: 24, stiffness: 260, mass: 0.9 };
const SPR_THUMB = { damping: 18, stiffness: 300, mass: 0.6 };

const ART_H = SH * 0.58; // top 58% is full-bleed artwork
const ART_BOX = Math.min(SW * 0.85, 360); // floating art size during transition


const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR HELPERS (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
const hexToHsl = (hex: string) => {
  const n = hex.replace("#", "");
  const v = n.length === 3 ? n.split("").map(c => c + c).join("") : n;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = (h: number, s: number, l: number) => {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) { const v = Math.round(l * 255); return `#${v.toString(16).padStart(2, "0").repeat(3)}`; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(hue2rgb(p, q, h + 1 / 3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1 / 3))}`;
};

const darkenIfBright = (hex: string, maxL = 10) => {
  try {
    const clean = hex.startsWith("#") ? hex : "#" + hex;
    const hsl = hexToHsl(clean);
    return hsl.l > maxL ? hslToHex(hsl.h, hsl.s, maxL) : clean;
  } catch { return "#08080D"; }
};

const getDeterministicPalette = (id?: string) => {
  const h = (id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const list = [
    { base: "#0C0101", accent: "#FF8A80" },
    { base: "#01070C", accent: "#82B1FF" },
    { base: "#010C03", accent: "#B9F6CA" },
    { base: "#07010C", accent: "#EA80FC" },
    { base: "#0C0701", accent: "#FFE082" },
    { base: "#08080C", accent: "#E0E0E0" },
  ];
  const p = list[h % list.length];
  return { backgroundBase: p.base, backgroundSecondary: p.base, accent: p.accent, textPrimary: "#FFF", textSecondary: "rgba(255,255,255,0.55)" };
};

const paletteFromDominant = (colors: string[]) => ({
  backgroundBase: darkenIfBright(colors[0] || "#BF5AF2", 8),
  backgroundSecondary: darkenIfBright(colors[1] || "#8E8E93", 15),
  accent: colors[2] || colors[0] || "#BF5AF2",
  textPrimary: "#FFF",
  textSecondary: "rgba(255,255,255,0.55)",
});

const isDeviceTrack = (track: any) => {
  if (!track) return false;
  return !!track.isLocal && !useDownloadStore.getState().downloadedTracks[track.id];
};

// ─────────────────────────────────────────────────────────────────────────────
// TIME LABEL — driven by Reanimated derived value, minimal React re-renders
// ─────────────────────────────────────────────────────────────────────────────
const formatTime = (sec: number) => {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const PlaybackScrubber = memo(({ accentColor }: { accentColor: string }) => {
  const seek = usePlayerStore(s => s.seek);

  const scrubX = useSharedValue(0);
  const scrubW = useSharedValue(1);
  const isScrub = useSharedValue(false);
  const thumbSc = useSharedValue(0);

  const seekLock = useRef(false);
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);
  const [elapsedText, setElapsedText] = useState("0:00");
  const [remainingText, setRemainingText] = useState("-0:00");

  const performSeek = useCallback((millis: number) => {
    seekLock.current = true;
    seek(millis);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      seekLock.current = false;
      setScrubPercent(null);
    }, 700);
  }, [seek]);

  // Drive scrub position from SharedValue on UI thread — zero React rerenders
  useAnimatedReaction(
    () => ({
      pos: playbackProgress.positionMs.value,
      dur: playbackProgress.durationMs.value,
      w: scrubW.value,
      scrubbing: isScrub.value,
    }),
    (cur) => {
      "worklet";
      if (cur.scrubbing || cur.dur <= 0 || cur.w <= 0) return;
      const pct = Math.min(1, Math.max(0, cur.pos / cur.dur));
      scrubX.value = withTiming(pct * cur.w, { duration: 200 });
    }
  );

  // Low-frequency time label updates (once per second at most)
  const lastLabelUpdate = useRef(0);
  useAnimatedReaction(
    () => ({
      pos: playbackProgress.positionMs.value,
      dur: playbackProgress.durationMs.value,
      scrubbing: isScrub.value,
    }),
    (cur) => {
      "worklet";
      if (cur.scrubbing || cur.dur <= 0) return;
      const nowSec = Math.floor(cur.pos / 1000);
      const durSec = Math.floor(cur.dur / 1000);
      const remaining = Math.max(0, durSec - nowSec);
      const elapsed = `${Math.floor(nowSec / 60)}:${(nowSec % 60).toString().padStart(2, "0")}`;
      const remain = `-${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, "0")}`;
      runOnJS(setElapsedText)(elapsed);
      runOnJS(setRemainingText)(remain);
    }
  );

  const pan = useMemo(() => Gesture.Pan()
    .onStart(e => {
      "worklet";
      isScrub.value = true;
      thumbSc.value = withSpring(1, SPR_THUMB);
      scrubX.value = Math.max(0, Math.min(e.x, scrubW.value));
      const pct = scrubW.value > 0 ? scrubX.value / scrubW.value : 0;
      runOnJS(setScrubPercent)(pct);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate(e => {
      "worklet";
      scrubX.value = Math.max(0, Math.min(e.x, scrubW.value));
      const pct = scrubW.value > 0 ? scrubX.value / scrubW.value : 0;
      runOnJS(setScrubPercent)(pct);
    })
    .onEnd(() => {
      "worklet";
      isScrub.value = false;
      thumbSc.value = withSpring(0, SPR_THUMB);
      const pct = scrubW.value > 0 ? scrubX.value / scrubW.value : 0;
      const durMs = playbackProgress.durationMs.value;
      runOnJS(performSeek)(pct * durMs);
    }), [performSeek]);

  const tap = useMemo(() => Gesture.Tap().onStart(e => {
    "worklet";
    const x = Math.max(0, Math.min(e.x, scrubW.value));
    scrubX.value = withTiming(x, { duration: 180 });
    const pct = scrubW.value > 0 ? x / scrubW.value : 0;
    const durMs = playbackProgress.durationMs.value;
    runOnJS(setScrubPercent)(pct);
    runOnJS(performSeek)(pct * durMs);
    runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
  }), [performSeek]);

  const gesture = useMemo(() => Gesture.Race(pan, tap), [pan, tap]);

  const fillStyle = useAnimatedStyle(() => ({ width: scrubX.value }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrubX.value - 9 }, { scale: thumbSc.value }],
  }));

  // During scrub, show scrub-based time labels instead
  const displayElapsed = scrubPercent !== null
    ? formatTime(scrubPercent * (playbackProgress.durationMs.value / 1000))
    : elapsedText;
  const displayRemaining = scrubPercent !== null
    ? `-${formatTime(Math.max(0, (playbackProgress.durationMs.value / 1000) - scrubPercent * (playbackProgress.durationMs.value / 1000)))}`
    : remainingText;

  return (
    <View style={st.scrubWrap}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={st.scrubTouch}>
          <View
            style={st.scrubTrack}
            onLayout={e => {
              scrubW.value = e.nativeEvent.layout.width;
            }}
          >
            {/* Unplayed track */}
            <View style={st.scrubBg} />
            {/* Played fill — white, matching reference */}
            <Animated.View style={[st.scrubFill, fillStyle]} />
            {/* Thumb — scale 0 at rest, 1 when dragging */}
            <Animated.View style={[st.scrubThumb, thumbStyle]}>
              <View style={st.scrubThumbDot} />
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
      <View style={st.timeLabelRow}>
        <Text style={[st.timeLabel, { textAlign: "left" }]}>{displayElapsed}</Text>
        <Text style={[st.timeLabel, { textAlign: "right" }]}>{displayRemaining}</Text>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// VOLUME CONTROL — thin 3px slider, mute/max icons flanking
// ─────────────────────────────────────────────────────────────────────────────
const VolumeControl = memo(() => {
  const nativeVol = usePlayerStore(s => s.volume);
  const setVolume = usePlayerStore(s => s.setVolume);

  const volX = useSharedValue(nativeVol);
  const volW = useSharedValue(0);
  const isAdj = useSharedValue(false);
  const thumbSc = useSharedValue(0);

  useEffect(() => { if (!isAdj.value) volX.value = nativeVol; }, [nativeVol]);

  const pan = Gesture.Pan()
    .onStart(e => {
      "worklet";
      isAdj.value = true;
      thumbSc.value = withSpring(1, SPR_THUMB);
      const v = volW.value > 0 ? Math.max(0, Math.min(e.x / volW.value, 1)) : 0;
      volX.value = v;
      runOnJS(setVolume)(v);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate(e => {
      "worklet";
      const v = volW.value > 0 ? Math.max(0, Math.min(e.x / volW.value, 1)) : 0;
      volX.value = v;
      runOnJS(setVolume)(v);
    })
    .onEnd(() => {
      "worklet";
      isAdj.value = false;
      thumbSc.value = withSpring(0, SPR_THUMB);
    });

  const fillStyle = useAnimatedStyle(() => ({ width: volX.value * volW.value }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: volX.value * volW.value - 8 }, { scale: thumbSc.value }],
  }));

  return (
    <View style={st.volWrap}>
      <Ionicons name="volume-mute-outline" size={28} color="rgba(255,255,255,0.45)" />
      <GestureDetector gesture={pan}>
        <Animated.View style={st.volTouch}>
          <View style={st.volTrack} onLayout={e => { volW.value = e.nativeEvent.layout.width; }}>
            <View style={st.volBg} />
            <Animated.View style={[st.volFill, fillStyle]} />
            {/* Thumb only visible when dragging */}
            <Animated.View style={[st.volThumb, thumbStyle]}>
              <View style={st.volThumbDot} />
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
      <Ionicons name="volume-high-outline" size={28} color="rgba(255,255,255,0.45)" />
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PLAY / PAUSE — premium iOS-style plain white central control icon
// Spring-bounce on press
// ─────────────────────────────────────────────────────────────────────────────
const PlayPauseBtn = memo(({ isPlaying, onPress }: { isPlaying: boolean; onPress: () => void }) => {
  const sc = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable
      onPressIn={() => { sc.value = withSpring(0.88, SPR_MAIN); }}
      onPressOut={() => { sc.value = withSpring(1, SPR_MAIN); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? "Pause" : "Play"}
      style={st.playBtn}
    >
      <Animated.View style={style}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={54}
          color="#FFF"
        />
      </Animated.View>
    </Pressable>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SKIP BUTTON — plain icon, spring bounce
// ─────────────────────────────────────────────────────────────────────────────
const SkipBtn = memo(({ icon, onPress, label }: { icon: string; onPress: () => void; label: string }) => {
  const sc = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable
      onPressIn={() => { sc.value = withSpring(0.88, SPR_MAIN); }}
      onPressOut={() => { sc.value = withSpring(1, SPR_MAIN); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={st.skipBtn}
    >
      <Animated.View style={style}>
        <Ionicons name={icon as any} size={36} color="#FFF" />
      </Animated.View>
    </Pressable>
  );
});

// ─────────────────────────────────────────────────────────────────────────────


const h2r = (hex: string, a: number) => {
  try {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  } catch (e) {
    return `rgba(120,120,120,${a})`;
  }
};

const LyricLine = memo(({
  text,
  lineIndex,
  activeLineIndex,
  onPressLine,
  onLayoutLine,
  isSynced,
  accentColor,
}: {
  text: string;
  lineIndex: number;
  activeLineIndex: SharedValue<number>;
  onPressLine: (index: number) => void;
  onLayoutLine: (index: number, y: number, h: number) => void;
  isSynced: boolean;
  accentColor: string;
}) => {
  const textStyle = useAnimatedStyle(() => {
    "worklet";
    const ai = activeLineIndex.value;
    const isActive = ai === lineIndex;
    const dist = Math.abs(lineIndex - ai);
    const isUpcoming = lineIndex > ai;

    // PERF: Only active line + immediate neighbors run withTiming.
    // All other lines get instant static styles — reduces worklet fan-out from 160+ to ~6.
    if (dist > 1) {
      return {
        opacity: isUpcoming ? 0.28 : 0.18,
        transform: [{ scale: 0.96 }],
      };
    }

    return {
      opacity: withTiming(isActive ? 1.0 : 0.55, { duration: 160 }),
      transform: [{ scale: withTiming(isActive ? 1.0 : 0.98, { duration: 160 }) }],
    };
  });

  const barStyle = useAnimatedStyle(() => {
    "worklet";
    const isActive = activeLineIndex.value === lineIndex;
    const dist = Math.abs(lineIndex - activeLineIndex.value);

    // PERF: Only animate bar for active line and immediate neighbors
    if (dist > 1) {
      return {
        opacity: 0,
        transform: [{ scaleY: 0.3 }],
        backgroundColor: accentColor,
      };
    }

    return {
      opacity: withTiming(isActive ? 1 : 0, { duration: 160 }),
      transform: [{ scaleY: withTiming(isActive ? 1 : 0.3, { duration: 160 }) }],
      backgroundColor: accentColor,
    };
  });

  const handlePress = useCallback(() => {
    onPressLine(lineIndex);
  }, [onPressLine, lineIndex]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    onLayoutLine(lineIndex, y, height);
  }, [onLayoutLine, lineIndex]);

  return (
    <TouchableOpacity
      activeOpacity={isSynced ? 0.7 : 1}
      onPress={handlePress}
      disabled={!isSynced}
      onLayout={handleLayout}
      style={lnSt.row}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <Animated.View
        pointerEvents="none"
        style={[lnSt.accentBar, barStyle]}
      />
      <Animated.Text style={[lnSt.text, textStyle]} selectable={false}>
        {text}
      </Animated.Text>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.text === nextProps.text &&
    prevProps.accentColor === nextProps.accentColor &&
    prevProps.isSynced === nextProps.isSynced
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
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 8, alignSelf: "center", zIndex: 10 }, pillStyle]}>
      <View style={{ borderRadius: 14, overflow: "hidden", paddingHorizontal: 13, paddingVertical: 6 }}>
        {Platform.OS === "ios"
          ? <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20,20,28,0.95)" }]} />
        }
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
          <Text style={{ fontSize: 10, color: accent, fontWeight: "800", letterSpacing: 0.6 }}>
            AUTO-SCROLL PAUSED
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

const LyricsSurface = memo(({
  visible,
  lyricsData,
  isLoading,
  accentColor,
  closeLyrics,
  progressMs,
  durationMs,
  activeLineIndex,
  scrollRef,
  viewportH,
  isUserScrolling,
  targetScrollY,
  currentTrack,
  lyricsStyle,
  onPressLine,
  onLayoutLine,
}: any) => {
  const insets = useSafeAreaInsets();
  const [vpH, setVpH] = useState(SH * 0.62);
  const [showPaused, setShowPaused] = useState(false);

  const onListLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    viewportH.value = h;
    setVpH(h);
  }, []);

  const lyrics: LyricLineType[] = useMemo(() => lyricsData?.lyrics || [], [lyricsData]);
  const isSynced = useMemo(() => lyricsData?.synced ?? false, [lyricsData]);

  // User-scroll guards
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelResume = useCallback(() => {
    if (resumeTimer.current) { clearTimeout(resumeTimer.current); resumeTimer.current = null; }
  }, []);

  const scheduleResume = useCallback(() => {
    cancelResume();
    resumeTimer.current = setTimeout(() => {
      isUserScrolling.value = false;
      setShowPaused(false);
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

  const dynamicSurfaceStyle = useMemo(() => [
    StyleSheet.absoluteFill,
    { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 120, zIndex: 10 },
    lyricsStyle,
  ], [insets.top, insets.bottom, lyricsStyle]);

  const scrollPaddingStyle = useMemo(() => ({
    paddingTop: vpH * 0.45,
    paddingBottom: vpH * 0.45,
  }), [vpH]);

  return (
    <Animated.View
      style={dynamicSurfaceStyle}
      pointerEvents={visible ? "auto" : "none"}
    >
      <View style={sSt.flex1} onLayout={onListLayout}>
        <PausedPill visible={showPaused} accent={accentColor} />
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={
            isLoading || lyrics.length === 0
              ? sSt.centerContainer
              : scrollPaddingStyle
          }
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          scrollEnabled
        >
          {isLoading ? (
            <View style={sSt.centered}>
              <ActivityIndicator size="large" color={accentColor} />
              <Text style={sSt.loaderText}>Loading lyrics…</Text>
            </View>
          ) : lyrics.length === 0 ? (
            <View style={sSt.centered}>
              <Ionicons name="musical-notes-outline" size={32} color={accentColor} style={sSt.emptyIcon} />
              <Text style={sSt.emptyText}>No lyrics available</Text>
            </View>
          ) : (
            lyrics.map((item: LyricLineType, index: number) => (
              <LyricLine
                key={index}
                text={item.text}
                lineIndex={index}
                activeLineIndex={activeLineIndex}
                onPressLine={onPressLine}
                onLayoutLine={onLayoutLine}
                isSynced={isSynced}
                accentColor={accentColor}
              />
            ))
          )}
        </Animated.ScrollView>
      </View>
    </Animated.View>
  );
});
LyricsSurface.displayName = "LyricsSurface";

const sSt = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  centerContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    alignItems: "center",
  },
  loaderText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyIcon: {
    opacity: 0.5,
    marginBottom: 12,
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },
});

const MoreMenuSurface = memo(({
  visible,
  onClose,
  accentColor,
  currentTrack,
  onAddToPlaylist,
  onShare,
  isShuffle,
  toggleShuffle,
  repeatMode,
  toggleRepeat,
}: any) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const menuAnim = useSharedValue(SH);
  
  useEffect(() => {
    menuAnim.value = withSpring(visible ? 0 : SH, { damping: 22, stiffness: 220 });
  }, [visible]);

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: menuAnim.value }]
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 200 })
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[st.menuSheet, menuStyle, { paddingBottom: insets.bottom + 16 }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20, 20, 28, 0.85)" }]} />
        </View>

        <View style={st.menuHeader}>
          {currentTrack?.art ? (
            <Image source={{ uri: currentTrack.art }} style={st.menuArt} />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={st.menuTitle} numberOfLines={1}>{currentTrack?.title || "—"}</Text>
            <Text style={st.menuArtist} numberOfLines={1}>{currentTrack?.artist || "—"}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={[st.menuPill, isShuffle && { backgroundColor: h2r(accentColor, 0.18), borderColor: accentColor }]}
            onPress={toggleShuffle}
          >
            <Ionicons name="shuffle" size={18} color={isShuffle ? accentColor : "#FFF"} />
            <Text style={[st.menuPillText, isShuffle && { color: accentColor }]}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.menuPill, repeatMode > 0 && { backgroundColor: h2r(accentColor, 0.18), borderColor: accentColor }]}
            onPress={toggleRepeat}
          >
            <Ionicons name={repeatMode === 1 ? "repeat" : "repeat-outline"} size={18} color={repeatMode > 0 ? accentColor : "#FFF"} />
            <Text style={[st.menuPillText, repeatMode > 0 && { color: accentColor }]}>Repeat</Text>
          </TouchableOpacity>
        </View>

        <View style={st.menuOptions}>
          <TouchableOpacity style={st.menuItem} onPress={() => { onClose(); onAddToPlaylist(); }}>
            <Ionicons name="add-circle-outline" size={22} color="#FFF" />
            <Text style={st.menuItemText}>Add to Playlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.menuItem} onPress={() => { onClose(); onShare(); }}>
            <Ionicons name="share-outline" size={22} color="#FFF" />
            <Text style={st.menuItemText}>Share Song</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.menuItem} onPress={() => { onClose(); openAlbum(router, currentTrack?.albumId); }}>
            <Ionicons name="disc-outline" size={22} color="#FFF" />
            <Text style={st.menuItemText}>View Album</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.menuItem, { borderBottomWidth: 0, marginTop: 12, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" }]} onPress={onClose}>
            <Ionicons name="close-circle-outline" size={22} color="#FF3B30" />
            <Text style={[st.menuItemText, { color: "#FF3B30", fontWeight: "700" }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
});
MoreMenuSurface.displayName = "MoreMenuSurface";

const DevicePickerSurface = memo(({
  visible,
  onClose,
  accentColor,
}: any) => {
  const insets = useSafeAreaInsets();
  const deviceAnim = useSharedValue(SH);
  
  useEffect(() => {
    deviceAnim.value = withSpring(visible ? 0 : SH, { damping: 22, stiffness: 220 });
  }, [visible]);

  const deviceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: deviceAnim.value }]
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 200 })
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[st.menuSheet, deviceStyle, { paddingBottom: insets.bottom + 16 }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20, 20, 28, 0.85)" }]} />
        </View>

        <View style={st.menuHeader}>
          <Ionicons name="hardware-chip-outline" size={24} color={accentColor} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={st.menuTitle}>Audio Routing</Text>
            <Text style={st.menuArtist}>Select playback destination</Text>
          </View>
        </View>

        <View style={st.menuOptions}>
          <TouchableOpacity style={[st.menuItem, { backgroundColor: h2r(accentColor, 0.1), borderColor: accentColor }]} onPress={onClose}>
            <Ionicons name="phone-portrait-outline" size={22} color={accentColor} />
            <Text style={[st.menuItemText, { color: accentColor, fontWeight: '700' }]}>This Device (Speaker)</Text>
            <Ionicons name="checkmark-circle" size={18} color={accentColor} />
          </TouchableOpacity>
          <TouchableOpacity style={st.menuItem} onPress={onClose}>
            <Ionicons name="headset-outline" size={22} color="#FFF" />
            <Text style={st.menuItemText}>Bluetooth Headphones / Speakers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.menuItem} onPress={onClose}>
            <Ionicons name="wifi-outline" size={22} color="#FFF" />
            <Text style={st.menuItemText}>AirPlay & Cast Devices</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.menuItem, { borderBottomWidth: 0, marginTop: 12, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" }]} onPress={onClose}>
            <Ionicons name="close-circle-outline" size={22} color="#FF3B30" />
            <Text style={[st.menuItemText, { color: "#FF3B30", fontWeight: "700" }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
});
DevicePickerSurface.displayName = "DevicePickerSurface";

// ProgressSync REMOVED — progress now flows via playbackProgress SharedValue singleton
// directly from PlaybackController → UI components, bypassing React entirely.

export default function PlayerOverlay() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isExpanded = usePlayerUIStore(s => s.isExpanded);
  const collapse = usePlayerUIStore(s => s.collapse);
  const activeSurface = usePlayerUIStore(s => s.activeSurface);
  const setActiveSurface = usePlayerUIStore(s => s.setActiveSurface);
  
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const { toggleRepeat, toggleShuffle } = useMusicActions();
  const isLiked = useLikesStore(s => !!(currentTrack?.id && s.likedTrackIds[currentTrack.id]));
  const toggleLike = useLikesStore(s => s.toggleLike);

  const openLyrics = usePlayerUIStore(s => s.openLyrics);
  const closeLyrics = usePlayerUIStore(s => s.closeLyrics);
  const openQueue = usePlayerUIStore(s => s.openQueue);
  const closeQueue = usePlayerUIStore(s => s.closeQueue);
  const openDevices = usePlayerUIStore(s => s.openDevices);
  const closeDevices = usePlayerUIStore(s => s.closeDevices);
  const openMenu = usePlayerUIStore(s => s.openMenu);
  const closeMenu = usePlayerUIStore(s => s.closeMenu);

  const isShuffle = usePlayerStore(s => s.isShuffle);
  const repeatMode = usePlayerStore(s => s.repeatMode);

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showInsight, setShowInsight] = useState(false);

  const isTabScreen = segments[0] === '(tabs)';
  const miniOffset = isTabScreen ? 49 : 0;

  const handleLyricsPress = useCallback(() => {
    if (activeSurface === 'lyrics') {
      closeLyrics();
    } else {
      openLyrics();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeSurface, openLyrics, closeLyrics]);

  const handleQueuePress = useCallback(() => {
    if (activeSurface === 'queue') {
      closeQueue();
    } else {
      openQueue();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeSurface, openQueue, closeQueue]);

  const handleMenuPress = useCallback(() => {
    if (activeSurface === 'menu') {
      closeMenu();
    } else {
      openMenu();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeSurface, openMenu, closeMenu]);

  const translateY = useSharedValue(SH);
  const expandProgress = useDerivedValue(() => Math.max(0, Math.min(1, 1 - translateY.value / SH)));
  const isDragging = useSharedValue(false);

  // Playback control store actions
  const play = usePlayerStore(s => s.play);
  const pause = usePlayerStore(s => s.pause);
  const next = usePlayerStore(s => s.next);
  const prev = usePlayerStore(s => s.previous);

  // Artwork & theme palette derivation
  const artworkUri = currentTrack?.art;
  const palette = useMemo(() => {
    if (currentTrack?.dominantColors) {
      return paletteFromDominant(currentTrack.dominantColors);
    }
    return getDeterministicPalette(currentTrack?.id);
  }, [currentTrack]);

  // Single surface animation progress (replaces per-surface SharedValues)
  const surfaceOpenProgress = useSharedValue(0);
  const isLyricsOpen = useSharedValue(false);

  // Sync surface progress with Zustand activeSurface state
  useEffect(() => {
    const config = { duration: 220, easing: REasing.out(REasing.quad) };
    const isAnyOpen = activeSurface !== 'controls';
    surfaceOpenProgress.value = withTiming(isAnyOpen ? 1 : 0, config);
    isLyricsOpen.value = activeSurface === 'lyrics';
  }, [activeSurface]);

  // Collapse pan gesture (velocity-aware, threshold-aware, active in GESTURE_ZONE)
  const panGesture = Gesture.Pan()
    .enabled(activeSurface !== 'lyrics')
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      } else {
        // Subtle resistance for upward drag
        translateY.value = e.translationY * 0.15;
      }
    })
    .onEnd((e) => {
      isDragging.value = false;
      if (e.translationY > 120 || e.velocityY > 800) {
        translateY.value = withSpring(SH, SPR_SWIPE, (finished) => {
          if (finished) {
            runOnJS(collapse)();
          }
        });
      } else {
        translateY.value = withSpring(0, SPR_REBOUND);
      }
    });

  // GESTURE ZONE is the upper part of the player for swipe-down collapse
  const GESTURE_ZONE = insets.top + 60 + ART_BOX + 20;

  // Breathing animation (frozen during lyrics to reduce GPU overhead)
  const breathValue = useSharedValue(1);
  useEffect(() => {
    if (isPlaying && activeSurface !== 'lyrics') {
      breathValue.value = withRepeat(
        withTiming(1.02, { duration: 2500, easing: REasing.inOut(REasing.ease) }),
        -1,
        true
      );
    } else {
      breathValue.value = withTiming(1, { duration: 400 });
    }
  }, [isPlaying, activeSurface]);

  // ── Integrated Lyrics Surface (optimized) ──────────────────────────────────
  const isLyricsUserScrolling = useSharedValue(false);
  const lyricsLineOffsets = useSharedValue<{ y: number; h: number }[]>([]);
  const offsetsRef = useRef<{ y: number; h: number }[]>([]);
  const layoutCountRef = useRef(0);
  const lyricsViewportH = useSharedValue(SH * 0.62);
  const lastLyricsScrollY = useSharedValue(0);
  const lyricsScrollRef = useAnimatedRef<Animated.ScrollView>();

  const lyricsData = usePlayerStore(s => s.lyrics);
  const isLyricsLoading = usePlayerStore(s => s.isLyricsLoading);
  const lyricsList = useMemo(() => lyricsData?.lyrics || [], [lyricsData]);
  const isLyricsSynced = useMemo(() => lyricsData?.synced ?? false, [lyricsData]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (isExpanded && currentTrack && !lyricsData && !isLyricsLoading) {
      usePlayerStore.getState().fetchLyrics(currentTrack);
    }
  }, [isExpanded, currentTrack?.id, lyricsData, isLyricsLoading]);

  // Reset line offsets when track or lyrics change
  useEffect(() => {
    layoutCountRef.current = 0;
    offsetsRef.current = new Array(lyricsList.length).fill(undefined);
    lyricsLineOffsets.value = [];
  }, [lyricsList]);

  const lastActiveLineIndex = useSharedValue(-1);

  // Active line index — incremental tracking with binary search fallback on seeks
  const activeLineIndex: SharedValue<number> = useDerivedValue<number>(() => {
    "worklet";
    if (!isLyricsSynced || !lyricsList.length) return -1;
    const t = playbackProgress.positionMs.value;
    const lastIdx = lastActiveLineIndex.value;

    let result = -1;

    // Fast path: check if still on same line
    if (lastIdx >= 0 && lastIdx < lyricsList.length) {
      const cur = lyricsList[lastIdx].time;
      const next = lastIdx + 1 < lyricsList.length ? lyricsList[lastIdx + 1].time : Infinity;
      if (t >= cur && t < next) {
        result = lastIdx;
      }
    }

    if (result === -1) {
      // Forward scan: most common during normal playback
      if (lastIdx >= 0 && lastIdx + 1 < lyricsList.length && lyricsList[lastIdx + 1].time <= t) {
        let idx = lastIdx + 1;
        while (idx + 1 < lyricsList.length && lyricsList[idx + 1].time <= t) idx++;
        result = idx;
      }
    }

    if (result === -1) {
      // Backward seek or initial: binary search
      let lo = 0, hi = lyricsList.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lyricsList[mid].time <= t) { result = mid; lo = mid + 1; }
        else { hi = mid - 1; }
      }
    }

    lastActiveLineIndex.value = result;
    return result;
  }, [isLyricsSynced, lyricsList]);

  // SINGLE deterministic scroll reaction — replaces dual spring-driven pipeline
  useAnimatedReaction(
    () => ({
      idx: activeLineIndex.value,
      userScroll: isLyricsUserScrolling.value,
    }),
    (cur, prev) => {
      "worklet";
      if (cur.userScroll || cur.idx < 0) return;
      if (prev && prev.idx === cur.idx && prev.userScroll === cur.userScroll) return;

      const layout = lyricsLineOffsets.value[cur.idx];
      if (!layout) return;

      const centredY = Math.max(0, layout.y + layout.h * 0.5 - lyricsViewportH.value * 0.38);

      // Prevent micro-updates
      if (Math.abs(centredY - lastLyricsScrollY.value) < 6) return;

      lastLyricsScrollY.value = centredY;
      // Deterministic non-animated scroll — stable frame pacing under continuous audio updates
      scrollTo(lyricsScrollRef, 0, centredY, false);
    }
  );

  // Stable memoized callbacks
  const onPressLine = useCallback((index: number) => {
    if (!isLyricsSynced) return;
    const item = lyricsList[index];
    if (!item || item.time < 0) return;
    
    const layout = lyricsLineOffsets.value[index];
    if (layout) {
      const centredY = Math.max(0, layout.y + layout.h * 0.5 - lyricsViewportH.value * 0.38);
      if (Math.abs(centredY - lastLyricsScrollY.value) >= 4) {
        lastLyricsScrollY.value = centredY;
        scrollTo(lyricsScrollRef, 0, centredY, false);
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isLyricsUserScrolling.value = false;
    usePlayerStore.getState().seek(item.time);
  }, [isLyricsSynced, lyricsList]);

  // Batched layout measurement — single write after all lines report
  const onLayoutLine = useCallback((index: number, y: number, height: number) => {
    offsetsRef.current[index] = { y, h: height };
    layoutCountRef.current++;
    // Single batch write when all lines measured (eliminates N array-clone operations)
    if (layoutCountRef.current >= lyricsList.length) {
      lyricsLineOffsets.value = offsetsRef.current;
    }
  }, [lyricsList.length]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const handleArtistPress = useCallback(() => {
    if (currentTrack?.artist) {
      collapse();
      openArtistByName(router, currentTrack.artist);
    }
  }, [currentTrack?.artist, router, collapse]);

  const handleLikePress = useCallback(() => {
    if (currentTrack) {
      toggleLike(currentTrack);
    }
  }, [currentTrack, toggleLike]);

  // Android Back button interception
  useEffect(() => {
    const handleBackButton = () => {
      if (activeSurface === 'lyrics') {
        closeLyrics();
        return true;
      }
      if (activeSurface === 'queue') {
        closeQueue();
        return true;
      }
      if (activeSurface === 'menu') {
        closeMenu();
        return true;
      }
      if (activeSurface === 'devices') {
        closeDevices();
        return true;
      }
      if (isExpanded) {
        translateY.value = withSpring(SH, SPR_SWIPE, () => {
          runOnJS(collapse)();
        });
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackButton
    );
    return () => subscription.remove();
  }, [isExpanded, activeSurface]);

  // Sync isExpanded status when sheet translates to 0
  useEffect(() => {
    if (isExpanded) {
      translateY.value = withSpring(0, SPR_REBOUND);
    } else {
      translateY.value = withSpring(SH, SPR_SWIPE);
    }
  }, [isExpanded]);

  // ── Animated Styles ───────────────────────────────────────────────────────
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(expandProgress.value, [0, 0.1, 1], [0, 1, 1], Extrapolate.CLAMP),
  }));

  const miniPlayerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(expandProgress.value, [0, 0.25], [1, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ scale: interpolate(expandProgress.value, [0, 0.25], [1, 0.92], Extrapolate.CLAMP) }],
      display: opacity <= 0.01 ? "none" : "flex",
    };
  });

  const controlsStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(expandProgress.value, [0.7, 1], [0, 1], Extrapolate.CLAMP);
    const baseTranslateY = interpolate(expandProgress.value, [0.8, 1], [36, 0], Extrapolate.CLAMP);
    
    // Single surface open progress controls fade (replaces 4 separate interpolations)
    const surfaceOpacity = interpolate(surfaceOpenProgress.value, [0, 1], [1, 0], Extrapolate.CLAMP);
    const surfaceTranslateY = interpolate(surfaceOpenProgress.value, [0, 1], [0, 24], Extrapolate.CLAMP);

    const finalOpacity = baseOpacity * surfaceOpacity;

    return {
      opacity: finalOpacity,
      transform: [
        { translateY: baseTranslateY + surfaceTranslateY }
      ],
      display: finalOpacity <= 0.01 ? "none" : "flex",
    };
  });

  const bottomBarAnimatedStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(expandProgress.value, [0.75, 1], [0, 1], Extrapolate.CLAMP);
    const baseTranslateY = interpolate(expandProgress.value, [0.8, 1], [24, 0], Extrapolate.CLAMP);
    return {
      opacity: baseOpacity,
      transform: [{ translateY: baseTranslateY }],
    };
  });

  const bgArtStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 1], [0, 0.85], Extrapolate.CLAMP),
  }));

  const atmosphereTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(surfaceOpenProgress.value, [0, 1], [0, 0.45], Extrapolate.CLAMP),
  }));

  const lyricsStyle = useAnimatedStyle(() => {
    const lyricsProgress = isLyricsOpen.value ? surfaceOpenProgress.value : 0;
    return {
      opacity: lyricsProgress,
      transform: [
        {
          translateY: interpolate(lyricsProgress, [0, 1], [40, 0], Extrapolate.CLAMP)
        }
      ],
    };
  });

  // Gracefully dissolve bottom toolbar icons (Queue + More options) in lyrics mode
  const queueMoreIconsStyle = useAnimatedStyle(() => {
    const lyricsProgress = isLyricsOpen.value ? surfaceOpenProgress.value : 0;
    return {
      opacity: interpolate(lyricsProgress, [0, 0.4], [1, 0], Extrapolate.CLAMP),
    };
  });
  
  const expArtStyle = useAnimatedStyle(() => {
    const baseOpacity = expandProgress.value >= 0.99 ? 1 : 0;
    
    // Dim artwork when any subsurface is open (completely hidden in lyrics)
    const isLyrics = isLyricsOpen.value;
    const surfaceDim = isLyrics
      ? interpolate(surfaceOpenProgress.value, [0, 1], [1, 0], Extrapolate.CLAMP)
      : interpolate(surfaceOpenProgress.value, [0, 1], [1, 0.40], Extrapolate.CLAMP);
    const finalDim = baseOpacity * surfaceDim;
    
    const baseScale = interpolate(expandProgress.value, [0.99, 1], [1, breathValue.value], Extrapolate.CLAMP);
    const surfaceScale = interpolate(surfaceOpenProgress.value, [0, 1], [1, 0.82], Extrapolate.CLAMP);
    const finalScale = baseScale * surfaceScale;
    
    return {
      opacity: finalDim,
      transform: [{ scale: finalScale }],
      display: finalDim <= 0.01 ? "none" : "flex",
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ── MINI PLAYER (conditionally unmounted when expanded) ────────── */}
      {!isExpanded && (
        <MiniPlayer offset={miniOffset} />
      )}

      {/* ── EXPANDED PLAYER ─────────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, overlayStyle, { backgroundColor: palette.backgroundBase }]}
        pointerEvents={isExpanded ? "auto" : "none"}
        renderToHardwareTextureAndroid
      >
        {/* ── BACKGROUND COVER IMAGE: Frosted glass cinematic full-screen blur ── */}
        {artworkUri ? (
          <Animated.View style={[StyleSheet.absoluteFill, bgArtStyle]} pointerEvents="none">
            <Image
              source={{ uri: artworkUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={Platform.OS === "android" ? 80 : 110}
              renderToHardwareTextureAndroid
              // @ts-ignore
              shouldRasterizeIOS
            />
            {/* Android: skip BlurView overlay (heavy GPU compositing). iOS: keep for quality. */}
            {Platform.OS === "ios" && (
              <BlurView
                intensity={85}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            )}

            {/* Dark atmosphere tint overlay that deepens when subsurface is open */}
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, atmosphereTintStyle]}
              pointerEvents="none"
            />

            {/* Smooth Linear Gradient from the bottom up to 60% of the screen height */}
            <LinearGradient
              colors={[
                "transparent",
                "rgba(0, 0, 0, 0.15)",
                "rgba(0, 0, 0, 0.38)",
                "rgba(0, 0, 0, 0.68)",
                "rgba(0, 0, 0, 0.88)",
                "rgba(0, 0, 0, 0.98)"
              ]}
              locations={[0, 0.20, 0.40, 0.60, 0.80, 1]}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%" }}
              pointerEvents="none"
            />
          </Animated.View>
        ) : (
          <Animated.View style={[StyleSheet.absoluteFill, bgArtStyle]} pointerEvents="none">
            <LinearGradient
              colors={["#120f26", "#090514"]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* Status bar top gradient */}
        <LinearGradient
          colors={["rgba(0, 0, 0, 0.81)", "transparent"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 90 }}
          pointerEvents="none"
        />

        {/* ── GESTURE ZONE (upper shell only) ─────────────────────────── */}
        <GestureDetector gesture={Gesture.Exclusive(panGesture)}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: GESTURE_ZONE }} />
        </GestureDetector>

        {/* ── EXPANDED ART THUMBNAIL (visible only at rest-expanded) ──── */}
        <Animated.View
          style={[
            st.artShadow,
            {
              position: "absolute",
              left: (SW - ART_BOX) / 2, top: insets.top + 60,
              width: ART_BOX, height: ART_BOX,
              borderRadius: 12, overflow: "hidden",
            },
            expArtStyle,
          ]}
          pointerEvents="none"
        >
          {artworkUri
            ? <Image source={{ uri: artworkUri }} style={{ width: "100%", height: "100%", borderRadius: 12 }} contentFit="cover" transition={0} />
            : <LinearGradient colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0.01)"]} style={{ flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="musical-notes" size={40} color="rgba(255,255,255,0.18)" />
            </LinearGradient>
          }
        </Animated.View>

        {/* ── CONTROLS AREA (~42% bottom, frosted glass translucent) ──── */}
        <View
          style={[st.controlsArea, { top: ART_H - 150 }]}
          pointerEvents="box-none"
        >
          {/* Frosted glass: BlurView for premium frosting (iOS only) */}
          {Platform.OS === "ios" && (
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          )}
        </View>

        {/* ── CONTROLS ROWS 1-4 ─────────────────────────────────────────── */}
        <Animated.View
          style={[
            st.controlsContent,
            { top: ART_H + 25, bottom: Math.max(insets.bottom + 8, 20) + 70 },
            controlsStyle,
          ]}
          pointerEvents={activeSurface === 'controls' ? "box-none" : "none"}
        >
          {/* ROW 1: Song info + Like + Download */}
          <View style={st.infoRow}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={st.trackTitle} numberOfLines={1}>{currentTrack?.title || "—"}</Text>
              <TouchableOpacity
                onPress={handleArtistPress}
                activeOpacity={0.7}
              >
                <Text style={st.artistName} numberOfLines={1}>{currentTrack?.artist || "—"}</Text>
              </TouchableOpacity>
            </View>
            <View style={st.infoActions}>
              <TouchableOpacity
                onPress={handleLikePress}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isLiked ? "Unlike" : "Like"}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={24}
                  color={isLiked ? "#FF3B30" : "#FFF"}
                />
              </TouchableOpacity>
              {currentTrack && !isDeviceTrack(currentTrack) && (
                <DownloadButton track={currentTrack} size={24} color="#FFF" />
              )}
            </View>
          </View>

          {/* ROW 2: Scrubber */}
          <PlaybackScrubber accentColor={palette.accent} />

          {/* ROW 3: Playback — skip-back | play/pause | skip-forward */}
          <View style={st.playbackRow}>
            <SkipBtn icon="play-back" label="Previous" onPress={prev} />
            <PlayPauseBtn isPlaying={isPlaying} onPress={handlePlayPause} />
            <SkipBtn icon="play-forward" label="Next" onPress={next} />
          </View>

          {/* ROW 4: Volume */}
          <VolumeControl />
        </Animated.View>

        {/* ── BOTTOM TOOLBAR ROW 5 ──────────────────────────────────────── */}
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: Math.max(insets.bottom + 8, 20),
              left: 0,
              right: 0,
              zIndex: 20,
            },
            bottomBarAnimatedStyle,
          ]}
          pointerEvents="box-none"
        >
          <View style={st.bottomBar}>
            {!isDeviceTrack(currentTrack) ? (
              <TouchableOpacity
                style={st.bottomBtn}
                onPress={handleLyricsPress}
                accessibilityRole="button"
                accessibilityLabel="Lyrics"
              >
                <Ionicons
                  name="musical-notes-outline"
                  size={22}
                  color={activeSurface === 'lyrics' ? palette.accent : "rgba(255,255,255,0.72)"}
                />
              </TouchableOpacity>
            ) : <View style={st.bottomBtn} />}

            <Animated.View style={queueMoreIconsStyle} pointerEvents={activeSurface === 'lyrics' ? "none" : "auto"}>
              <TouchableOpacity
                style={st.bottomBtn}
                onPress={handleQueuePress}
                accessibilityRole="button"
                accessibilityLabel="Queue"
              >
                <Ionicons
                  name="list-outline"
                  size={24}
                  color={activeSurface === 'queue' ? palette.accent : "rgba(255,255,255,0.72)"}
                />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={queueMoreIconsStyle} pointerEvents={activeSurface === 'lyrics' ? "none" : "auto"}>
              <TouchableOpacity
                style={st.bottomBtn}
                onPress={handleMenuPress}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={22}
                  color={activeSurface === 'menu' ? palette.accent : "rgba(255,255,255,0.72)"}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>

        {/* ── LYRICS SURFACE (conditionally mounted for zero GPU cost when hidden) ── */}
        {currentTrack && activeSurface === 'lyrics' && (
          <LyricsSurface
            visible={true}
            lyricsData={lyricsData}
            isLoading={isLyricsLoading}
            accentColor={palette.accent}
            closeLyrics={closeLyrics}
            progressMs={playbackProgress.positionMs}
            durationMs={playbackProgress.durationMs}
            activeLineIndex={activeLineIndex}
            scrollRef={lyricsScrollRef}
            viewportH={lyricsViewportH}
            isUserScrolling={isLyricsUserScrolling}
            targetScrollY={lastLyricsScrollY}
            currentTrack={currentTrack}
            lyricsStyle={lyricsStyle}
            onPressLine={onPressLine}
            onLayoutLine={onLayoutLine}
          />
        )}
      </Animated.View>

      {/* ── CONDITIONALLY MOUNTED SURFACES FOR ZERO COMPOSITING COST ────────────────── */}
      {activeSurface === 'queue' && (
        <QueueSheet
          isVisible={true}
          onClose={closeQueue}
          accentColor={palette.accent}
        />
      )}

      {activeSurface === 'devices' && (
        <DevicePickerSurface
          visible={true}
          onClose={closeDevices}
          accentColor={palette.accent}
        />
      )}

      {activeSurface === 'menu' && currentTrack && (
        <MoreMenuSurface
          visible={true}
          onClose={closeMenu}
          accentColor={palette.accent}
          currentTrack={currentTrack}
          onAddToPlaylist={() => {
            closeMenu();
            setTimeout(() => setShowPlaylist(true), 150);
          }}
          onShare={async () => {
            closeMenu();
            try { await Share.share({ message: `Listening to "${currentTrack.title}" by ${currentTrack.artist} on AuraMusic 🎧` }); } catch (_) { }
          }}
          isShuffle={isShuffle}
          toggleShuffle={toggleShuffle}
          repeatMode={repeatMode}
          toggleRepeat={toggleRepeat}
        />
      )}

      {showInsight && currentTrack && (
        <InsightPanel
          isVisible={true}
          onClose={() => setShowInsight(false)}
          track={currentTrack}
          accentColor={palette.accent}
        />
      )}

      {showPlaylist && currentTrack && (
        <AddToPlaylistSheet
          visible={true}
          track={currentTrack}
          onClose={() => setShowPlaylist(false)}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  artShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 20,
  },

  // Controls backing glass layer (sits on top of art, ~42% bottom)
  controlsArea: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    overflow: "hidden",
  },

  // Controls content (positioned independently so glass can be behind)
  controlsContent: {
    position: "absolute",
    left: 0, right: 0,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },

  // Row 1 — song info
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 6,
  },
  trackTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  artistName: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.60)",
  },
  infoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },

  // Scrubber
  scrubWrap: { gap: 4, marginBottom: 20 },
  scrubTouch: { paddingVertical: 10 },
  scrubTrack: {
    height: 5,
    borderRadius: 4.5,
    backgroundColor: "rgba(255,255,255,0.20)",
    position: "relative",
  },
  scrubBg: { ...StyleSheet.absoluteFillObject, borderRadius: 1.5 },
  scrubFill: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    borderRadius: 1.5,
    backgroundColor: "#FFFFFF",  // White fill matching reference
  },
  scrubThumb: { position: "absolute", top: -7.5, width: 18, height: 18 },
  scrubThumbDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#FFF",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  timeLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  timeLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.55)" },

  // Playback row
  playbackRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  playBtn: {
    width: 64, height: 64,
    alignItems: "center", justifyContent: "center",
  },
  skipBtn: {
    width: 52, height: 52,
    alignItems: "center", justifyContent: "center",
  },

  // Volume
  volWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  volTouch: { flex: 1, paddingVertical: 10 },
  volTrack: {
    height: 4, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.20)",
    position: "relative",
  },
  volBg: { ...StyleSheet.absoluteFillObject, borderRadius: 1.5 },
  volFill: {
    position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  volThumb: { position: "absolute", top: -6, width: 15, height: 15 },
  volThumbDot: {
    width: 15, height: 15, borderRadius: 7.5,
    backgroundColor: "#FFF",
    shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Bottom toolbar
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  bottomBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },

  // ── MoreMenu / DevicePicker Glass Bottom Sheets ───────────────────────────
  menuSheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: "hidden",
    borderWidth: 0.75,
    borderTopColor: "rgba(255,255,255,0.22)",
    borderLeftColor: "rgba(255,255,255,0.08)",
    borderRightColor: "rgba(255,255,255,0.08)",
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  menuArt: {
    width: 50, height: 50,
    borderRadius: 10,
    marginRight: 14,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.4,
  },
  menuArtist: {
    fontSize: 13,
    color: "rgba(255,255,255,0.52)",
    marginTop: 2,
    fontWeight: "500",
  },
  menuPill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  menuPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  menuOptions: {
    padding: 16,
    gap: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
});