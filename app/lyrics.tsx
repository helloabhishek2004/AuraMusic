import { usePlayerStore } from "@/src/features/player/store/player.store";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
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
  Animated,
  Dimensions,
  Easing,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Design tokens — same palette as Downloads ─────────────────────────────────
const C = {
  bg: "#08080D",
  surface: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.10)",
  borderTop: "rgba(255,255,255,0.18)",
  text: "#FFFFFF",
  muted: "rgba(170,170,185,0.65)",
  dim: "rgba(170,170,185,0.18)",
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
  accent: "#46f5e0",
};

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_SPRING_SOFT = Easing.bezier(0.34, 1.28, 0.64, 1);

// ── Glass surface ─────────────────────────────────────────────────────────────
const Glass = ({
  children,
  style,
  r = 24,
  blur = 48,
}: {
  children: React.ReactNode;
  style?: any;
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
    {children}
  </View>
);

// ── Ambient orb background ────────────────────────────────────────────────────
const AmbientBG = memo(({ accent }: { accent: string }) => {
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  const orb3 = useRef(new Animated.Value(0)).current;

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
    pulse(orb1, 6000, 0);
    pulse(orb2, 8000, 2000);
    pulse(orb3, 5000, 1000);
  }, []);

  const s1 = orb1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const s2 = orb2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const s3 = orb3.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const o1 = orb1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.22],
  });
  const o2 = orb2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.14],
  });
  const o3 = orb3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, 0.09],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
      <LinearGradient
        colors={[`${accent}18`, "transparent", C.bg]}
        style={StyleSheet.absoluteFill}
      />
      {/* Accent orb top */}
      <Animated.View
        style={{
          position: "absolute",
          top: -100,
          left: SW * 0.1,
          width: SW * 0.9,
          height: SW * 0.9,
          borderRadius: SW * 0.45,
          backgroundColor: accent,
          opacity: o1,
          transform: [{ scale: s1 }],
        }}
      />
      {/* Primary orb bottom-right */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 80,
          right: -80,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: C.primary,
          opacity: o2,
          transform: [{ scale: s2 }],
        }}
      />
      {/* Accent teal orb mid-left */}
      <Animated.View
        style={{
          position: "absolute",
          top: SH * 0.45,
          left: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: C.accent,
          opacity: o3,
          transform: [{ scale: s3 }],
        }}
      />
    </View>
  );
});

// ── Word-by-word animated lyric line ─────────────────────────────────────────
const AnimatedLyricLine = memo(
  ({
    text,
    isActive,
    wasActive,
    isSynced,
    onPress,
    accent,
    index,
    activeIndex,
  }: {
    text: string;
    isActive: boolean;
    wasActive: boolean;
    isSynced: boolean;
    onPress: () => void;
    accent: string;
    index: number;
    activeIndex: number;
  }) => {
    const words = useMemo(
      () => text.trim().split(/\s+/).filter(Boolean),
      [text],
    );
    const wordAnims = useRef<Animated.Value[]>([]).current;
    const lineScale = useRef(new Animated.Value(1)).current;
    const lineOpacity = useRef(new Animated.Value(0.18)).current;
    const glowOpacity = useRef(new Animated.Value(0)).current;
    const prevActive = useRef(false);

    useEffect(() => {
      if (wordAnims.length !== words.length) {
        wordAnims.splice(
          0,
          wordAnims.length,
          ...words.map(() => new Animated.Value(0)),
        );
      }
    }, [words.length, wordAnims, words]);

    useEffect(() => {
      if (isActive && !prevActive.current) {
        // Line becomes active: scale up + glow in
        Animated.parallel([
          Animated.spring(lineScale, {
            toValue: 1.04,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(lineOpacity, {
            toValue: 1,
            duration: 300,
            easing: EASE_OUT_EXPO,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 350,
            easing: EASE_OUT_EXPO,
            useNativeDriver: true,
          }),
        ]).start();

        // Stagger word reveals
        const stagger = Animated.stagger(
          Math.min(55, 340 / words.length),
          wordAnims.map((a) =>
            Animated.spring(a, {
              toValue: 1,
              tension: 90,
              friction: 7,
              useNativeDriver: true,
            }),
          ),
        );
        stagger.start();
      } else if (!isActive && prevActive.current) {
        // Line becomes inactive: scale back, fade
        Animated.parallel([
          Animated.spring(lineScale, {
            toValue: 1,
            tension: 60,
            friction: 9,
            useNativeDriver: true,
          }),
          Animated.timing(lineOpacity, {
            toValue: index < activeIndex ? 0.12 : 0.22,
            duration: 400,
            easing: EASE_OUT_EXPO,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        // Reset word anims
        wordAnims.forEach((a) => a.setValue(0));
      } else if (!isActive && !prevActive.current) {
        // Initial render opacity
        const targetOp = index < activeIndex ? 0.12 : 0.22;
        lineOpacity.setValue(targetOp);
        wordAnims.forEach((a) => a.setValue(0));
      }
      prevActive.current = isActive;
    }, [isActive, activeIndex]);

    const distance = Math.abs(index - activeIndex);
    const proximityScale = isActive
      ? 1
      : distance === 1
        ? 0.96
        : distance === 2
          ? 0.93
          : 0.9;

    return (
      <TouchableOpacity
        activeOpacity={isSynced ? 0.75 : 1}
        onPress={onPress}
        disabled={!isSynced}
        style={[styles.lyricItem, { minHeight: isActive ? 56 : 48 }]}
        accessibilityLabel={`Lyric: ${text}${isActive ? ", currently playing" : ""}`}
        accessibilityRole={isSynced ? "button" : "text"}
      >
        {/* Glow blob behind active line */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 18,
                backgroundColor: accent,
                opacity: Animated.multiply(glowOpacity, 0.08),
                transform: [{ scaleX: 1.08 }],
              },
            ]}
            pointerEvents="none"
          />
        </View>

        <Animated.View
          style={{
            transform: [
              {
                scale: Animated.multiply(lineScale, proximityScale),
              },
            ],
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 0,
          }}
        >
          {isActive ? (
            words.map((word, wi) => {
              const wordAnim = wordAnims[wi] || new Animated.Value(0);
              const wordScale = wordAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              });
              const wordOpacity = wordAnim.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0, 0.6, 1],
              });
              const wordTranslateY = wordAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              });
              return (
                <Animated.Text
                  key={wi}
                  style={[
                    styles.lyricTextActive,
                    {
                      color: "#FFFFFF",
                      textShadowColor: accent,
                      textShadowRadius: 20,
                      opacity: wordOpacity,
                      transform: [
                        { scale: wordScale },
                        { translateY: wordTranslateY },
                      ],
                      marginRight: 7,
                    },
                  ]}
                >
                  {word}
                </Animated.Text>
              );
            })
          ) : (
            <Animated.Text
              style={[styles.lyricTextInactive, { opacity: lineOpacity }]}
            >
              {text}
            </Animated.Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  },
);

// ── Floating seek indicator ───────────────────────────────────────────────────
const SeekIndicator = memo(
  ({ visible, accent }: { visible: boolean; accent: string }) => {
    const op = useRef(new Animated.Value(0)).current;
    const ty = useRef(new Animated.Value(8)).current;
    useEffect(() => {
      Animated.parallel([
        Animated.timing(op, {
          toValue: visible ? 1 : 0,
          duration: 280,
          easing: EASE_OUT_EXPO,
          useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: visible ? 0 : 8,
          duration: 280,
          easing: EASE_OUT_EXPO,
          useNativeDriver: true,
        }),
      ]).start();
    }, [visible]);
    return (
      <View style={styles.seekIndicator} pointerEvents="none">
        <Animated.View
          style={{ opacity: op, transform: [{ translateY: ty }] }}
          pointerEvents="none"
        >
          <Glass
            r={20}
            blur={40}
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons name="hand-left-outline" size={14} color={accent} />
              <Text style={{ fontSize: 12, color: accent, fontWeight: "700" }}>
                Tap a line to jump
              </Text>
            </View>
          </Glass>
        </Animated.View>
      </View>
    );
  },
);

// ── Mini progress bar ─────────────────────────────────────────────────────────
const ProgressBar = memo(
  ({
    elapsed,
    duration,
    accent,
  }: {
    elapsed: number;
    duration: number;
    accent: string;
  }) => {
    const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 0;
    const anim = useRef(new Animated.Value(progress)).current;
    useEffect(() => {
      Animated.timing(anim, {
        toValue: progress,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    }, [progress]);
    const barW = anim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    });
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };
    return (
      <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: barW }]}>
            <LinearGradient
              colors={[accent, C.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressTime}>{fmt(elapsed)}</Text>
          <Text style={styles.progressTime}>{fmt(duration)}</Text>
        </View>
      </View>
    );
  },
);

// ── Empty / loading states ────────────────────────────────────────────────────
const EmptyState = memo(
  ({ isLoading, accent }: { isLoading: boolean; accent: string }) => {
    const floatAnim = useRef(new Animated.Value(0)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
      if (isLoading) {
        Animated.loop(
          Animated.timing(spinAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ).start();
      }
    }, [isLoading]);
    const floatY = floatAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -10],
    });
    const rotate = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
    return (
      <View style={styles.centered}>
        <Animated.View
          style={{ transform: [{ translateY: floatY }], marginBottom: 20 }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: `${accent}15`,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 1,
              borderColor: `${accent}30`,
            }}
          >
            {isLoading ? (
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Ionicons name="musical-note" size={36} color={accent} />
              </Animated.View>
            ) : (
              <Ionicons name="musical-notes-outline" size={36} color={accent} />
            )}
          </View>
        </Animated.View>
        <Text style={styles.statusText}>
          {isLoading ? "Finding lyrics…" : "No lyrics available for this track"}
        </Text>
      </View>
    );
  },
);

// ── Main screen ────────────────────────────────────────────────────────────────
export default function LyricsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const lyricsData = usePlayerStore((s) => s.lyrics);
  const isLoading = usePlayerStore((s) => s.isLyricsLoading);
  const elapsedSec = usePlayerStore((s) => s.position / 1000);
  const durationSec = usePlayerStore((s) => s.duration / 1000);

  const flashListRef = useRef<any>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showSeekHint, setShowSeekHint] = useState(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = currentTrack?.dominantColors?.[0] || C.primary;

  const lyrics = useMemo(() => lyricsData?.lyrics || [], [lyricsData]);
  const isSynced = useMemo(() => lyricsData?.synced || false, [lyricsData]);

  // Header entrance
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTY = useRef(new Animated.Value(-16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 500,
        easing: EASE_OUT_EXPO,
        useNativeDriver: true,
      }),
      Animated.timing(headerTY, {
        toValue: 0,
        duration: 500,
        easing: EASE_OUT_EXPO,
        useNativeDriver: true,
      }),
    ]).start();
    // Show seek hint after 1s if synced
    if (isSynced) {
      hintTimeout.current = setTimeout(() => {
        setShowSeekHint(true);
        setTimeout(() => setShowSeekHint(false), 2800);
      }, 1200);
    }
    return () => {
      if (hintTimeout.current) clearTimeout(hintTimeout.current);
    };
  }, [isSynced]);

  const activeIndex = useMemo(() => {
    if (!isSynced || !lyrics.length) return -1;
    const currentMs = elapsedSec * 1000;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= currentMs) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, elapsedSec, isSynced]);

  const prevActiveIndex = useRef(-1);
  useEffect(() => {
    prevActiveIndex.current = activeIndex;
  }, [activeIndex]);

  // Auto-scroll
  useEffect(() => {
    if (isSynced && activeIndex >= 0 && !isUserScrolling) {
      flashListRef.current?.scrollToIndex({
        index: activeIndex,
        animated: true,
        viewPosition: 0.35,
      });
    }
  }, [activeIndex, isSynced, isUserScrolling]);

  const handleScrollBegin = useCallback(() => {
    setIsUserScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
  }, []);

  const handleScrollEnd = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => setIsUserScrolling(false), 3200);
  }, []);

  const handleLyricPress = useCallback(
    (item: any) => {
      if (isSynced && item.time >= 0) {
        usePlayerStore.getState().seek(item.time);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsUserScrolling(false);
      }
    },
    [isSynced],
  );

  const onShare = useCallback(async () => {
    if (!currentTrack) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `🎵 "${currentTrack.title}" by ${currentTrack.artist} — on AuraMusic`,
      });
    } catch (_) {}
  }, [currentTrack]);

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <AnimatedLyricLine
        text={item.text}
        isActive={index === activeIndex}
        wasActive={index === prevActiveIndex.current}
        isSynced={isSynced}
        accent={accent}
        onPress={() => handleLyricPress(item)}
        index={index}
        activeIndex={activeIndex}
      />
    ),
    [activeIndex, isSynced, accent, handleLyricPress],
  );

  if (!currentTrack) return null;

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <AmbientBG accent={accent} />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            opacity: headerOpacity,
            transform: [{ translateY: headerTY }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close lyrics"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-down" size={26} color={C.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {/* Pill label */}
          <View style={styles.lyricsPill}>
            <Text style={[styles.lyricsPillText, { color: accent }]}>
              LYRICS
            </Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.headerArtist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={onShare}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Share this track"
          accessibilityRole="button"
        >
          <Ionicons name="share-outline" size={22} color={C.text} />
        </TouchableOpacity>
      </Animated.View>

      {/* Lyrics list or states */}
      <View style={{ flex: 1 }}>
        {isLoading || lyrics.length === 0 ? (
          <EmptyState isLoading={isLoading} accent={accent} />
        ) : (
          <FlashList
            ref={flashListRef}
            data={lyrics}
            keyExtractor={(_: any, i: number) => i.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={handleScrollBegin}
            onScrollEndDrag={handleScrollEnd}
            onMomentumScrollEnd={handleScrollEnd}
          />
        )}
      </View>

      {/* Bottom glass bar — progress + seek hint */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Glass r={28} blur={52} style={styles.bottomGlass}>
          {/* Track mini-header */}
          <View style={styles.miniHeader}>
            {currentTrack.art ? (
              <Image
                source={{ uri: currentTrack.art }}
                style={styles.miniArt}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View
                style={[
                  styles.miniArt,
                  {
                    backgroundColor: `${accent}22`,
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
              >
                <Ionicons name="musical-note" size={20} color={accent} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.miniTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.miniArtist} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
            {isSynced && (
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: `${accent}18`,
                  borderWidth: 1,
                  borderColor: `${accent}30`,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: accent,
                    letterSpacing: 0.8,
                  }}
                >
                  SYNCED
                </Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          <ProgressBar
            elapsed={elapsedSec}
            duration={durationSec}
            accent={accent}
          />
        </Glass>

        {/* Seek hint */}
        <SeekIndicator visible={showSeekHint} accent={accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  lyricsPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 4,
  },
  lyricsPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  headerTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerArtist: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "500",
  },

  // List
  listContent: {
    paddingTop: SH * 0.08,
    paddingBottom: SH * 0.28,
    paddingHorizontal: 28,
  },
  lyricItem: {
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginVertical: 2,
  },
  lyricTextActive: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 38,
    fontFamily: Platform.OS === "android" ? "sans-serif-black" : "System",
    letterSpacing: -0.4,
  },
  lyricTextInactive: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 36,
    color: C.text,
    fontFamily: Platform.OS === "android" ? "sans-serif-black" : "System",
    letterSpacing: -0.3,
  },

  // States
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  statusText: {
    color: C.muted,
    fontSize: 15,
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 22,
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
  },
  bottomGlass: {
    width: "100%",
    overflow: "hidden",
  },
  miniHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingBottom: 10,
  },
  miniArt: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  miniTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  miniArtist: {
    color: C.muted,
    fontSize: 12,
    marginTop: 1,
  },

  // Progress
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 2,
    overflow: "hidden",
    marginHorizontal: 20,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  progressTime: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // Seek indicator
  seekIndicator: {
    position: "absolute",
    bottom: "110%",
    alignSelf: "center",
  },
});
