import { useMusic, useMusicActions } from "@/src/context/MusicContext";
import { getTrackById } from "@/src/data/music-catalog";
import { openArtistByName } from "@/src/navigation/music-navigation";
import { LyricsSheet } from "@/src/features/lyrics/components/LyricsSheet";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, memo, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { QueueSheet } from "@/src/features/player/components/QueueSheet";
import { InsightPanel } from "@/src/features/player/components/InsightPanel";

const { width, height } = Dimensions.get("window");

// ── Motion constants ──────────────────────────────────────────────────────────
const SPRING_CONFIG = { damping: 20, stiffness: 150, mass: 1 };

const formatTime = (sec: number) => {
  "worklet";
  if (isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

// ── Liquid Glass Card shell ───────────────────────────────────────────────────
const GlassCard = ({
  children,
  style,
  borderRadius = 20,
  blurIntensity = 65,
}: any) => (
  <View
    style={[
      {
        borderRadius,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      },
      style,
    ]}
  >
    <BlurView
      intensity={blurIntensity}
      tint="dark"
      style={StyleSheet.absoluteFill}
    />
    <View
      style={{
        position: "absolute",
        top: 0,
        left: borderRadius * 0.4,
        right: borderRadius * 0.4,
        height: 1.5,
        backgroundColor: "rgba(255,255,255,0.12)",
        zIndex: 10,
      }}
    />
    <View
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius,
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    />
    {children}
  </View>
);

// ── Interactive Artist Names ────────────────────────────────────────────────
const InteractiveArtistNames = ({ names, onArtistPress }: { names: string, onArtistPress: (name: string) => void }) => {
  const artistList = names.split(/[,&]|\sfeat\.|\sft\./).map(n => n.trim()).filter(Boolean);
  
  if (artistList.length <= 1) {
    return (
      <TouchableOpacity onPress={() => onArtistPress(names)}>
        <Text style={styles.artistName} numberOfLines={1}>
          {names}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.artistNamesRow}>
      {artistList.map((name, index) => (
        <React.Fragment key={name}>
          <TouchableOpacity onPress={() => onArtistPress(name)}>
            <Text style={styles.artistName}>{name}</Text>
          </TouchableOpacity>
          {index < artistList.length - 1 && (
            <Text style={styles.artistSeparator}> • </Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NowPlayingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const {
    play,
    pause,
    next,
    prev,
    toggleRepeat,
    toggleShuffle,
  } = useMusicActions();

  // Low-frequency subscriptions (Metadata and Status)
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isBuffering = usePlayerStore(s => s.isBuffering);
  const status = usePlayerStore(s => s.status);
  const repeatMode = usePlayerStore(s => s.repeatMode === "track" ? 1 : 0);
  const isShuffle = usePlayerStore(s => s.isShuffle);

  const [isLiked, setIsLiked] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [isInsightVisible, setIsInsightVisible] = useState(false);

  // Re-track image loading when track changes
  useEffect(() => {
    setIsImageLoading(true);
  }, [currentTrack?.id]);

  // ── Reanimated Shared Values ────────────────────────────────────────────────
  const artScale = useSharedValue(0.9);
  const artTranslateX = useSharedValue(0);
  const artOpacity = useSharedValue(1);

  const pageOpacity = useSharedValue(0);
  const pageScale = useSharedValue(0.95);

  // Insight Panel Reveal Value
  const insightReveal = useSharedValue(0);

  // Reset art visually when track changes
  useEffect(() => {
    artTranslateX.value = 0;
    artOpacity.value = 0;
    artOpacity.value = withTiming(1, { duration: 400 });
    artScale.value = withSpring(1.05, SPRING_CONFIG);
  }, [currentTrack?.id]);

  useEffect(() => {
    pageOpacity.value = withTiming(1, { duration: 400 });
    pageScale.value = withSpring(1, SPRING_CONFIG);
  }, []);

  useEffect(() => {
    artScale.value = withSpring(isPlaying ? 1.05 : 0.94, SPRING_CONFIG);
  }, [isPlaying]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const horizontalGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      artTranslateX.value = event.translationX;
      artScale.value = 1.05 - Math.abs(event.translationX / width) * 0.2;
      artOpacity.value = 1 - Math.abs(event.translationX / width) * 0.5;
    })
    .onEnd((event) => {
      const threshold = width * 0.25;
      if (event.translationX < -threshold) {
        artTranslateX.value = withTiming(-width, { duration: 200 }, () => {
          runOnJS(next)();
        });
      } else if (event.translationX > threshold) {
        artTranslateX.value = withTiming(width, { duration: 200 }, () => {
          runOnJS(prev)();
        });
      } else {
        artTranslateX.value = withSpring(0, SPRING_CONFIG);
        artScale.value = withSpring(isPlaying ? 1.05 : 0.94, SPRING_CONFIG);
        artOpacity.value = withSpring(1, SPRING_CONFIG);
      }
    });

  const verticalGesture = Gesture.Pan()
    .activeOffsetY([10, 20])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        insightReveal.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 500) {
        runOnJS(setIsInsightVisible)(true);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      }
      insightReveal.value = withSpring(0, SPRING_CONFIG);
    });

  const artGesture = Gesture.Exclusive(horizontalGesture, verticalGesture);

  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: artScale.value },
      { translateX: artTranslateX.value }
    ],
    opacity: artOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
    transform: [{ scale: pageScale.value }],
  }));

  const insightRevealStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: insightReveal.value }],
  }));

  if (!currentTrack) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: "#08080d",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color="#BF5AF2" />
        <Text style={{ color: "rgba(255,255,255,0.6)", marginTop: 16 }}>
          Ready to play
        </Text>
      </View>
    );
  }

  const c0 = currentTrack.dominantColors?.[0] || "#BF5AF2";

  // Artwork Fallback Chain
  const artworkUri = useMemo(() => {
    // 1. Explicit track art
    if (currentTrack.art) return currentTrack.art;
    
    // 2. Fallback to a placeholder based on title/artist if absolutely nothing exists
    // (In a real app, you might have albumArt or artistArt as separate fields in PlayerTrack)
    return `https://picsum.photos/seed/${encodeURIComponent(currentTrack.title)}/800`;
  }, [currentTrack.art, currentTrack.title]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[styles.container, containerStyle]}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />

        {/* ── DYNAMIC BACKGROUND ──────────────────────────────────────── */}
        <View style={StyleSheet.absoluteFill}>
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: "#08080d" }]}
          />
          <LinearGradient
            colors={[c0 + "66", c0 + "22", "transparent"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              "rgba(8,8,13,0.4)",
              "rgba(8,8,13,0.8)",
              "rgba(8,8,13,0.95)",
            ]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <Animated.View style={[styles.mainCanvas, insightRevealStyle, { paddingTop: insets.top + 4 }]}>
          {/* Header */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerIcon}
            >
              <Ionicons name="chevron-down-outline" size={30} color={c0} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsInfoVisible(true)}
              style={styles.headerIcon}
            >
              <Ionicons
                name="ellipsis-horizontal-circle-outline"
                size={28}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>
          </View>

          {/* Album Art */}
          <GestureDetector gesture={artGesture}>
            <View style={styles.albumArtSection}>
              <Animated.View style={[styles.artOuterGlow, { shadowColor: c0 }]} />
              <Animated.View style={[styles.artGlassContainer, artStyle]}>
                <Image
                  source={{ uri: artworkUri }}
                  style={styles.albumImage}
                  contentFit="cover"
                  transition={400}
                  priority="high"
                  cachePolicy="memory-disk"
                  onLoad={() => setIsImageLoading(false)}
                  onError={() => {
                    // Final fallback if loading failed
                    setIsImageLoading(false);
                  }}
                />
                
                {/* Fallback Art Card if image definitely failed */}
                {(!artworkUri || status === 'error') && (
                  <View style={[StyleSheet.absoluteFill, styles.fallbackArtContainer]}>
                    <LinearGradient
                      colors={[c0, "#1a1a1a"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="musical-note" size={80} color="rgba(255,255,255,0.2)" />
                  </View>
                )}
                
                {/* Error Overlay */}
                {status === 'error' && (
                  <View style={[StyleSheet.absoluteFill, styles.errorOverlay]}>
                    <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.errorText}>sorry we couldn't fetch the music</Text>
                  </View>
                )}

                {/* Loading Overlay */}
                {(isBuffering || isImageLoading) && (
                   <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
                     <ActivityIndicator size="large" color={c0} />
                   </View>
                )}
              </Animated.View>
            </View>
          </GestureDetector>

          {/* Song Info */}
          <View style={styles.songInfoSection}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <InteractiveArtistNames 
                names={currentTrack.artist} 
                onArtistPress={(name) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openArtistByName(router, name);
                }} 
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                setIsLiked(!isLiked);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={styles.likeBtn}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={28}
                color={isLiked ? c0 : "rgba(255,255,255,0.3)"}
              />
            </TouchableOpacity>
          </View>

          {/* Optimized Scrubber Section */}
          <PlaybackScrubber accentColor={c0} />

          {/* Playback Controls */}
          <View style={styles.playbackControls}>
            <TouchableOpacity
              onPress={() => {
                prev();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={styles.skipBtn}
            >
              <Ionicons name="play-skip-back" size={36} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                isPlaying ? pause() : play();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }}
              style={[styles.playButton, { backgroundColor: c0 }]}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={44}
                color="#FFF"
                style={{ marginLeft: isPlaying ? 0 : 5 }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                next();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={styles.skipBtn}
            >
              <Ionicons name="play-skip-forward" size={36} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Extra Controls */}
          <View style={styles.secondaryControls}>
            <TouchableOpacity onPress={toggleShuffle}>
              <Ionicons
                name="shuffle"
                size={24}
                color={isShuffle ? c0 : "rgba(255,255,255,0.4)"}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                router.push('/lyrics');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons
                name="musical-notes"
                size={22}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsQueueVisible(true)}>
              <Ionicons
                name="list"
                size={26}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleRepeat}>
              <Ionicons
                name={repeatMode === 1 ? "repeat" : "repeat-outline"}
                size={24}
                color={repeatMode === 1 ? c0 : "rgba(255,255,255,0.4)"}
              />
            </TouchableOpacity>
          </View>

          {/* Optimized Volume Section */}
          <VolumeControl accentColor={c0} />
        </Animated.View>

        {/* Info Modal */}
        <Modal
          visible={isInfoVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsInfoVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsInfoVisible(false)}
          >
            <BlurView
              intensity={40}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <GlassCard style={styles.infoModal} borderRadius={32}>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Track Details</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Format</Text>
                  <Text style={styles.infoValue}>FLAC 24-bit / 48kHz</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Source</Text>
                  <Text style={styles.infoValue}>Aura Premium Master</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsInfoVisible(false)}
                  style={[styles.closeBtn, { backgroundColor: c0 }]}
                >
                  <Text style={styles.closeBtnText}>DONE</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </TouchableOpacity>
        </Modal>

        {/* Queue Sheet */}
        <QueueSheet 
          isVisible={isQueueVisible} 
          onClose={() => setIsQueueVisible(false)} 
          accentColor={c0}
        />

        {/* Insight Panel */}
        <InsightPanel 
          isVisible={isInsightVisible} 
          onClose={() => setIsInsightVisible(false)} 
          track={currentTrack}
          accentColor={c0}
        />
      </Animated.View>
    </GestureHandlerRootView>
  );
}

// ── Optimized Sub-Components ──────────────────────────────────────────────────

const PlaybackScrubber = memo(({ accentColor }: { accentColor: string }) => {
  const seek = usePlayerStore(s => s.seek);
  const progress = usePlayerStore(s => s.duration > 0 ? s.position / s.duration : 0);
  const elapsed = usePlayerStore(s => s.position / 1000);
  const durationSec = usePlayerStore(s => s.duration / 1000);

  const scrubberX = useSharedValue(0);
  const scrubberWidth = useSharedValue(0);
  const isScrubbing = useSharedValue(false);
  const thumbScale = useSharedValue(1);

  useEffect(() => {
    if (!isScrubbing.value && scrubberWidth.value > 0) {
      // Duration matches polling interval for smooth movement
      scrubberX.value = withTiming(progress * scrubberWidth.value, { duration: 250 });
    }
  }, [progress]);

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      isScrubbing.value = true;
      thumbScale.value = withSpring(1.4, SPRING_CONFIG);
      scrubberX.value = Math.max(0, Math.min(event.x, scrubberWidth.value));
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      scrubberX.value = Math.max(0, Math.min(event.x, scrubberWidth.value));
    })
    .onEnd(() => {
      isScrubbing.value = false;
      thumbScale.value = withSpring(1, SPRING_CONFIG);
      const newProgress = scrubberWidth.value > 0 ? scrubberX.value / scrubberWidth.value : 0;
      runOnJS(seek)(newProgress * durationSec * 1000);
      runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
    });

  const tapGesture = Gesture.Tap()
    .onStart((event) => {
      scrubberX.value = withTiming(Math.max(0, Math.min(event.x, scrubberWidth.value)), { duration: 200 });
      const newProgress = scrubberWidth.value > 0 ? event.x / scrubberWidth.value : 0;
      runOnJS(seek)(newProgress * durationSec * 1000);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    });

  const scrubberGesture = Gesture.Race(panGesture, tapGesture);

  const scrubberFillStyle = useAnimatedStyle(() => ({ width: scrubberX.value }));
  const scrubberThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrubberX.value - 10 }, { scale: thumbScale.value }],
  }));

  const displayElapsed = useDerivedValue(() => {
    if (isScrubbing.value && scrubberWidth.value > 0) {
      return Math.round((scrubberX.value / scrubberWidth.value) * durationSec);
    }
    return elapsed;
  });

  const elapsedText = useDerivedValue(() => formatTime(displayElapsed.value));
  const remainingText = useDerivedValue(() => `-${formatTime(Math.max(0, durationSec - displayElapsed.value))}`);

  return (
    <View style={styles.scrubberSection}>
      <GestureDetector gesture={scrubberGesture}>
        <Animated.View style={styles.scrubberContainer}>
          <GlassCard style={styles.scrubberCard} borderRadius={8} blurIntensity={20}>
            <View style={styles.scrubberOuter} onLayout={(e) => { scrubberWidth.value = e.nativeEvent.layout.width; }}>
              <Animated.View style={[styles.scrubberInner, scrubberFillStyle, { backgroundColor: accentColor }]} />
              <Animated.View style={[styles.scrubberThumb, scrubberThumbStyle]} />
            </View>
          </GlassCard>
        </Animated.View>
      </GestureDetector>
      <View style={styles.timeLabels}>
        <AnimatedTimeLabel text={elapsedText} />
        <AnimatedTimeLabel text={remainingText} />
      </View>
    </View>
  );
});

const VolumeControl = memo(({ accentColor }: { accentColor: string }) => {
  const nativeVolume = usePlayerStore(s => s.volume);
  const setVolume = usePlayerStore(s => s.setVolume);
  
  const volumeX = useSharedValue(nativeVolume);
  const volumeWidth = useSharedValue(0);
  const isAdjustingVolume = useSharedValue(false);

  useEffect(() => {
    if (!isAdjustingVolume.value) {
      volumeX.value = nativeVolume;
    }
  }, [nativeVolume]);

  const volumeGesture = Gesture.Pan()
    .onStart((event) => {
      isAdjustingVolume.value = true;
      const vol = volumeWidth.value > 0 ? Math.max(0, Math.min(event.x / volumeWidth.value, 1)) : 0;
      volumeX.value = vol;
      runOnJS(setVolume)(vol);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      const vol = volumeWidth.value > 0 ? Math.max(0, Math.min(event.x / volumeWidth.value, 1)) : 0;
      volumeX.value = vol;
      runOnJS(setVolume)(vol);
    })
    .onEnd(() => {
      isAdjustingVolume.value = false;
    });

  const volumeFillStyle = useAnimatedStyle(() => ({ width: volumeX.value * volumeWidth.value }));
  const volumeThumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: volumeX.value * volumeWidth.value - 7 }] }));

  return (
    <View style={styles.volumeSection}>
      <Ionicons name="volume-low" size={18} color="rgba(255,255,255,0.2)" />
      <GestureDetector gesture={volumeGesture}>
        <Animated.View style={styles.volumeTrackContainer}>
          <GlassCard style={styles.volumeCard} borderRadius={4} blurIntensity={20}>
            <View style={styles.volumeTrack} onLayout={(e) => { volumeWidth.value = e.nativeEvent.layout.width; }}>
              <Animated.View style={[styles.volumeFill, volumeFillStyle, { backgroundColor: accentColor }]} />
              <Animated.View style={[styles.volumeThumb, volumeThumbStyle]} />
            </View>
          </GlassCard>
        </Animated.View>
      </GestureDetector>
      <Ionicons name="volume-high" size={18} color="rgba(255,255,255,0.2)" />
    </View>
  );
});


const AnimatedTimeLabel = memo(({ text }: { text: any }) => {
  const [label, setLabel] = useState("00:00");

  useDerivedValue(() => {
    runOnJS(setLabel)(text.value);
  });

  return <Text style={styles.timeLabel}>{label}</Text>;
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08080d" },
  mainCanvas: { flex: 1, paddingHorizontal: 28, paddingBottom: 32 },
  dragHandleContainer: { alignItems: "center", marginBottom: 16 },
  dragHandle: {
    width: 36,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  nowPlayingLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  albumArtSection: {
    flex: 1.2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  artOuterGlow: {
    position: "absolute",
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
  },
  artGlassContainer: {
    width: width * 0.78,
    aspectRatio: 1,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    elevation: 20,
  },
  albumImage: { flex: 1 },
  errorOverlay: {
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 16,
    opacity: 0.9,
  },
  fallbackArtContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  songInfoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 28,
  },
  trackTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.5,
  },
  skeletonTitle: {
    width: "70%",
    height: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    marginBottom: 4,
  },
  skeletonArtist: {
    width: "45%",
    height: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 4,
    marginTop: 8,
  },
  artistName: {
    fontSize: 17,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
    fontWeight: "500",
  },
  artistNamesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  artistSeparator: {
    fontSize: 17,
    color: "rgba(255,255,255,0.3)",
    fontWeight: "500",
  },
  likeBtn: { padding: 6 },
  scrubberSection: { marginBottom: 28 },
  scrubberContainer: { paddingVertical: 10 },
  scrubberCard: { height: 6 },
  scrubberOuter: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    position: "relative",
  },
  scrubberInner: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  scrubberThumb: {
    position: "absolute",
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  timeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timeLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  playbackControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 36,
  },
  skipBtn: { padding: 10 },
  playButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
  },
  secondaryControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
    marginBottom: 28,
  },
  volumeSection: { flexDirection: "row", alignItems: "center", gap: 12 },
  volumeTrackContainer: { flex: 1, paddingVertical: 10 },
  volumeCard: { height: 4 },
  volumeTrack: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    position: "relative",
  },
  volumeFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  volumeThumb: {
    position: "absolute",
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFF",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  infoModal: { width: "100%", padding: 24 },
  infoContent: { gap: 20 },
  infoTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  infoRow: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { color: "rgba(255,255,255,0.4)", fontWeight: "600" },
  infoValue: { color: "#FFF", fontWeight: "700" },
  closeBtn: {
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  closeBtnText: { color: "#000", fontWeight: "900", letterSpacing: 1 },
});
