import { PlaybackService } from "@/src/features/player/services/playback.service";
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
  Dimensions,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutChangeEvent,
  TextInput,
} from "react-native";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
import {
  Gesture,
  GestureDetector,
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
  useAnimatedReaction,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedProps,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter, useSegments } from "expo-router";
import { playbackProgress } from "@/src/features/player/services/playback-progress";

import { usePlayerUIStore } from "@/src/features/player/store/player-ui.store";
import { useBackHandler, BackPriority } from "@/src/navigation/back";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { useMusicActions } from "@/src/context/MusicContext";
import { useLikesStore } from "@/src/features/likes/store/likes.store";
import { useDownloadStore } from "@/src/features/download/store/download.store";
import { DownloadButton } from "@/src/components/ui/download-button";
import { Marquee } from "./ui/marquee";
import MiniPlayer from "./MiniPlayer";
import { InsightPanel } from "@/src/features/player/components/InsightPanel";
import { QueueSheet } from "@/src/features/player/components/QueueSheet";
import AddToPlaylistSheet from "@/src/features/playlist/components/AddToPlaylistSheet";
import { openAlbum, openArtistByName } from "@/src/navigation/music-navigation";
import { LyricLine as LyricLineType } from "@/src/features/player/utils/lyrics-parser";
import { getArtworkUrl } from "../features/player/utils/track-identity";
import { resolveArtwork } from "@/src/features/player/utils/artwork-resolver";
import { AuraArtwork } from "@/src/components/ui/aura-artwork";
import { FlashList, ListRenderItem } from "@shopify/flash-list";

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as any;

import { MotionTiming, MotionSpring, MotionEasing } from "@/src/design/motion";

const { width: SW, height: SH } = Dimensions.get("window");
const NAV_WIDTH = Math.min(SW - 32, SW >= 720 ? 620 : SW > SH ? 560 : SW - 32);

const SPR_MAIN = MotionSpring.STANDARD;
const SPR_SWIPE = MotionSpring.MODAL;
const SPR_REBOUND = MotionSpring.SNAPPY;
const SPR_THUMB = MotionSpring.TAPPING;

const ART_H = SH * 0.58; 
const ART_BOX = Math.min(SW * 0.85, 360);
const GESTURE_ZONE = SH * 0.6;

// ── Colour Helpers (Optimized Fallback Only) ──────────────────────────────────
const AURA_ACCENT = "#BF5AF2";

const h2r = (hex: string, a: number) => {
  try {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  } catch (e) { return `rgba(120,120,120,${a})`; }
};

const lnSt = StyleSheet.create({
  row: { paddingVertical: 12, paddingHorizontal: 24, position: "relative" },
  text: { fontSize: 28, fontWeight: "800", lineHeight: 38, letterSpacing: -0.5, color: "#FFF" },
});

const isLocalDeviceTrack = (track: any) => {
  if (!track) return false;
  // A pure local device track (from device storage scan, not cached/downloaded)
  // has a content:// URI which is Android's content provider format for local media
  const uri = track.url || '';
  if (uri.startsWith('content://')) return true;
  // Also check if source is explicitly 'local' (from local_library scan)
  return track.source === 'local';
};

const formatTime = (sec: number) => {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const parseArtists = (artistStr?: string): string[] => {
  if (!artistStr) return [];
  // Standardize delimiters: replace featuring, feat, &, /, with, and with commas
  const standardized = artistStr
    .replace(/\s+(featuring|feat\.?|&|\/|with|and)\s+/gi, ", ")
    .replace(/\s*,\s*/g, ", ");
  
  return standardized
    .split(",")
    .map(name => name.trim())
    .filter(name => name.length > 0);
};

const formatArtistDisplay = (artistStr?: string): string => {
  if (!artistStr) return "—";
  const artists = parseArtists(artistStr);
  if (artists.length === 0) return "—";
  if (artists.length === 1) return artists[0];
  if (artists.length === 2) return `${artists[0]} with ${artists[1]}`;
  if (artists.length === 3) return `${artists[0]} with ${artists[1]} and ${artists[2]}`;
  
  // artists.length >= 4
  const middle = artists.slice(1, -1).join(", ");
  return `${artists[0]} with ${middle}, and ${artists[artists.length - 1]}`;
};

// ── Playback Scrubber (Optimized) ──────────────────────────────────────────
const timeLabelStyle = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
    padding: 0,
    margin: 0,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: 'transparent',
    includeFontPadding: false,
  }
}).label;

// ── Playback Scrubber (Optimized & Zero-Lag 1Hz Updates) ───────────────────
const TimeDisplay = memo(() => {
  const [elapsed, setElapsed] = useState("0:00");
  const [remaining, setRemaining] = useState("-0:00");

  useAnimatedReaction(
    () => {
      const pos = playbackProgress.positionMs.value;
      const dur = playbackProgress.durationMs.value;
      const nowSec = Math.floor(pos / 1000);
      const durSec = Math.floor(dur / 1000);
      return { nowSec, durSec };
    },
    (cur, prev) => {
      'worklet';
      if (!prev || cur.nowSec !== prev.nowSec || cur.durSec !== prev.durSec) {
        const remainingSec = Math.max(0, cur.durSec - cur.nowSec);
        const elapsedM = Math.floor(cur.nowSec / 60);
        const elapsedS = cur.nowSec % 60;
        const eStr = `${elapsedM}:${elapsedS < 10 ? '0' : ''}${elapsedS}`;
        const remainM = Math.floor(remainingSec / 60);
        const remainS = remainingSec % 60;
        const rStr = `-${remainM}:${remainS < 10 ? '0' : ''}${remainS}`;
        runOnJS(setElapsed)(eStr);
        runOnJS(setRemaining)(rStr);
      }
    }
  );

  return (
    <View style={st.timeLabelRow}>
      <Text style={[timeLabelStyle, { textAlign: "left" }]}>{elapsed}</Text>
      <Text style={[timeLabelStyle, { textAlign: "right" }]}>{remaining}</Text>
    </View>
  );
});

const PlaybackScrubber = memo(({ accentColor, uiPhase }: { accentColor: string; uiPhase: SharedValue<number> }) => {
  const seek = usePlayerStore(s => s.seek);

  const scrubX = useSharedValue(0);
  const scrubW = useSharedValue(1);
  const isScrub = useSharedValue(false);
  const thumbSc = useSharedValue(0);

  const performSeek = useCallback((millis: number) => {
    seek(millis);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [seek]);

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
      scrubX.value = pct * cur.w;
    }
  );

  const pan = useMemo(() => Gesture.Pan()
    .onStart(e => {
      "worklet";
      if (uiPhase.value !== 2) return;
      isScrub.value = true;
      thumbSc.value = withSpring(1, SPR_THUMB);
      scrubX.value = Math.max(0, Math.min(e.x, scrubW.value));
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate(e => {
      "worklet";
      if (!isScrub.value) return;
      scrubX.value = Math.max(0, Math.min(e.x, scrubW.value));
    })
    .onEnd(() => {
      "worklet";
      if (!isScrub.value) return;
      isScrub.value = false;
      thumbSc.value = withSpring(0, SPR_THUMB);
      const pct = scrubW.value > 0 ? scrubX.value / scrubW.value : 0;
      runOnJS(performSeek)(pct * playbackProgress.durationMs.value);
    }), [performSeek, uiPhase]);

  const tap = useMemo(() => Gesture.Tap()
    .onStart(e => {
      "worklet";
      if (uiPhase.value !== 2) return;
      const x = Math.max(0, Math.min(e.x, scrubW.value));
      scrubX.value = withTiming(x, { duration: 180 });
      const pct = scrubW.value > 0 ? x / scrubW.value : 0;
      runOnJS(performSeek)(pct * playbackProgress.durationMs.value);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    }), [performSeek, uiPhase]);

  const fillStyle = useAnimatedStyle(() => {
    const s = scrubW.value > 0 ? scrubX.value / scrubW.value : 0;
    const tx = ((s - 1) * scrubW.value) / 2;
    return {
      transform: [
        { translateX: tx },
        { scaleX: s }
      ],
      width: scrubW.value,
      left: 0,
    };
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrubX.value - 9 }, { scale: thumbSc.value }],
  }));

  return (
    <View style={st.scrubWrap}>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Animated.View style={st.scrubTouch}>
          <View style={st.scrubTrack} onLayout={e => { scrubW.value = e.nativeEvent.layout.width; }}>
            <View style={st.scrubBg} />
            <Animated.View style={[st.scrubFill, fillStyle]} />
            <Animated.View style={[st.scrubThumb, thumbStyle]}><View style={st.scrubThumbDot} /></Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
      <TimeDisplay />
    </View>
  );
});

// ── Volume Control (Optimized) ───────────────────────────────────────────────
const VolumeControl = memo(({ uiPhase }: { uiPhase: SharedValue<number> }) => {
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
      if (uiPhase.value !== 2) return;
      isAdj.value = true;
      thumbSc.value = withSpring(1, SPR_THUMB);
      const v = volW.value > 0 ? Math.max(0, Math.min(e.x / volW.value, 1)) : 0;
      volX.value = v;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate(e => {
      "worklet";
      if (!isAdj.value) return;
      const v = volW.value > 0 ? Math.max(0, Math.min(e.x / volW.value, 1)) : 0;
      volX.value = v;
    })
    .onEnd(() => {
      "worklet";
      if (!isAdj.value) return;
      runOnJS(setVolume)(volX.value);
      isAdj.value = false;
      thumbSc.value = withSpring(0, SPR_THUMB);
    });

  const fillStyle = useAnimatedStyle(() => {
    const s = volX.value;
    const tx = ((s - 1) * volW.value) / 2;
    return {
      transform: [
        { translateX: tx },
        { scaleX: s }
      ],
      width: volW.value,
      left: 0,
    };
  });
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: volX.value * volW.value - 8 }, { scale: thumbSc.value }] }));

  return (
    <View style={st.volWrap}>
      <Ionicons name="volume-mute-outline" size={28} color="rgba(255,255,255,0.45)" />
      <GestureDetector gesture={pan}>
        <Animated.View style={st.volTouch}>
          <View style={st.volTrack} onLayout={e => { volW.value = e.nativeEvent.layout.width; }}>
            <View style={st.volBg} />
            <Animated.View style={[st.volFill, fillStyle]} />
            <Animated.View style={[st.volThumb, thumbStyle]}><View style={st.volThumbDot} /></Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
      <Ionicons name="volume-high-outline" size={28} color="rgba(255,255,255,0.45)" />
    </View>
  );
});

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
      <Animated.View style={style}><Ionicons name={isPlaying ? "pause" : "play"} size={54} color="#FFF" /></Animated.View>
    </Pressable>
  );
});

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
      <Animated.View style={style}><Ionicons name={icon as any} size={36} color="#FFF" /></Animated.View>
    </Pressable>
  );
});

// ── Lyric Line ───────────────────────────────────────────────────────────────
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
    if (!isSynced) {
      return {
        opacity: 0.88,
        transform: [{ scale: 1.0 }],
      };
    }
    const isActive = activeLineIndex.value === lineIndex;
    return {
      opacity: withTiming(isActive ? 1.0 : 0.32, { duration: 160, easing: REasing.out(REasing.quad) }),
      transform: [{ scale: withTiming(isActive ? 1.03 : 0.98, { duration: 160 }) }],
    };
  });

  const handlePress = useCallback(() => onPressLine(lineIndex), [onPressLine, lineIndex]);
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
    >
      <Animated.Text style={[lnSt.text, textStyle]} selectable={false}>
        {text}
      </Animated.Text>
    </TouchableOpacity>
  );
});

const PausedPill = memo(({ visible, accent }: { visible: boolean; accent: string }) => {
  const op = useSharedValue(0);
  const sc = useSharedValue(0.95);
  
  useEffect(() => {
    op.value = withTiming(visible ? 1 : 0, { duration: 200 });
    sc.value = withTiming(visible ? 1 : 0.95, { duration: 200, easing: REasing.out(REasing.quad) });
  }, [visible]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: sc.value }]
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 8, alignSelf: "center", zIndex: 10 }, pillStyle]}>
      <View style={{ borderRadius: 14, overflow: "hidden", paddingHorizontal: 13, paddingVertical: 6 }}>
        {Platform.OS === "ios" ? <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20,20,28,0.95)" }]} />}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
          <Text style={{ fontSize: 10, color: accent, fontWeight: "800", letterSpacing: 0.6 }}>AUTO-SCROLL PAUSED</Text>
        </View>
      </View>
    </Animated.View>
  );
});

// ── Lyrics Surface ───────────────────────────────────────────────────────────
const LyricsSurface = memo(({
  visible,
  accentColor,
  lyricsStyle,
  isLocked,
  onClose,
}: any) => {
  const insets = useSafeAreaInsets();
  const [showPaused, setShowPaused] = useState(false);

  const lyricsData = usePlayerStore(s => s.lyrics);
  const isLoading = usePlayerStore(s => s.isLyricsLoading);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const handleRetryFetch = useCallback(() => {
    if (currentTrack) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      usePlayerStore.getState().fetchLyrics(currentTrack);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (visible && currentTrack && !lyricsData && !isLoading) {
      usePlayerStore.getState().fetchLyrics(currentTrack);
    }
  }, [visible, currentTrack?.id, lyricsData, isLoading]);

  const lyrics: LyricLineType[] = useMemo(() => lyricsData?.lyrics || [], [lyricsData]);
  const isSynced = useMemo(() => lyricsData?.synced ?? false, [lyricsData]);

  const lyricsScrollRef = useRef<any>(null);
  const isLyricsUserScrolling = useSharedValue(false);
  const lyricsViewportH = useSharedValue(SH * 0.62);

  const lastActiveLineIndex = useSharedValue(-1);

  const activeLineIndex = useDerivedValue(() => {
    "worklet";
    if (!visible) return -1;
    if (!isSynced || !lyrics.length) return -1;
    const t = playbackProgress.positionMs.value;
    const last = lastActiveLineIndex.value;
    if (last >= 0 && last < lyrics.length) {
      const cur = lyrics[last].time;
      const nxt = last + 1 < lyrics.length ? lyrics[last + 1].time : Infinity;
      if (t >= cur && t < nxt) return last;
    }
    let res = -1;
    if (last >= 0 && last + 1 < lyrics.length && lyrics[last + 1].time <= t) {
      let i = last + 1;
      while (i + 1 < lyrics.length && lyrics[i + 1].time <= t) i++;
      res = i;
    } else {
      let lo = 0, hi = lyrics.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lyrics[mid].time <= t) { res = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
    }
    lastActiveLineIndex.value = res;
    return res;
  }, [visible, isSynced, lyrics]);

  const scrollToLyric = useCallback((index: number) => {
    lyricsScrollRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.38,
    });
  }, []);

  useAnimatedReaction(() => ({ idx: activeLineIndex.value, scroll: isLyricsUserScrolling.value, canSync: visible }), (cur, prev) => {
    "worklet";
    if (!cur.canSync || cur.scroll || cur.idx < 0) return;
    if (prev && cur.idx === prev.idx) return;
    runOnJS(scrollToLyric)(cur.idx);
  });

  const onPressLine = useCallback((idx: number) => {
    if (isLocked) return;
    if (!isSynced || !lyrics[idx]) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isLyricsUserScrolling.value = false;
    scrollToLyric(idx);
    usePlayerStore.getState().seek(lyrics[idx].time);
  }, [isSynced, lyrics, scrollToLyric, isLocked]);

  const onLayoutLine = useCallback((idx: number, y: number, h: number) => {
     // No-op for layout tracking in FlashList variant
  }, []);

  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelResume = useCallback(() => { if (resumeTimer.current) { clearTimeout(resumeTimer.current); resumeTimer.current = null; } }, []);
  const scheduleResume = useCallback(() => {
    cancelResume();
    resumeTimer.current = setTimeout(() => { isLyricsUserScrolling.value = false; setShowPaused(false); }, 2000);
  }, [cancelResume]);

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => { "worklet"; isLyricsUserScrolling.value = true; runOnJS(cancelResume)(); runOnJS(setShowPaused)(true); },
    onEndDrag: () => { "worklet"; runOnJS(scheduleResume)(); },
    onMomentumEnd: () => { "worklet"; runOnJS(scheduleResume)(); },
  });

  const renderItem = useCallback<ListRenderItem<LyricLineType>>(({ item, index }) => (
    <LyricLine 
      text={item.text} 
      lineIndex={index} 
      activeLineIndex={activeLineIndex} 
      onPressLine={onPressLine} 
      onLayoutLine={onLayoutLine} 
      isSynced={isSynced} 
      accentColor={accentColor} 
    />
  ), [activeLineIndex, onPressLine, onLayoutLine, isSynced, accentColor]);

  const ListHeader = useMemo(() => <View style={{ height: SH * 0.35 }} />, []);
  const ListFooter = useMemo(() => <View style={{ height: SH * 0.45 }} />, []);

  return (
    <Animated.View 
      style={[
        StyleSheet.absoluteFill, 
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90, zIndex: 10 }, 
        lyricsStyle
      ]} 
      pointerEvents={visible ? "box-none" : "none"}
    >
      <View style={{ flex: 1 }} onLayout={e => { lyricsViewportH.value = e.nativeEvent.layout.height; }}>
        {/* Top Header Row for Lyrics View */}
        <View style={st.lyricsHeaderRow}>
          <TouchableOpacity 
            onPress={onClose} 
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={st.lyricsCloseBtn}
          >
            <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>

          <View style={st.lyricsHeaderTitleWrap}>
            <Text style={st.lyricsHeaderTitle} numberOfLines={1}>{currentTrack?.title || "Lyrics"}</Text>
            <View style={st.lyricsBadgeRow}>
              {isSynced ? (
                <View style={[st.lyricsBadge, { borderColor: h2r(accentColor, 0.4), backgroundColor: h2r(accentColor, 0.15) }]}>
                  <View style={[st.lyricsBadgeDot, { backgroundColor: accentColor }]} />
                  <Text style={[st.lyricsBadgeText, { color: accentColor }]}>TIME-SYNCED</Text>
                </View>
              ) : lyrics.length > 0 ? (
                <View style={st.lyricsBadge}>
                  <Text style={st.lyricsBadgeText}>PLAIN LYRICS</Text>
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity 
            onPress={handleRetryFetch}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={st.lyricsCloseBtn}
          >
            <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
        </View>

        <PausedPill visible={showPaused} accent={accentColor} />

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 13 }}>Loading lyrics...</Text>
          </View>
        ) : lyrics.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 }}>
            <View style={st.lyricsEmptyIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 17, textAlign: "center" }}>No lyrics available</Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontWeight: "400", fontSize: 13, textAlign: "center", lineHeight: 18 }}>
              We couldn't find synchronized lyrics for this track yet.
            </Text>
            <TouchableOpacity 
              onPress={handleRetryFetch}
              activeOpacity={0.8}
              style={[st.lyricsRetryBtn, { borderColor: h2r(accentColor, 0.4), backgroundColor: h2r(accentColor, 0.12) }]}
            >
              <Ionicons name="refresh" size={16} color={accentColor} />
              <Text style={{ color: accentColor, fontWeight: "700", fontSize: 13 }}>Search Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <AnimatedFlashList
            ref={lyricsScrollRef}
            data={lyrics}
            renderItem={renderItem as any}
            keyExtractor={(_: any, index: number) => index.toString()}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            removeClippedSubviews={true}
            estimatedItemSize={64}
          />
        )}
      </View>
    </Animated.View>
  );
});

// ── Secondary Sheets ─────────────────────────────────────────────────────────
const MoreMenuSurface = memo(({ visible, onClose, accentColor, currentTrack, onAddToPlaylist, onShare }: any) => {
  const isShuffle = usePlayerStore(s => s.isShuffle);
  const repeatMode = usePlayerStore(s => s.repeatMode);
  const { toggleRepeat, toggleShuffle, play, pause, prev, next } = useMusicActions();
  const router = useRouter();
  const menuAnim = useSharedValue(120);
  const menuOpacity = useSharedValue(0);

  useEffect(() => {
    menuAnim.value = withTiming(visible ? 0 : 120, { duration: 240, easing: REasing.out(REasing.quad) });
    menuOpacity.value = withTiming(visible ? 1 : 0, { duration: 240, easing: REasing.out(REasing.quad) });
  }, [visible]);

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: menuAnim.value }],
    opacity: menuOpacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 240 })
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000, justifyContent: "center", alignItems: "center" }]} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          {Platform.OS === 'ios' && <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={[st.menuModal, menuStyle]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none"><BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} /><View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20, 20, 28, 0.85)" }]} /></View>
        <View style={st.menuHeader}>
          <AuraArtwork 
            source={resolveArtwork(currentTrack, 'card')} 
            entityName={currentTrack?.title}
            entityType="song"
            style={st.menuArt} 
            contentFit="cover"
            cachePolicy="memory-disk" 
          />
          <View style={{ flex: 1 }}><Text style={st.menuTitle} numberOfLines={1}>{currentTrack?.title || "—"}</Text><Text style={st.menuArtist} numberOfLines={1}>{formatArtistDisplay(currentTrack?.artist)}</Text></View>
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", gap: 10 }}>
          <TouchableOpacity style={[st.menuPill, isShuffle && { backgroundColor: h2r(accentColor, 0.18), borderColor: accentColor }]} onPress={toggleShuffle}>
            <Ionicons name="shuffle" size={18} color={isShuffle ? accentColor : "#FFF"} />
            <Text style={[st.menuPillText, isShuffle && { color: accentColor }]}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.menuPill, repeatMode !== "off" && { backgroundColor: h2r(accentColor, 0.18), borderColor: accentColor }]} onPress={toggleRepeat}>
            <Ionicons name={repeatMode === "off" ? "repeat-outline" : "repeat"} size={18} color={repeatMode !== "off" ? accentColor : "#FFF"} />
            <Text style={[st.menuPillText, repeatMode !== "off" && { color: accentColor }]}>
              {repeatMode === "track" ? "Repeat One" : repeatMode === "queue" ? "Repeat All" : "Repeat Off"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={st.menuOptions}><TouchableOpacity style={st.menuItem} onPress={() => { onClose(); onAddToPlaylist(); }}><Ionicons name="add-circle-outline" size={22} color="#FFF" /><Text style={st.menuItemText}>Add to Playlist</Text></TouchableOpacity><TouchableOpacity style={st.menuItem} onPress={() => { onClose(); onShare(); }}><Ionicons name="share-outline" size={22} color="#FFF" /><Text style={st.menuItemText}>Share Song</Text></TouchableOpacity><TouchableOpacity style={st.menuItem} onPress={() => { onClose(); openAlbum(router, currentTrack?.albumId); }}><Ionicons name="disc-outline" size={22} color="#FFF" /><Text style={st.menuItemText}>View Album</Text></TouchableOpacity><TouchableOpacity style={[st.menuItem, { borderBottomWidth: 0, marginTop: 12, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" }]} onPress={onClose}><Ionicons name="close-circle-outline" size={22} color="#FF3B30" /><Text style={[st.menuItemText, { color: "#FF3B30", fontWeight: "700" }]}>Cancel</Text></TouchableOpacity></View>
      </Animated.View>
    </Animated.View>
  );
});

const DevicePickerSurface = memo(({ visible, onClose, accentColor }: any) => {
  const insets = useSafeAreaInsets();
  const deviceAnim = useSharedValue(SH);
  useEffect(() => { deviceAnim.value = withSpring(visible ? 0 : SH, { damping: 22, stiffness: 220 }); }, [visible]);
  const deviceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: deviceAnim.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: withTiming(visible ? 1 : 0, { duration: 200 }) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}><TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>{Platform.OS === 'ios' && <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />}<View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} /></TouchableOpacity></Animated.View>
      <Animated.View style={[st.menuSheet, deviceStyle, { paddingBottom: insets.bottom + 16 }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">{Platform.OS === 'ios' && <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />}<View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20, 20, 28, 0.85)" }]} /></View>
        <View style={st.menuHeader}><Ionicons name="hardware-chip-outline" size={24} color={accentColor} style={{ marginRight: 12 }} /><View style={{ flex: 1 }}><Text style={st.menuTitle}>Audio Routing</Text><Text style={st.menuArtist}>Select playback destination</Text></View></View>
        <View style={st.menuOptions}><TouchableOpacity style={[st.menuItem, { backgroundColor: h2r(accentColor, 0.1), borderColor: accentColor }]} onPress={onClose}><Ionicons name="phone-portrait-outline" size={22} color={accentColor} /><Text style={[st.menuItemText, { color: accentColor, fontWeight: '700' }]}>This Device (Speaker)</Text><Ionicons name="checkmark-circle" size={18} color={accentColor} /></TouchableOpacity><TouchableOpacity style={st.menuItem} onPress={onClose}><Ionicons name="headset-outline" size={22} color="#FFF" /><Text style={st.menuItemText}>Bluetooth Headphones / Speakers</Text></TouchableOpacity><TouchableOpacity style={st.menuItem} onPress={onClose}><Ionicons name="wifi-outline" size={22} color="#FFF" /><Text style={st.menuItemText}>AirPlay & Cast Devices</Text></TouchableOpacity><TouchableOpacity style={[st.menuItem, { borderBottomWidth: 0, marginTop: 12, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.08)" }]} onPress={onClose}><Ionicons name="close-circle-outline" size={22} color="#FF3B30" /><Text style={[st.menuItemText, { color: "#FF3B30", fontWeight: "700" }]}>Close</Text></TouchableOpacity></View>
      </Animated.View>
    </Animated.View>
  );
});

interface PlayerOverlayProps {
  expandProgress: SharedValue<number>;
}

function PlayerOverlay({ expandProgress }: PlayerOverlayProps) {
  const playerOverlayRenderCount = useRef(0);
  playerOverlayRenderCount.current += 1;
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(`[PlayerOverlay] Rendered: count = ${playerOverlayRenderCount.current}`);
  }
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const isExpanded = usePlayerUIStore(s => s.isExpanded);
  const expand = usePlayerUIStore(s => s.expand);
  const collapse = usePlayerUIStore(s => s.collapse);
  const activeSurface = usePlayerUIStore(s => s.activeSurface);
  
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const queue = usePlayerStore(s => s.queue);
  const currentIndex = usePlayerStore(s => s.currentIndex);
  const prevTrack = currentIndex > 0 ? queue[currentIndex - 1] : null;
  const nextTrack = currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null;
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isTransitioning = usePlayerStore(s => s.isTransitioning);
  const isPreloading = usePlayerStore(s => s.isPreloading);
  const isBuffering = usePlayerStore(s => s.isBuffering);

  const isTransitionLoading = isTransitioning || isPreloading || isBuffering;

  const bgFadeProgress = useSharedValue(1);
  const metaFadeProgress = useSharedValue(1);
  const [currentArtwork, setCurrentArtwork] = useState<string | null>(null);

  useEffect(() => {
    setCurrentArtwork(currentTrack?.art || null);
    bgFadeProgress.value = 0;
    bgFadeProgress.value = withTiming(1, { duration: 150, easing: REasing.out(REasing.quad) });
    metaFadeProgress.value = 0;
    metaFadeProgress.value = withTiming(1, { duration: 150, easing: REasing.out(REasing.quad) });
  }, [currentTrack?.id]);

  const [transitionArtwork, setTransitionArtwork] = useState<string | null>(null);

  useEffect(() => {
    setTransitionArtwork(nextTrack?.art || null);
  }, [nextTrack?.id]);

  const prevTrackArtShared = useSharedValue<string | null>(null);
  const nextTrackArtShared = useSharedValue<string | null>(null);

  useEffect(() => {
    prevTrackArtShared.value = prevTrack?.art || null;
    nextTrackArtShared.value = nextTrack?.art || null;
  }, [prevTrack?.id, nextTrack?.id]);

  const transitionArtworkShared = useSharedValue<string | null>(null);

  useEffect(() => {
    transitionArtworkShared.value = transitionArtwork;
  }, [transitionArtwork]);

  

  const { toggleRepeat, toggleShuffle, play, pause, prev, next } = useMusicActions();
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
  const [isLocked, setIsLocked] = useState(true);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) PlaybackService.pause();
    else PlaybackService.play();
  }, [isPlaying, play, pause]);

  const handleSingleArtistPress = useCallback((artistName: string) => {
    if (artistName && !isLocked) {
      collapse();
      openArtistByName(router, artistName.trim());
    }
  }, [router, collapse, isLocked]);

  const renderFormattedArtists = useCallback(() => {
    const artistStr = currentTrack?.artist;
    if (!artistStr) return <Text style={st.artistName}>—</Text>;

    const artists = parseArtists(artistStr);
    if (artists.length === 0) return <Text style={st.artistName}>—</Text>;

    if (artists.length === 1) {
      return (
        <Text style={st.artistName} numberOfLines={1}>
          <Text onPress={() => handleSingleArtistPress(artists[0])}>
            {artists[0]}
          </Text>
        </Text>
      );
    }

    if (artists.length === 2) {
      return (
        <Text style={st.artistName} numberOfLines={1}>
          <Text onPress={() => handleSingleArtistPress(artists[0])}>{artists[0]}</Text>
          {" with "}
          <Text onPress={() => handleSingleArtistPress(artists[1])}>{artists[1]}</Text>
        </Text>
      );
    }

    if (artists.length === 3) {
      return (
        <Text style={st.artistName} numberOfLines={1}>
          <Text onPress={() => handleSingleArtistPress(artists[0])}>{artists[0]}</Text>
          {" with "}
          <Text onPress={() => handleSingleArtistPress(artists[1])}>{artists[1]}</Text>
          {" and "}
          <Text onPress={() => handleSingleArtistPress(artists[2])}>{artists[2]}</Text>
        </Text>
      );
    }

    // artists.length >= 4
    return (
      <Text style={st.artistName} numberOfLines={1}>
        <Text onPress={() => handleSingleArtistPress(artists[0])}>{artists[0]}</Text>
        {" with "}
        {artists.slice(1, -1).map((artist, idx) => (
          <React.Fragment key={`${artist}-${idx}`}>
            <Text onPress={() => handleSingleArtistPress(artist)}>{artist}</Text>
            {", "}
          </React.Fragment>
        ))}
        {"and "}
        <Text onPress={() => handleSingleArtistPress(artists[artists.length - 1])}>
          {artists[artists.length - 1]}
        </Text>
      </Text>
    );
  }, [currentTrack?.artist, handleSingleArtistPress]);

  const handleLikePress = useCallback(() => {
    if (currentTrack) toggleLike(currentTrack);
  }, [currentTrack, toggleLike]);

  const handleLyricsPress = useCallback(() => { 
    activeSurface === 'lyrics' ? closeLyrics() : openLyrics(); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
  }, [activeSurface, openLyrics, closeLyrics]);

  const handleQueuePress = useCallback(() => { 
    activeSurface === 'queue' ? closeQueue() : openQueue(); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
  }, [activeSurface, openQueue, closeQueue]);

  const handleMenuPress = useCallback(() => { 
    activeSurface === 'menu' ? closeMenu() : openMenu(); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
  }, [activeSurface, openMenu, closeMenu]);

  const startProgress = useSharedValue(0);
  const surfaceOpenProgress = useSharedValue(0);

  const uiPhase = useSharedValue<number>(0);
  const controlsOpacity = useSharedValue(0);

  const [lastSurface, setLastSurface] = useState<any>('controls');
  useEffect(() => {
    setIsLocked(true);
    surfaceOpenProgress.value = withTiming(activeSurface !== 'controls' ? 1 : 0, { duration: 220 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(setIsLocked)(false);
        runOnJS(setLastSurface)(activeSurface);
      }
    });
  }, [activeSurface]);

  const artworkUri = currentTrack?.art;

  const isTabScreen = segments[0] === '(tabs)';
  const bottomOffset = isTabScreen 
    ? Math.max(insets.bottom + 14, 24) + 80
    : Math.max(insets.bottom + 8, 12);
  const MINI_HEIGHT = 68;
  const COLLAPSED_Y = SH - (MINI_HEIGHT + bottomOffset);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const nextTrackJS = () => {
    PlaybackService.skipToNext();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const prevTrackJS = () => {
    prev(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const isGestureEnabledShared = useSharedValue(true);
  useEffect(() => {
    isGestureEnabledShared.value = activeSurface !== 'lyrics' && activeSurface !== 'queue';
  }, [activeSurface]);

  const expandRef = useRef(expand);
  const collapseRef = useRef(collapse);
  const triggerHapticRef = useRef(triggerHaptic);
  const nextTrackJSRef = useRef(nextTrackJS);
  const prevTrackJSRef = useRef(prevTrackJS);
  const setTransitionArtworkRef = useRef(setTransitionArtwork);

  expandRef.current = expand;
  collapseRef.current = collapse;
  triggerHapticRef.current = triggerHaptic;
  nextTrackJSRef.current = nextTrackJS;
  prevTrackJSRef.current = prevTrackJS;
  setTransitionArtworkRef.current = setTransitionArtwork;

  const runExpand = useCallback(() => expandRef.current(), []);
  const runCollapse = useCallback(() => collapseRef.current(), []);
  const runTriggerHaptic = useCallback(() => triggerHapticRef.current(), []);
  const runNextTrack = useCallback(() => nextTrackJSRef.current(), []);
  const runPrevTrack = useCallback(() => prevTrackJSRef.current(), []);
  const runSetTransitionArtwork = useCallback((art: string | null) => setTransitionArtworkRef.current(art), []);

  const collapsedPan = useMemo(() => Gesture.Pan()
    .onStart(() => {
      "worklet";
      startProgress.value = expandProgress.value;
    })
    .onUpdate((e) => {
      "worklet";
      const delta = -e.translationY / (SH * 0.65);
      expandProgress.value = Math.max(0, Math.min(1, startProgress.value + delta));
    })
    .onEnd((e) => {
      "worklet";
      if (e.velocityY < -500 || expandProgress.value > 0.5) {
        expandProgress.value = withSpring(1, SPR_MAIN, () => {
          runOnJS(runExpand)();
        });
      } else {
        expandProgress.value = withSpring(0, SPR_MAIN, () => {
          runOnJS(runCollapse)();
        });
      }
    }), []);

  const collapsedTap = useMemo(() => Gesture.Tap()
    .onStart(() => {
      "worklet";
      runOnJS(runTriggerHaptic)();
      runOnJS(runExpand)();
    }), []);

  const miniGesture = useMemo(() => Gesture.Exclusive(collapsedPan, collapsedTap), [collapsedPan, collapsedTap]);

  const artSwipeX = useSharedValue(0);
  const artScale = useSharedValue(1);
  const artDismissY = useSharedValue(0);
  const dragDirection = useSharedValue<'none' | 'horizontal' | 'vertical'>('none');

  const expandedPan = useMemo(() => Gesture.Pan()
    .onStart(() => {
      "worklet";
      if (!isGestureEnabledShared.value) return;
      startProgress.value = expandProgress.value;
      artDismissY.value = 0;
    })
    .onUpdate((e) => {
      "worklet";
      if (!isGestureEnabledShared.value) return;
      const dy = e.translationY;
      if (dy > 0) {
        artDismissY.value = dy;
        const delta = dy / (SH * 0.85);
        expandProgress.value = Math.max(0, Math.min(1, startProgress.value - delta));
      }
    })
    .onEnd((e) => {
      "worklet";
      if (!isGestureEnabledShared.value) return;
      const threshold = SH * 0.22;
      if (e.translationY > threshold || e.velocityY > 500) {
        expandProgress.value = withSpring(0, SPR_MAIN, () => {
          runOnJS(runCollapse)();
          artDismissY.value = 0;
        });
      } else {
        expandProgress.value = withSpring(1, SPR_MAIN);
        artDismissY.value = withSpring(0, SPR_REBOUND);
      }
    }), []);

  const artworkSwipe = useMemo(() => Gesture.Pan()
    .onStart(() => {
      "worklet";
      if (!isGestureEnabledShared.value) return;
      dragDirection.value = 'none';
      startProgress.value = expandProgress.value;
      artDismissY.value = 0;
      artSwipeX.value = 0;
    })
    .onUpdate((e) => {
      "worklet";
      if (!isGestureEnabledShared.value) return;
      const dx = e.translationX;
      const dy = e.translationY;

      if (dragDirection.value === 'none') {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX > 10 || absY > 10) {
          if (absX > absY) {
            dragDirection.value = 'horizontal';
          } else {
            if (dy > 0) {
              dragDirection.value = 'vertical';
            }
          }
        }
      }

      if (dragDirection.value === 'horizontal') {
        artSwipeX.value = dx;
        artScale.value = interpolate(Math.abs(dx), [0, SW * 0.4], [1, 0.94], Extrapolate.CLAMP);
        artDismissY.value = 0;
        
        const targetArt = dx > 0 ? prevTrackArtShared.value : nextTrackArtShared.value;
        if (targetArt !== transitionArtworkShared.value) {
          runOnJS(runSetTransitionArtwork)(targetArt);
        }
      } else if (dragDirection.value === 'vertical') {
        artDismissY.value = Math.max(0, dy);
        artSwipeX.value = 0;
        const delta = Math.max(0, dy) / (SH * 0.85);
        expandProgress.value = Math.max(0, Math.min(1, startProgress.value - delta));
      }
    })
    .onEnd((e) => {
      "worklet";
      if (!isGestureEnabledShared.value) return;
      if (dragDirection.value === 'horizontal') {
        if (e.translationX < -SW * 0.25 || e.velocityX < -400) {
          artSwipeX.value = withSpring(-SW, SPR_SWIPE, () => {
            runOnJS(runNextTrack)();
            artSwipeX.value = 0;
            artScale.value = withSpring(1);
          });
        } else if (e.translationX > SW * 0.25 || e.velocityX > 400) {
          artSwipeX.value = withSpring(SW, SPR_SWIPE, () => {
            runOnJS(runPrevTrack)();
            artSwipeX.value = 0;
            artScale.value = withSpring(1);
          });
        } else {
          artSwipeX.value = withSpring(0, SPR_REBOUND);
          artScale.value = withSpring(1, SPR_REBOUND);
        }
      } else if (dragDirection.value === 'vertical') {
        const threshold = SH * 0.22;
        if (e.translationY > threshold || e.velocityY > 500) {
          expandProgress.value = withSpring(0, SPR_MAIN, () => {
            runOnJS(runCollapse)();
            artDismissY.value = 0;
          });
        } else {
          expandProgress.value = withSpring(1, SPR_MAIN);
          artDismissY.value = withSpring(0, SPR_REBOUND);
        }
      }
      dragDirection.value = 'none';
    }), []);

  useBackHandler({
    id: 'player-sub-surface',
    enabled: activeSurface !== 'controls' && isExpanded,
    priority: BackPriority.PLAYER_SUB_SURFACE,
    onBack: () => {
      if (activeSurface === 'lyrics') closeLyrics();
      else if (activeSurface === 'queue') closeQueue();
      else if (activeSurface === 'menu') closeMenu();
      else closeDevices();
      return true;
    },
  });

  useBackHandler({
    id: 'player-expanded',
    enabled: isExpanded && activeSurface === 'controls',
    priority: BackPriority.EXPANDED_PLAYER,
    onBack: () => {
      expandProgress.value = withSpring(0, SPR_MAIN, () => {
        runOnJS(collapse)();
      });
      return true;
    },
  });

  useEffect(() => {
    if (isExpanded) {
      uiPhase.value = 0;
      runOnJS(setIsLocked)(true);
      controlsOpacity.value = 0;
      controlsOpacity.value = withTiming(1, { duration: 380, easing: REasing.out(REasing.quad) });
      expandProgress.value = withSpring(1, SPR_MAIN, () => {
        uiPhase.value = 2;
        runOnJS(setIsLocked)(false);
      });
    } else {
      uiPhase.value = 0;
      runOnJS(setIsLocked)(true);
      controlsOpacity.value = withTiming(0, { duration: 180 });
      expandProgress.value = withSpring(0, SPR_MAIN, () => {
        uiPhase.value = 2;
        runOnJS(setIsLocked)(false);
      });
    }
  }, [isExpanded]);

  const atmosphereStyle = useAnimatedStyle(() => ({ 
    opacity: 0.4 * surfaceOpenProgress.value
  }));

  const currentBgStyle = useAnimatedStyle(() => {
    const p = expandProgress.value;
    const expansionBgFade = interpolate(p, [0, 0.38], [0, 1], Extrapolate.CLAMP);
    const scaleSettle = interpolate(bgFadeProgress.value, [0, 1], [1.04, 1], Extrapolate.CLAMP);
    return {
      opacity: expansionBgFade * bgFadeProgress.value,
      transform: [{ scale: scaleSettle }],
    };
  });

  const overlayStyle = useAnimatedStyle(() => {
    const p = expandProgress.value;
    const translateY = interpolate(p, [0, 1], [SH * 0.8, 0], Extrapolate.CLAMP);
    const scale = interpolate(p, [0, 1], [0.95, 1], Extrapolate.CLAMP);
    const isHidden = p <= 0.01;
    return {
      transform: [
        { translateY },
        { scale },
      ],
      display: isHidden ? 'none' : 'flex',
    };
  });

  const controlsStyle = useAnimatedStyle(() => {
    const p = expandProgress.value;
    const overlayContentOpacity = interpolate(p, [0.08, 0.35], [0, 1], Extrapolate.CLAMP);
    const op = overlayContentOpacity * controlsOpacity.value * interpolate(surfaceOpenProgress.value, [0, 1], [1, 0]);
    const expandY = interpolate(p, [0.35, 0.85], [24, 0], Extrapolate.CLAMP);
    const ty = expandY + interpolate(surfaceOpenProgress.value, [0, 1], [0, 24]);

    return { 
      opacity: op, 
      transform: [{ translateY: ty }], 
      display: op <= 0.01 ? "none" : "flex" 
    };
  });

  const expArtStyle = useAnimatedStyle(() => {
    const isLyricsActive = activeSurface === 'lyrics' || lastSurface === 'lyrics';
    const dim = isLyricsActive ? interpolate(surfaceOpenProgress.value, [0, 1], [1, 0]) : 1;
    
    const p = expandProgress.value;
    const scaleFactor = 48 / ART_BOX;
    const currentScale = interpolate(p, [0, 1], [scaleFactor, 1], Extrapolate.CLAMP);
    
    const miniArtCenterX = (SW - NAV_WIDTH) / 2 + 12 + 24;
    const miniArtCenterY = SH - bottomOffset - 10 - 24;
    const expandedArtCenterX = SW / 2;
    const expandedArtCenterY = insets.top + 60 + ART_BOX / 2;

    const targetTranslateX = miniArtCenterX - expandedArtCenterX;
    const currentTranslateX = interpolate(p, [0, 1], [targetTranslateX, 0], Extrapolate.CLAMP);
    
    const parentTranslateY = interpolate(p, [0, 1], [SH * 0.8, 0], Extrapolate.CLAMP);
    const desiredScreenY = interpolate(p, [0, 1], [miniArtCenterY, expandedArtCenterY], Extrapolate.CLAMP);
    const currentTranslateY = desiredScreenY - parentTranslateY - expandedArtCenterY;
    
    const currentBorderRadius = interpolate(p, [0, 1], [13 * (ART_BOX / 48), 12], Extrapolate.CLAMP);

    const verticalDragScale = artDismissY.value > 0
      ? interpolate(artDismissY.value, [0, SH * 0.4], [0.98, 0.92], Extrapolate.CLAMP)
      : 1.0;

    return { 
      opacity: dim, 
      borderRadius: currentBorderRadius,
      transform: [
        { translateX: currentTranslateX + artSwipeX.value },
        { translateY: currentTranslateY + artDismissY.value * 0.3 },
        { scale: currentScale * artScale.value * verticalDragScale },
      ], 
      pointerEvents: dim <= 0.01 ? "none" : "auto"
    };
  });

  const transitionArtStyle = useAnimatedStyle(() => {
    const isLyricsActive = activeSurface === 'lyrics' || lastSurface === 'lyrics';
    const dim = isLyricsActive ? interpolate(surfaceOpenProgress.value, [0, 1], [1, 0]) : 1;

    const p = expandProgress.value;
    const scaleFactor = 48 / ART_BOX;
    const currentScale = interpolate(p, [0, 1], [scaleFactor, 1], Extrapolate.CLAMP);

    const miniArtCenterX = (SW - NAV_WIDTH) / 2 + 12 + 24;
    const miniArtCenterY = SH - bottomOffset - 10 - 24;
    const expandedArtCenterX = SW / 2;
    const expandedArtCenterY = insets.top + 60 + ART_BOX / 2;

    const targetTranslateX = miniArtCenterX - expandedArtCenterX;
    const currentTranslateX = interpolate(p, [0, 1], [targetTranslateX, 0], Extrapolate.CLAMP);

    const parentTranslateY = interpolate(p, [0, 1], [SH * 0.8, 0], Extrapolate.CLAMP);
    const desiredScreenY = interpolate(p, [0, 1], [miniArtCenterY, expandedArtCenterY], Extrapolate.CLAMP);
    const currentTranslateY = desiredScreenY - parentTranslateY - expandedArtCenterY;

    const currentBorderRadius = interpolate(p, [0, 1], [13 * (ART_BOX / 48), 12], Extrapolate.CLAMP);

    const isSwipingRight = artSwipeX.value > 0;
    const offsetDirection = isSwipingRight ? -1 : 1;
    const transitionOffset = offsetDirection * (ART_BOX + 24);

    const targetScale = interpolate(Math.abs(artSwipeX.value), [0, SW * 0.4], [0.94, 1.0], Extrapolate.CLAMP);
    const opacity = interpolate(Math.abs(artSwipeX.value), [0, SW * 0.25], [0, 1], Extrapolate.CLAMP);

    return {
      opacity: dim * opacity * (1 - surfaceOpenProgress.value),
      borderRadius: currentBorderRadius,
      transform: [
        { translateX: currentTranslateX + artSwipeX.value + transitionOffset },
        { translateY: currentTranslateY + artDismissY.value * 0.3 },
        { scale: currentScale * targetScale },
      ],
      pointerEvents: "none",
    };
  });

  const metaStyle = useAnimatedStyle(() => ({
    opacity: metaFadeProgress.value,
  }));

  const bottomBarOverlayStyle = useAnimatedStyle(() => {
    const p = expandProgress.value;
    const overlayContentOpacity = interpolate(p, [0.08, 0.35], [0, 1], Extrapolate.CLAMP);
    const op = overlayContentOpacity * controlsOpacity.value;
    return { 
      opacity: op, 
      transform: [{ translateY: interpolate(controlsOpacity.value, [0, 1], [12, 0]) }] 
    };
  });

  const queueIconStyle = useAnimatedStyle(() => {
    const isLyricsActive = activeSurface === 'lyrics' || lastSurface === 'lyrics';
    const op = isLyricsActive ? interpolate(surfaceOpenProgress.value, [0, 0.4], [1, 0]) : 1;
    return { opacity: op };
  });

  const menuIconStyle = useAnimatedStyle(() => {
    const isLyricsActive = activeSurface === 'lyrics' || lastSurface === 'lyrics';
    const op = isLyricsActive ? interpolate(surfaceOpenProgress.value, [0, 0.4], [1, 0]) : 1;
    return { opacity: op };
  });

  const lyricsSurfaceStyle = useAnimatedStyle(() => ({ 
    opacity: surfaceOpenProgress.value, 
    transform: [{ translateY: interpolate(surfaceOpenProgress.value, [0, 1], [20, 0]) }] 
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <MiniPlayer 
        expandProgress={expandProgress}
        panGesture={miniGesture}
        bottomOffset={bottomOffset}
      />
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle, { backgroundColor: 'transparent' }]} pointerEvents={isExpanded ? "auto" : "none"}>
        
        <Animated.View style={[StyleSheet.absoluteFill, currentBgStyle, { backgroundColor: '#0C0C14' }]} pointerEvents="none">
          {currentArtwork ? (
            <View style={StyleSheet.absoluteFill}>
              <AuraArtwork 
                source={resolveArtwork({ art: currentArtwork }, 'card')} 
                entityName="Background"
                style={StyleSheet.absoluteFill} 
                contentFit="cover" 
                blurRadius={Platform.OS === "android" ? 80 : 110} 
                cachePolicy="memory-disk" 
              />
              {Platform.OS === "ios" && <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />}
            </View>
          ) : (
            <LinearGradient colors={["#120f26", "#090514"]} style={StyleSheet.absoluteFill} />
          )}
        </Animated.View>

        {(activeSurface === 'lyrics' || lastSurface === 'lyrics') && <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, atmosphereStyle]} pointerEvents="none" />}

        <LinearGradient colors={["transparent", "rgba(0, 0, 0, 0.15)", "rgba(0, 0, 0, 0.38)", "rgba(0, 0, 0, 0.68)", "rgba(0, 0, 0, 0.88)", "rgba(0, 0, 0, 0.98)"]} locations={[0, 0.2, 0.4, 0.6, 0.8, 1]} style={{ position: "absolute", bottom: 0, height: "60%", width: "100%" }} pointerEvents="none" />

        <GestureDetector gesture={expandedPan}><View style={{ position: "absolute", top: 0, width: "100%", height: GESTURE_ZONE }} /></GestureDetector>
        
        <GestureDetector gesture={artworkSwipe}>
          <Animated.View style={[st.artShadow, { position: "absolute", left: (SW - ART_BOX) / 2, top: insets.top + 60, width: ART_BOX, height: ART_BOX, overflow: "hidden" }, expArtStyle]}>
            <AuraArtwork
              source={resolveArtwork(currentTrack, 'player')}
              entityName={currentTrack?.title}
              entityType="song"
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={400}
              cachePolicy="memory-disk"
            />
            {isTransitionLoading && <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color="rgba(255,255,255,0.8)" /></View>}
          </Animated.View>
        </GestureDetector>

        <Animated.View style={[st.artShadow, { position: "absolute", left: (SW - ART_BOX) / 2, top: insets.top + 60, width: ART_BOX, height: ART_BOX, overflow: "hidden" }, transitionArtStyle]} pointerEvents="none">
          <AuraArtwork
            source={resolveArtwork({ art: transitionArtwork }, 'player')}
            entityName="Upcoming"
            entityType="song"
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={400}
            cachePolicy="memory-disk"
          />
        </Animated.View>

        <View style={[st.controlsArea, { top: ART_H - 150 }]}>{Platform.OS === "ios" && <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />}</View>
        <Animated.View style={[st.controlsContent, { top: ART_H + 25, bottom: Math.max(insets.bottom + 8, 20) + 70 }, controlsStyle]} pointerEvents={activeSurface === 'controls' ? "box-none" : "none"}>
          <Animated.View style={[st.infoRow, metaStyle]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Marquee>
                <Text style={st.trackTitle} numberOfLines={1}>{currentTrack?.title || "—"}</Text>
              </Marquee>
              <Marquee style={{ marginTop: 2 }}>
                {renderFormattedArtists()}
              </Marquee>
            </View>
            <View style={st.infoActions}>
              <TouchableOpacity onPress={handleLikePress} disabled={isLocked} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#FF3B30" : "#FFF"} />
              </TouchableOpacity>
              {currentTrack && !isLocalDeviceTrack(currentTrack) && <DownloadButton track={currentTrack} size={24} color="#FFF" />}
            </View>
          </Animated.View>
          <PlaybackScrubber accentColor={AURA_ACCENT} uiPhase={uiPhase} />
          <View style={st.playbackRow}><SkipBtn icon="play-back" label="Prev" onPress={() => !isLocked && PlaybackService.skipToPrevious()} /><PlayPauseBtn isPlaying={isPlaying} onPress={() => !isLocked && handlePlayPause()} /><SkipBtn icon="play-forward" label="Next" onPress={() => !isLocked && PlaybackService.skipToNext()} /></View>
          <VolumeControl uiPhase={uiPhase} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", bottom: Math.max(insets.bottom + 8, 20), width: "100%", zIndex: 20, elevation: 20 }, bottomBarOverlayStyle]}>
          <View style={st.bottomBar}>
            <TouchableOpacity 
              onPress={handleLyricsPress} 
              style={[st.bottomBtn, activeSurface === 'lyrics' && st.bottomBtnActive]}
              accessibilityRole="button"
              accessibilityLabel="Lyrics"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons 
                name={activeSurface === 'lyrics' ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} 
                size={23} 
                color={activeSurface === 'lyrics' ? AURA_ACCENT : "rgba(255,255,255,0.78)"} 
              />
            </TouchableOpacity>
            <Animated.View style={queueIconStyle}>
              <TouchableOpacity 
                onPress={handleQueuePress} 
                style={[st.bottomBtn, activeSurface === 'queue' && st.bottomBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="Queue"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons 
                  name="list-outline" 
                  size={24} 
                  color={activeSurface === 'queue' ? AURA_ACCENT : "rgba(255,255,255,0.78)"} 
                />
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={menuIconStyle}>
              <TouchableOpacity 
                onPress={handleMenuPress} 
                style={[st.bottomBtn, activeSurface === 'menu' && st.bottomBtnActive]}
                accessibilityRole="button"
                accessibilityLabel="More options"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons 
                  name="ellipsis-horizontal" 
                  size={22} 
                  color={activeSurface === 'menu' ? AURA_ACCENT : "rgba(255,255,255,0.78)"} 
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
        {(activeSurface === 'lyrics' || lastSurface === 'lyrics') && currentTrack && (
          <LyricsSurface 
            visible={activeSurface === 'lyrics'} 
            accentColor={AURA_ACCENT} 
            lyricsStyle={lyricsSurfaceStyle} 
            isLocked={isLocked}
            onClose={closeLyrics}
          />
        )}
      </Animated.View>
      {(activeSurface === 'queue' || lastSurface === 'queue') && <QueueSheet isVisible={activeSurface === 'queue'} onClose={closeQueue} accentColor={AURA_ACCENT} />}
      {activeSurface === 'devices' && <DevicePickerSurface visible={true} onClose={closeDevices} accentColor={AURA_ACCENT} />}
      {(activeSurface === 'menu' || lastSurface === 'menu') && currentTrack && <MoreMenuSurface visible={activeSurface === 'menu'} onClose={closeMenu} accentColor={AURA_ACCENT} currentTrack={currentTrack} onAddToPlaylist={() => { closeMenu(); setTimeout(() => setShowPlaylist(true), 150); }} onShare={async () => { closeMenu(); try { await Share.share({ message: `Listening to "${currentTrack.title}" by ${currentTrack.artist}` }); const { useAnalyticsStore } = require('../features/analytics/store/analytics.store'); useAnalyticsStore.getState().trackShared(currentTrack.id); } catch(_) {} }} />}
      {showInsight && currentTrack && <InsightPanel isVisible={true} onClose={() => setShowInsight(false)} track={currentTrack} accentColor={AURA_ACCENT} />}
      {showPlaylist && currentTrack && <AddToPlaylistSheet visible={true} track={currentTrack} onClose={() => setShowPlaylist(false)} />}
    </View>
  );
}

const st = StyleSheet.create({
  artShadow: { shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.35, shadowRadius: 32, elevation: 20 },
  controlsArea: { position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden" },
  controlsContent: { position: "absolute", left: 0, right: 0, paddingHorizontal: 28, justifyContent: "space-between" },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, marginTop: 6 },
  trackTitle: { fontSize: 20, fontWeight: "700", color: "#FFF", letterSpacing: -0.4, marginBottom: 4 },
  artistName: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.60)" },
  infoActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  quickIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  quickIconBtnActive: {
    backgroundColor: "rgba(191,90,242,0.22)",
    borderWidth: 1,
    borderColor: AURA_ACCENT,
  },
  scrubWrap: { gap: 4, marginBottom: 20 },
  scrubTouch: { paddingVertical: 10 },
  scrubTrack: { height: 5, borderRadius: 4.5, backgroundColor: "rgba(255,255,255,0.20)", position: "relative" },
  scrubBg: { ...StyleSheet.absoluteFillObject, borderRadius: 1.5 },
  scrubFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 1.5, backgroundColor: "#FFFFFF" },
  scrubThumb: { position: "absolute", top: -7.5, width: 18, height: 18 },
  scrubThumbDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFF", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  timeLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  playbackRow: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center", marginBottom: 28, paddingHorizontal: 16 },
  playBtn: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  skipBtn: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  volWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  volTouch: { flex: 1, paddingVertical: 10 },
  volTrack: { height: 4, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.20)", position: "relative" },
  volBg: { ...StyleSheet.absoluteFillObject, borderRadius: 1.5 },
  volFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.75)" },
  volThumb: { position: "absolute", top: -6, width: 15, height: 15 },
  volThumbDot: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: "#FFF", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  bottomBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 40 },
  bottomBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  bottomBtnActive: {
    backgroundColor: "rgba(191,90,242,0.18)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(191,90,242,0.4)",
  },
  lyricsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  lyricsCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  lyricsHeaderTitleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  lyricsHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.2,
  },
  lyricsBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  lyricsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  lyricsBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  lyricsBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.75)",
  },
  lyricsEmptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  lyricsRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
  },
  menuModal: { width: "84%", maxWidth: 340, borderRadius: 24, overflow: "hidden", borderWidth: 0.75, borderColor: "rgba(255,255,255,0.2)" },
  menuSheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", borderWidth: 0.75, borderTopColor: "rgba(255,255,255,0.22)", borderLeftColor: "rgba(255,255,255,0.08)", borderRightColor: "rgba(255,255,255,0.08)" },
  menuHeader: { flexDirection: "row", alignItems: "center", padding: 20, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.08)" },
  menuArt: { width: 50, height: 50, borderRadius: 10, marginRight: 14 },
  menuTitle: { fontSize: 18, fontWeight: "800", color: "#FFF", letterSpacing: -0.4 },
  menuArtist: { fontSize: 13, color: "rgba(255,255,255,0.52)", marginTop: 2, fontWeight: "500" },
  menuPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" },
  menuPillText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.85)" },
  menuOptions: { padding: 16, gap: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" },
  menuItemText: { flex: 1, fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
});

export default memo(PlayerOverlay);
