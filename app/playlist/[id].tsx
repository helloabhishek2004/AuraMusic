import { LiquidGlass } from "@/src/components/ui/liquid-glass";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { MotionTiming, MotionSpring, MotionEasing } from "@/src/design/motion";
import { ScrollPhysics } from "@/src/design/scroll-physics";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  InteractionManager,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaybackInsets } from "@/src/hooks/use-playback-insets";

import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  runOnJS,
  interpolate,
  Extrapolation,
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  Easing as EasingReanimated,
  SharedValue,
} from "react-native-reanimated";

const AnimatedDraggableFlatList = AnimatedReanimated.createAnimatedComponent(
  DraggableFlatList,
) as unknown as typeof DraggableFlatList;

import { FlashList } from "@shopify/flash-list";
const AnimatedFlashList = AnimatedReanimated.createAnimatedComponent(
  FlashList,
) as any;

import { usePressScale } from "@/src/components/ui/press-scale";
import { useMusicControls } from "@/src/context/MusicContext";
import { useDownloadStore } from "@/src/features/download/store/download.store";
import { useLikesStore } from "@/src/features/likes/store/likes.store";
import { getLikedTracks } from "@/src/features/likes/utils/get-liked-tracks";
import { PlaybackService } from "@/src/features/player/services/playback.service";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { PlayerTrack } from "@/src/features/player/types/player";
import PlaylistArtwork from "@/src/features/playlist/components/PlaylistArtwork";
import { usePlaylistStore } from "@/src/features/playlist/store/playlist.store";
import { useRecommendationsStore } from "@/src/features/recommendations/store/recommendations.store";
import { openArtistByName } from "@/src/navigation/music-navigation";
import { getTrackArtwork, getArtworkUrl } from "@/src/features/player/utils/track-identity";
import { resolveArtwork } from "@/src/features/player/utils/artwork-resolver";
import { AuraArtwork } from "@/src/components/ui/aura-artwork";
import { useNetInfo } from "@react-native-community/netinfo";
import { requestIdleTask } from "@/src/utils/idle-task";

const { width, height } = Dimensions.get("window");

// ── Design Tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
  primaryDeep: "#7B2FBE",
  primaryContainer: "#6200EE",
  surface: "rgba(18,18,22,0.72)",
  surfaceMid: "rgba(28,28,36,0.68)",
  onSurface: "#FFFFFF",
  onSurfaceVariant: "rgba(170,170,185,0.65)",
  borderGlass: "rgba(255,255,255,0.09)",
  borderHighlight: "rgba(255,255,255,0.18)",
  topEdgeLight: "rgba(255,255,255,0.13)",
  accent: "#46f5e0",
};

// ── iOS 26 Liquid Glass Tokens ────────────────────────────────────────────────
const GLASS = {
  // Frosted layer
  frost: "rgba(255,255,255,0.07)",
  frostMid: "rgba(255,255,255,0.11)",
  frostStrong: "rgba(255,255,255,0.16)",
  // Borders
  borderSubtle: "rgba(255,255,255,0.10)",
  borderMed: "rgba(255,255,255,0.18)",
  borderBright: "rgba(255,255,255,0.26)",
  // Specular highlights
  specularTop: "rgba(255,255,255,0.28)",
  specularLeft: "rgba(255,255,255,0.18)",
  // Left-edge glow
  leftGlow: "rgba(191,90,242,0.55)",
  leftGlowDiffuse: "rgba(191,90,242,0.22)",
  // Inner shadows / depth
  innerShadow: "rgba(0,0,0,0.32)",
  // Refraction tint
  refractionTint: "rgba(191,90,242,0.06)",
};

const hexToRgba = (color: string, a: number) => {
  if (!color) return `rgba(255,255,255,${a})`;
  if (typeof color !== "string") return `rgba(255,255,255,${a})`;
  if (color.startsWith("rgba")) return color.replace(/[\d\.]+\)$/g, `${a})`);
  if (color.startsWith("rgb"))
    return color.replace("rgb", "rgba").replace(")", `, ${a})`);
  const hex = color.replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return `rgba(255,255,255,${a})`;
};

// ── iOS 26 Liquid Glass Surface ───────────────────────────────────────────────
const LiquidGlassSurface = React.memo(
  ({
    style,
    children,
    borderRadius = 20,
    blurIntensity = 55,
    glowColor,
    glowOpacity = 0,
    showLeftGlow = false,
    leftGlowAnimValue,
    showTopSpecular = true,
    showLeftSpecular = true,
    enableRipple = false,
    onPress,
    activeOpacity = 0.92,
    accessible,
    accessibilityLabel,
    accessibilityRole,
  }: {
    style?: any;
    children?: React.ReactNode;
    borderRadius?: number;
    blurIntensity?: number;
    glowColor?: string;
    glowOpacity?: number;
    showLeftGlow?: boolean;
    leftGlowAnimValue?: any;
    showTopSpecular?: boolean;
    showLeftSpecular?: boolean;
    enableRipple?: boolean;
    onPress?: () => void;
    activeOpacity?: number;
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: any;
  }) => {
    const rippleAnim = useRef(new Animated.Value(0)).current;
    const rippleOpacity = useRef(new Animated.Value(0)).current;

    const leftGlowCoreStyle = useAnimatedStyle(() => {
      if (!leftGlowAnimValue) return { opacity: 0.6 };
      return {
        opacity: interpolate(leftGlowAnimValue.value, [0, 1], [0.45, 0.85], Extrapolation.CLAMP),
      };
    });

    const leftGlowDiffuseStyle = useAnimatedStyle(() => {
      if (!leftGlowAnimValue) return { opacity: 0.22 };
      return {
        opacity: interpolate(leftGlowAnimValue.value, [0, 1], [0.18, 0.38], Extrapolation.CLAMP),
      };
    });

    const triggerRipple = useCallback(() => {
      rippleAnim.setValue(0);
      rippleOpacity.setValue(0.45);
      Animated.parallel([
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }, [rippleAnim, rippleOpacity]);

    const resolvedGlowColor = glowColor || COLORS.primary;

    const content = (
      <View
        style={[
          glassStyles.surface, 
          { 
            borderRadius,
            backgroundColor: Platform.OS === 'android' ? 'rgba(20, 20, 28, 0.94)' : COLORS.surface 
          }, 
          style
        ]}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
      >
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={blurIntensity}
            tint="dark"
            style={[StyleSheet.absoluteFill, { borderRadius }]}
          />
        )}

        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              backgroundColor: GLASS.refractionTint,
            },
          ]}
          pointerEvents="none"
        />

        <LinearGradient
          colors={[GLASS.frostMid, GLASS.frost, "rgba(255,255,255,0.03)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          pointerEvents="none"
        />

        {showTopSpecular && (
          <View
            style={[
              glassStyles.topSpecular,
              {
                borderRadius: borderRadius,
                borderTopLeftRadius: borderRadius,
                borderTopRightRadius: borderRadius,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {showLeftSpecular && (
          <View
            style={[
              glassStyles.leftSpecular,
              {
                borderTopLeftRadius: borderRadius,
                borderBottomLeftRadius: borderRadius,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {showLeftGlow && (
          <>
            <AnimatedReanimated.View
              style={[
                glassStyles.leftGlowCore,
                {
                  borderTopLeftRadius: borderRadius,
                  borderBottomLeftRadius: borderRadius,
                  backgroundColor: resolvedGlowColor,
                },
                leftGlowCoreStyle,
              ]}
              pointerEvents="none"
            />
            <AnimatedReanimated.View
              style={[
                glassStyles.leftGlowDiffuse,
                {
                  borderTopLeftRadius: borderRadius,
                  borderBottomLeftRadius: borderRadius,
                  backgroundColor: resolvedGlowColor,
                },
                leftGlowDiffuseStyle,
              ]}
              pointerEvents="none"
            />
          </>
        )}

        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              borderWidth: 1,
              borderColor: GLASS.borderMed,
              backgroundColor: "transparent",
            },
          ]}
          pointerEvents="none"
        />

        <LinearGradient
          colors={["transparent", GLASS.innerShadow]}
          start={{ x: 0.5, y: 0.6 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          pointerEvents="none"
        />

        {glowOpacity > 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius,
                backgroundColor: hexToRgba(
                  resolvedGlowColor,
                  glowOpacity * 0.18,
                ),
              },
            ]}
            pointerEvents="none"
          />
        )}

        {enableRipple && (
          <Animated.View
            style={[
              glassStyles.ripple,
              {
                borderRadius: borderRadius,
                opacity: rippleOpacity,
                transform: [
                  {
                    scale: rippleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1.4],
                    }),
                  },
                ],
                backgroundColor: hexToRgba(resolvedGlowColor, 0.25),
              },
            ]}
            pointerEvents="none"
          />
        )}

        {children}
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity
          activeOpacity={activeOpacity}
          onPress={() => {
            if (enableRipple) triggerRipple();
            onPress();
          }}
          accessible={accessible}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole={accessibilityRole}
        >
          {content}
        </TouchableOpacity>
      );
    }
    return content;
  },
);

const glassStyles = StyleSheet.create({
  surface: {
    overflow: "hidden",
    backgroundColor: "rgba(18,18,24,0.45)",
  },
  topSpecular: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
    backgroundColor: GLASS.specularTop,
  },
  leftSpecular: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 2.5,
    backgroundColor: GLASS.specularLeft,
    transform: [{ skewY: "-2deg" }],
  },
  leftGlowCore: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  leftGlowDiffuse: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 14,
  },
  ripple: {
    ...StyleSheet.absoluteFillObject,
  },
});

// ── GlassPane wrapper (preserves existing API surface) ───────────────────────
const GlassPane = ({
  blurIntensity,
  accentGlow,
  accentOpacity = 0,
  accentColor,
  style,
  borderRadius,
  children,
  ...rest
}: React.ComponentProps<typeof LiquidGlass> & {
  blurIntensity?: number;
  accentGlow?: boolean;
  accentColor?: string;
}) => (
  <LiquidGlassSurface
    style={style}
    borderRadius={borderRadius as number}
    blurIntensity={blurIntensity}
    glowColor={accentColor || COLORS.primary}
    glowOpacity={accentGlow ? Math.max(0.12, accentOpacity) : accentOpacity}
    showLeftGlow={accentGlow}
  >
    {children}
  </LiquidGlassSurface>
);

const Materialise = ({
  delay = 0,
  children,
}: {
  delay?: number;
  children: React.ReactNode;
}) => <>{children}</>;

// ─── MAIN ROUTER SCREEN SWITCHER ──────────────────────────────────────────────
export default function PlaylistScreen() {
  const { id } = useLocalSearchParams();
  const playlistId =
    typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  return <LocalPlaylistView playlistId={playlistId} />;
}

// ─── STABLE SUB-COMPONENTS ──────────────────────────────────────────────────

const ListHeader = React.memo(
  ({
    playlist,
    resolvedTracks,
    isCurrentPlaylistPlaying,
    scrollY,
    downloadStatus,
    downloadSpin,
    isShuffle,
    gradientColors,
    handleDownload,
    handlePlayAll,
    shufflePress,
    playPress,
    downloadPress,
    sharePress,
    glowPulse,
    glowScale,
    showActionSheet,
    onAddSongsPress,
    isLikedPlaylist,
  }: any) => {
    const [isExplanationExpanded, setIsExplanationExpanded] = React.useState(playlist?._isExpanded || false);
    const artGlowAnim = useSharedValue(isCurrentPlaylistPlaying ? 1 : 0.4);

    useEffect(() => {
      artGlowAnim.value = withSpring(isCurrentPlaylistPlaying ? 1 : 0.4, { damping: 24, stiffness: 160 });
    }, [isCurrentPlaylistPlaying]);

    const artParallaxStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: interpolate(scrollY.value, [0, 300], [0, -60], Extrapolation.CLAMP) }],
    }));

    const artAmbientGlowStyle = useAnimatedStyle(() => {
      const glowVal = artGlowAnim.value;
      return {
        opacity: interpolate(glowVal, [0.4, 1], [0.18, 0.42], Extrapolation.CLAMP),
        shadowOpacity: interpolate(glowVal, [0.4, 1], [0.3, 0.8], Extrapolation.CLAMP),
        shadowRadius: interpolate(glowVal, [0.4, 1], [28, 50], Extrapolation.CLAMP),
      };
    });

    const leftGlowStyle = useAnimatedStyle(() => ({
      opacity: interpolate(artGlowAnim.value, [0.4, 1], [0.14, 0.35], Extrapolation.CLAMP),
    }));

    const downloadSpinStyle = useAnimatedStyle(() => {
      const rotate = interpolate(downloadSpin.value, [0, 1], [0, 360], Extrapolation.CLAMP);
      return { transform: [{ rotate: `${rotate}deg` }] };
    });

    const playGlowStyle = useAnimatedStyle(() => ({
      opacity: interpolate(glowPulse.value, [0.4, 1], [0.18, 0.38], Extrapolation.CLAMP),
      transform: [{ scale: glowScale.value }],
    }));

    const playGlowRingStyle = useAnimatedStyle(() => ({
      transform: [{ scale: glowScale.value }],
    }));

    const heroFadeStyle = useAnimatedStyle(() => ({
      opacity: interpolate(scrollY.value, [0, 200], [1, 0], Extrapolation.CLAMP),
    }));

    return (
      <View style={styles.heroSection}>
        <AnimatedReanimated.View
          style={[
            styles.artWrapper,
            artParallaxStyle,
          ]}
        >
          <AnimatedReanimated.View
            style={[
              styles.artAmbientGlow,
              {
                backgroundColor: gradientColors[0],
                shadowColor: gradientColors[0],
              },
              artAmbientGlowStyle,
            ]}
            pointerEvents="none"
          />
          <View style={styles.artAmbientGlowInner} />

          <View style={styles.artGlassFrame}>
            <BlurView
              intensity={30}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 24,
                right: 24,
                height: 1.5,
                backgroundColor: GLASS.specularTop,
                zIndex: 10,
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                backgroundColor: GLASS.specularLeft,
                zIndex: 10,
              }}
            />
            <AnimatedReanimated.View
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 18,
                  backgroundColor: gradientColors[0],
                  zIndex: 9,
                },
                leftGlowStyle,
              ]}
              pointerEvents="none"
            />

            <PlaylistArtwork
              playlist={playlist}
              size={width * 0.76}
              style={styles.heroArt}
              cachePolicy="memory-disk"
            />

            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: GLASS.borderMed,
                backgroundColor: "rgba(255,255,255,0.025)",
              }}
            />
          </View>

          <GlassPane
            style={styles.enhancedBadge}
            borderRadius={20}
            blurIntensity={50}
            accentGlow
            accentColor={gradientColors[0]}
          >
            <View style={styles.badgeContent}>
              <View
                style={[
                  styles.badgeDot,
                  { backgroundColor: gradientColors[0] },
                ]}
              />
              <Ionicons
                name="sparkles"
                size={11}
                color={gradientColors[0]}
                style={{ marginRight: 5 }}
              />
              <Text style={styles.badgeText}>{playlist?.mood || "MY VIBE"}</Text>
            </View>
          </GlassPane>
        </AnimatedReanimated.View>

        <AnimatedReanimated.View
          style={[styles.heroTextContainer, heroFadeStyle]}
        >
          <Text style={styles.heroTitle}>{playlist?.name}</Text>
          {playlist?.isSeed && playlist?.seedArtists && playlist.seedArtists.length > 0 ? (
            <Text style={styles.seedArtistsText}>
              Generated from: {playlist.seedArtists.join(', ')}
            </Text>
          ) : null}
          {playlist?.description ? (
            <Text style={styles.heroDescription}>{playlist.description}</Text>
          ) : null}
          <Text style={styles.heroStats}>
            {resolvedTracks.length} song{resolvedTracks.length !== 1 ? "s" : ""}{" "}
            • {playlist?.isSeed ? `${(() => {
              const totalSec = resolvedTracks.reduce((acc: number, t: any) => acc + (t.duration || 0), 0);
              const hours = Math.floor(totalSec / 3600);
              const minutes = Math.floor((totalSec % 3600) / 60);
              return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            })()} • Updated ${playlist.generatedAt || 'today'}` : isLikedPlaylist ? "Your Favorites" : "Local Playlist"}
          </Text>

          {playlist?.isSeed && playlist?.reason ? (
            <View style={styles.explanationContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const expanded = !playlist._isExpanded;
                  playlist._isExpanded = expanded;
                  setIsExplanationExpanded(expanded);
                }}
                style={styles.explanationHeader}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={gradientColors[0]}
                />
                <Text style={styles.explanationHeaderTitle}>Why you're seeing this</Text>
                <Ionicons
                  name={isExplanationExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>
              {isExplanationExpanded && (
                <View style={styles.explanationBody}>
                  <Text style={styles.explanationBodyText}>{playlist.reason}</Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.heroActions}>
            <AnimatedReanimated.View style={downloadPress.style}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={downloadPress.onIn}
                onPressOut={downloadPress.onOut}
                onPress={handleDownload}
                accessibilityRole="button"
              >
                <LiquidGlassSurface
                  style={styles.actionBtn}
                  borderRadius={28}
                  blurIntensity={60}
                  glowColor={downloadStatus === "updated" ? COLORS.accent : COLORS.primary}
                  glowOpacity={downloadStatus === "updated" ? 0.2 : 0}
                  showLeftGlow={downloadStatus === "updated"}
                  enableRipple
                >
                  {downloadStatus === "downloading" ? (
                    <AnimatedReanimated.View style={downloadSpinStyle}>
                      <Ionicons name="sync" size={22} color={gradientColors[0]} />
                    </AnimatedReanimated.View>
                  ) : (
                    <Ionicons
                      name={downloadStatus === "updated" ? "cloud-done" : "download-outline"}
                      size={22}
                      color={downloadStatus === "updated" ? COLORS.accent : "#FFF"}
                    />
                  )}
                </LiquidGlassSurface>
              </TouchableOpacity>
            </AnimatedReanimated.View>

            <AnimatedReanimated.View style={sharePress.style}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={sharePress.onIn}
                onPressOut={sharePress.onOut}
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  showActionSheet("Share Playlist", [{ label: "Copy Link", icon: "link-outline", onPress: () => {} }], "Sharing coming soon!");
                }}
              >
                <LiquidGlassSurface style={styles.actionBtn} borderRadius={28} blurIntensity={60} enableRipple>
                  <Ionicons name="share-outline" size={22} color="#FFF" />
                </LiquidGlassSurface>
              </TouchableOpacity>
            </AnimatedReanimated.View>
          </View>
        </AnimatedReanimated.View>

        {resolvedTracks.length > 0 && (
          <View style={[styles.controlSection, { paddingHorizontal: 0, marginTop: 24, marginBottom: 0 }]}>
            <AnimatedReanimated.View style={[styles.shuffleBtnOuter, shufflePress.style]}>
              <TouchableOpacity
                onPress={() => handlePlayAll(true)}
                onPressIn={shufflePress.onIn}
                onPressOut={shufflePress.onOut}
                activeOpacity={1}
                style={{ flex: 1 }}
              >
                <LiquidGlassSurface
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}
                  borderRadius={31}
                  glowColor={isShuffle ? gradientColors[0] : COLORS.primary}
                  glowOpacity={isShuffle ? 0.25 : 0}
                  showLeftGlow={isShuffle}
                  enableRipple
                >
                  {isShuffle && (
                    <LinearGradient
                      colors={[hexToRgba(gradientColors[0], 0.55), hexToRgba(gradientColors[0], 0.3), "transparent"]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Ionicons name="shuffle" size={28} color={isShuffle ? "#FFF" : "rgba(255,255,255,0.35)"} />
                  <Text style={[styles.shuffleLabel, !isShuffle && { color: "rgba(255,255,255,0.35)" }]}>Shuffle All</Text>
                </LiquidGlassSurface>
              </TouchableOpacity>
            </AnimatedReanimated.View>

            <View style={styles.playBtnWrapper}>
              <AnimatedReanimated.View style={[styles.playBtnGlow, { backgroundColor: gradientColors[0] }, playGlowStyle]} />
              <AnimatedReanimated.View style={[styles.playBtnGlowRing, { borderColor: hexToRgba(gradientColors[0], 0.22) }, playGlowRingStyle]} />
              <AnimatedReanimated.View style={playPress.style}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={playPress.onIn}
                  onPressOut={playPress.onOut}
                  onPress={() => handlePlayAll(false)}
                  style={styles.playBtnShell}
                >
                  <LinearGradient colors={[gradientColors[0], COLORS.primaryMid, COLORS.primaryDeep]} style={StyleSheet.absoluteFill} />
                  <Ionicons name={isCurrentPlaylistPlaying ? "pause" : "play"} size={34} color="#FFF" style={{ marginLeft: isCurrentPlaylistPlaying ? 0 : 4 }} />
                </TouchableOpacity>
              </AnimatedReanimated.View>
            </View>
          </View>
        )}

        {!isLikedPlaylist && (
          <View style={{ marginTop: 24, width: "100%", marginBottom: 10 }}>
            <TouchableOpacity style={styles.addSongsBtn} activeOpacity={0.85} onPress={onAddSongsPress}>
              <LiquidGlassSurface style={{ paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }} borderRadius={20} showLeftGlow enableRipple>
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>Add Songs</Text>
              </LiquidGlassSurface>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

const TrackRowItem = React.memo(
  ({
    item,
    drag,
    isActive,
    handlePlayTrack,
    index,
    handleTrackOptions,
    playlistId,
  }: any) => {
    const isTrackActive = usePlayerStore((s) => 
       s.currentTrack?.id === item.id && 
       s.activeContext?.type === 'playlist' && 
       s.activeContext?.id === playlistId
    );

    const rowHighlight = useSharedValue(isTrackActive ? 1 : 0);
    useEffect(() => {
      rowHighlight.value = withSpring(isTrackActive ? 1 : 0, { damping: 20, stiffness: 150 });
    }, [isTrackActive]);

    const activeBgStyle = useAnimatedStyle(() => ({ opacity: rowHighlight.value }));
    const activeAccentBarStyle = useAnimatedStyle(() => ({
      opacity: rowHighlight.value,
      transform: [{ scaleY: interpolate(rowHighlight.value, [0, 1], [0.3, 1], Extrapolation.CLAMP) }],
    }));

    const isLiked = useLikesStore((s) => !!s.likedTrackIds[item.id]);
    const toggleLike = useLikesStore((s) => s.toggleLike);

    return (
      <ScaleDecorator>
        <TouchableOpacity
          style={[styles.trackRow, isTrackActive && styles.activeTrackRow, isActive && { backgroundColor: "rgba(255,255,255,0.06)" }]}
          onPress={() => handlePlayTrack(item, index)}
          onLongPress={drag}
          delayLongPress={220}
          activeOpacity={0.7}
        >
          <AnimatedReanimated.View style={[StyleSheet.absoluteFill, { borderRadius: 16 }, activeBgStyle]} pointerEvents="none">
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={[hexToRgba(COLORS.primary, 0.22), hexToRgba(COLORS.primary, 0.08), "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </AnimatedReanimated.View>

          <AnimatedReanimated.View style={[styles.activeAccentBar, activeAccentBarStyle]} pointerEvents="none" />

          <View style={styles.trackIndexContainer}>
            {isTrackActive ? <Ionicons name="stats-chart" size={18} color={COLORS.primary} /> : <Ionicons name="menu" size={20} color="rgba(255,255,255,0.25)" />}
          </View>

          <View style={styles.trackArtWrapper}>
            <AuraArtwork 
              source={resolveArtwork(item, 'card')} 
              entityName={item.title}
              entityType="song"
              style={styles.trackArt} 
              cachePolicy="memory-disk" 
            />
            {isTrackActive && (
              <View style={styles.trackArtPlayOverlay}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <Ionicons name="volume-medium" size={14} color={COLORS.primary} />
              </View>
            )}
          </View>

          <View style={styles.trackInfo}>
            <Text style={[styles.trackName, isTrackActive && { color: COLORS.primary }]} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
          </View>

          <TouchableOpacity style={styles.trackLikeBtn} activeOpacity={0.7} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleLike(item); }}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? COLORS.primary : "rgba(255,255,255,0.25)"} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.trackOptionsBtn} activeOpacity={0.7} onPress={() => handleTrackOptions(item)}>
            <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  },
);

const AddSongsModal = React.memo(({ isVisible, onClose, playlistId }: any) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [onlineResults, setOnlineResults] = useState<PlayerTrack[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInput>(null);

  const searchGlowAnim = useSharedValue(0);
  const searchScaleAnim = useSharedValue(1);
  const modalSlideAnim = useSharedValue(60);
  const modalOpacityAnim = useSharedValue(0);

  const playlist = usePlaylistStore((s) => s.playlists[playlistId]);
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const removeTrack = usePlaylistStore((s) => s.removeTrack);

  useEffect(() => {
    if (isVisible) {
      modalSlideAnim.value = withSpring(0, { damping: 22, stiffness: 160 });
      modalOpacityAnim.value = withTiming(1, { duration: 280 });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isVisible]);

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
    Haptics.selectionAsync();
    searchGlowAnim.value = withSpring(1);
    searchScaleAnim.value = withSpring(1.015);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setSearchFocused(false);
    searchGlowAnim.value = withSpring(0);
    searchScaleAnim.value = withSpring(1);
  }, []);

  const modalStyle = useAnimatedStyle(() => ({ transform: [{ translateY: modalSlideAnim.value }], opacity: modalOpacityAnim.value }));
  const searchContainerStyle = useAnimatedStyle(() => ({ transform: [{ scale: searchScaleAnim.value }], shadowOpacity: interpolate(searchGlowAnim.value, [0, 1], [0, 0.5]) }));

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setOnlineResults([]);
      setIsSearching(false);
      return;
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { musicService } = await import("@/src/services/api/music");
        const results = await musicService.searchSongs(query);
        if (!ac.signal.aborted) {
          setOnlineResults(results.slice(0, 8).map(r => ({ ...r, duration: 0, isLocal: false } as any)));
        }
      } finally {
        if (!ac.signal.aborted) setIsSearching(false);
      }
    }, 400);
    return () => { ac.abort(); clearTimeout(timer); };
  }, [query]);

  return (
    <Modal visible={isVisible} animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <AnimatedReanimated.View style={[{ flex: 1, marginTop: insets.top + 12 }, modalStyle]}>
          <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingBottom: 14 }}>
            <Text style={{ flex: 1, fontSize: 26, fontWeight: "800", color: "#FFF" }}>Add Songs</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <AnimatedReanimated.View style={searchContainerStyle}>
              <LiquidGlassSurface style={{ height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }} borderRadius={26} showLeftGlow glowOpacity={searchFocused ? 0.1 : 0}>
                <Ionicons name="search" size={20} color={searchFocused ? COLORS.primary : "rgba(255,255,255,0.5)"} />
                <TextInput ref={inputRef} placeholder="Search online..." placeholderTextColor="rgba(255,255,255,0.3)" style={{ flex: 1, color: "#FFF", fontSize: 16 }} value={query} onChangeText={setQuery} onFocus={handleSearchFocus} onBlur={handleSearchBlur} />
              </LiquidGlassSurface>
            </AnimatedReanimated.View>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
            {onlineResults.map((t, idx) => (
              <SearchResultRow key={`online-${t.id}-${idx}`} track={t} added={!!playlist?.trackIds.includes(t.id)} onToggle={(tr: any) => playlist?.trackIds.includes(tr.id) ? removeTrack(playlistId, tr.id) : addTrack(playlistId, tr)} index={idx} />
            ))}
          </ScrollView>
        </AnimatedReanimated.View>
      </View>
    </Modal>
  );
});

const SearchResultRow = ({ track, added, onToggle, index }: any) => {
  const enterAnim = useSharedValue(0);
  useEffect(() => { enterAnim.value = withDelay(index * 50, withSpring(1)); }, [index]);
  const enterStyle = useAnimatedStyle(() => ({ opacity: enterAnim.value, transform: [{ translateY: interpolate(enterAnim.value, [0, 1], [10, 0]) }] }));
  return (
    <AnimatedReanimated.View style={[{ flexDirection: "row", alignItems: "center", marginBottom: 12 }, enterStyle]}>
      <Image source={{ uri: getArtworkUrl(track, 'card') }} style={{ width: 50, height: 50, borderRadius: 10 }} cachePolicy="memory-disk" />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}>{track.title}</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{track.artist}</Text>
      </View>
      <TouchableOpacity onPress={() => onToggle(track)}>
        <Ionicons name={added ? "checkmark-circle" : "add-circle-outline"} size={28} color={added ? COLORS.primary : "#FFF"} />
      </TouchableOpacity>
    </AnimatedReanimated.View>
  );
};

const LocalPlaylistView = React.memo(({ playlistId }: { playlistId: string }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bottomPadding } = usePlaybackInsets();
  const { setQueue, toggleShuffle, isShuffle, isPlaying, pause, play, isLoading, isBuffering } = useMusicControls();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const activeContext = usePlayerStore((s) => s.activeContext);
  const activeContextId = activeContext?.id;
  const activeContextType = activeContext?.type;

  const isLikedPlaylist = playlistId === "liked-songs";
  const storePlaylist = usePlaylistStore((s) => s.playlists[playlistId]);

  const isSeedPlaylist = useMemo(() => !isLikedPlaylist && !storePlaylist, [isLikedPlaylist, storePlaylist]);

  const { dailyMixes, madeForYou, becauseYouLike, rediscover, recentlyLoved, trendingSeeds, generatedAtTime } = useRecommendationsStore(
    useShallow((s: any) => ({
      dailyMixes: s.dailyMixes || [],
      madeForYou: s.madeForYou || [],
      becauseYouLike: s.becauseYouLike || [],
      rediscover: s.rediscover || [],
      recentlyLoved: s.recentlyLoved || [],
      trendingSeeds: s.trendingSeeds || [],
      generatedAtTime: s.generatedAt,
    }))
  );

  const seed = useMemo(() => {
    if (!isSeedPlaylist) return null;
    return [...dailyMixes, ...madeForYou, ...becauseYouLike, ...rediscover, ...recentlyLoved, ...trendingSeeds].find(s => s.id === playlistId) || null;
  }, [isSeedPlaylist, playlistId, dailyMixes, madeForYou, becauseYouLike, rediscover, recentlyLoved, trendingSeeds]);

  const [seedTracks, setSeedTracks] = useState<PlayerTrack[]>([]);
  const [isSeedLoading, setIsSeedLoading] = useState(false);

  useEffect(() => {
    if (!seed) return;
    let active = true;
    
    // 1. If the seed already has concrete tracks, display immediately
    if (seed.tracks && seed.tracks.length > 0) {
      setSeedTracks(seed.tracks);
      setIsSeedLoading(false);
      return;
    }

    // 2. Otherwise dynamically hydrate with matching songs
    setIsSeedLoading(true);
    (async () => {
      try {
        const { hydrateRecommendationSeed } = await import('@/src/features/recommendations/services/recommendation-hydrator');
        const hydrated = await hydrateRecommendationSeed(seed);
        if (active && hydrated && hydrated.length > 0) {
          setSeedTracks(hydrated);
          // Persist hydrated tracks in recommendation store so next open is instant
          try {
            const { useRecommendationsStore } = await import('@/src/features/recommendations/store/recommendations.store');
            const state = useRecommendationsStore.getState();
            const updateSeedInList = (list: any[]) => (list || []).map(item => item.id === seed.id ? { ...item, tracks: hydrated, trackIds: hydrated.map(t => t.id) } : item);
            useRecommendationsStore.setState({
              dailyMixes: updateSeedInList(state.dailyMixes),
              madeForYou: updateSeedInList(state.madeForYou),
              becauseYouLike: updateSeedInList(state.becauseYouLike),
              trendingSeeds: updateSeedInList(state.trendingSeeds),
            });
          } catch (e) {}
        }
      } catch (err) {
        console.error('[PlaylistView] Error hydrating seed:', err);
      } finally {
        if (active) setIsSeedLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [seed?.id, seed?.trackIds, seed?.tracks]);

  const playlist = useMemo(() => {
    if (isLikedPlaylist) return { id: "liked-songs", name: "Liked Songs", description: "Your favorite tracks.", trackIds: [], gradientColors: [COLORS.primary, "#7B2FBE"] as [string, string], mood: "LIKES" };
    if (isSeedPlaylist && seed) {
      const firstArt = seedTracks[0]?.art || (seedTracks[0] as any)?.artwork || (seed.tracks && (seed.tracks[0]?.art || (seed.tracks[0] as any)?.artwork));
      const coverArt = seed.image || firstArt;
      return { 
        id: playlistId, 
        name: seed.title || "Mix", 
        description: seed.type === 'playlist' ? (seed as any).reason : `Vibe playlist from ${seed.title}.`, 
        trackIds: seed.trackIds || seedTracks.map(t => t.id), 
        gradientColors: ['#9B38DA', '#46f5e0'] as [string, string], 
        mood: seed.type?.toUpperCase() || "MIX", 
        coverArt, 
        isSeed: true, 
        reason: (seed as any).reason,
        seedArtists: seed.seedArtists || [],
      };
    }
    return storePlaylist;
  }, [isLikedPlaylist, isSeedPlaylist, storePlaylist, seed, seedTracks, playlistId]);

  const downloadedTracks = useDownloadStore((s) => s.downloadedTracks);
  const activeTasks = useDownloadStore((s) => s.activeTasks);
  const likedTracks = useLikesStore((s) => s.likedTrackIds);
  const { removeTrack, reorderTracks, renamePlaylist, deletePlaylist } = usePlaylistStore(useShallow(s => ({
    removeTrack: s.removeTrack,
    reorderTracks: s.reorderTracks,
    renamePlaylist: s.renamePlaylist,
    deletePlaylist: s.deletePlaylist
  })));

  const [isRenameVisible, setIsRenameVisible] = useState(false);
  const [isAddSongsVisible, setIsAddSongsVisible] = useState(false);
  const [tempName, setTempName] = useState("");
  const [resolvedTracks, setResolvedTracks] = useState<PlayerTrack[]>([]);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    if (!playlist) { setResolvedTracks([]); setIsResolving(false); return; }
    const task = InteractionManager.runAfterInteractions(() => {
      if (isLikedPlaylist) { setResolvedTracks(getLikedTracks()); setIsResolving(false); return; }
      if (isSeedPlaylist) { setResolvedTracks(seedTracks); setIsResolving(false); return; }
      const resolved = playlist.trackIds.map((id: string) => downloadedTracks[id] || (playlist as any).trackSnapshots?.[id] || null).filter((t: any) => !!t) as any[];
      setResolvedTracks(resolved); setIsResolving(false);
    });
    return () => task.cancel();
  }, [playlist?.id, playlist?.trackIds, seedTracks.length, downloadedTracks]);

  useEffect(() => {
    const isPlaylistActive = activeContextType === "playlist" && activeContextId === playlistId;
    if (isPlaylistActive && resolvedTracks.length > 0) {
      const store = usePlayerStore.getState();
      const storeQueue = store.queue;
      if (storeQueue.length === resolvedTracks.length) {
        let changed = false;
        const newQueue = [...storeQueue];
        resolvedTracks.forEach((rt, i) => { if (rt.url !== storeQueue[i].url) { newQueue[i] = rt; changed = true; if (!store.isTransitioning) PlaybackService.updateMediaItem(i, rt); } });
        if (changed) usePlayerStore.setState({ queue: newQueue });
      }
    }
  }, [activeContextId, activeContextType, playlistId, resolvedTracks]);

  const downloadStatus = useMemo(() => {
    if (!playlist?.trackIds?.length) return "none";
    const dlCount = playlist.trackIds.filter((id: string) => downloadedTracks[id]).length;
    if (dlCount === playlist.trackIds.length) return "updated";
    return playlist.trackIds.some((id: string) => activeTasks[id]) ? "downloading" : "none";
  }, [playlist?.trackIds, downloadedTracks, activeTasks]);

  const downloadSpin = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const glowPulse = useSharedValue(0.5);
  const glowScale = useSharedValue(1.0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const headerOpacityStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [60, 160], [0, 1], Extrapolation.CLAMP) }));

  const shufflePress = usePressScale();
  const playPress = usePressScale();
  const downloadPress = usePressScale();
  const sharePress = usePressScale();

  useEffect(() => {
    glowPulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    glowScale.value = withRepeat(withTiming(1.3, { duration: 900 }), -1, true);
  }, []);

  const handlePlayAll = useCallback(async (shuffle = false) => {
    if (isResolving || resolvedTracks.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const store = usePlayerStore.getState();
    store.setActiveContext({ type: "playlist", id: playlistId, name: playlist?.name || "Playlist" });
    if (activeContextId === playlistId) { if (shuffle) await toggleShuffle(); else isPlaying ? await pause() : await play(); return; }
    if (shuffle && !store.isShuffle) await toggleShuffle();
    await setQueue(resolvedTracks, 0, { sourceId: playlistId, sourceType: "playlist", generatedAt: Date.now() });
  }, [isResolving, resolvedTracks, isPlaying, toggleShuffle, pause, play, setQueue, playlistId, playlist?.name, activeContextId]);

  const handlePlayTrack = useCallback(async (track: PlayerTrack, index: number) => {
    if (isResolving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const store = usePlayerStore.getState();
    if (store.currentTrack?.id === track.id) { isPlaying ? await pause() : await play(); return; }
    if (activeContextId === playlistId && store.queue.length === resolvedTracks.length) await store.jumpToQueueIndex(index);
    else { await setQueue(resolvedTracks, index, { sourceId: playlistId, sourceType: "playlist", generatedAt: Date.now() }); store.setActiveContext({ type: "playlist", id: playlistId, name: playlist?.name || "Playlist" } as any); }
  }, [isResolving, isPlaying, pause, play, setQueue, resolvedTracks, playlistId, playlist?.name, activeContextId]);

  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetConfig, setActionSheetConfig] = useState<any>(null);
  const showActionSheet = useCallback((title: string, actions: any[], subtitle?: string) => { setActionSheetConfig({ title, actions, subtitle }); setActionSheetVisible(true); }, []);

  const handleOptionsPress = useCallback(() => {
    if (isLikedPlaylist) return;
    showActionSheet(playlist?.name || "Options", [
      { label: "Rename", icon: "pencil", onPress: () => { setTempName(playlist?.name || ""); setIsRenameVisible(true); } },
      { label: "Delete", icon: "trash", destructive: true, onPress: () => { deletePlaylist(playlistId); router.back(); } }
    ]);
  }, [playlist, playlistId, deletePlaylist, isLikedPlaylist, showActionSheet, router]);

  const handleTrackOptions = useCallback((track: PlayerTrack) => {
    showActionSheet(track.title, [{ label: "Remove", icon: "trash", destructive: true, onPress: () => removeTrack(playlistId, track.id) }], `by ${track.artist}`);
  }, [playlistId, removeTrack, showActionSheet]);

  const saveRename = useCallback(() => { if (tempName.trim()) { renamePlaylist(playlistId, tempName.trim()); setIsRenameVisible(false); } }, [tempName, renamePlaylist, playlistId]);

  const gradientColors = useMemo(() => playlist?.gradientColors || [COLORS.primary, COLORS.primaryDeep] as [string, string], [playlist?.gradientColors]);

  const renderFlashItem = useCallback(({ item, index }: any) => <TrackRowItem item={item} handlePlayTrack={handlePlayTrack} index={index} handleTrackOptions={handleTrackOptions} playlistId={playlistId} />, [handlePlayTrack, handleTrackOptions, playlistId]);
  const renderDraggableItem = useCallback(({ item, drag, isActive }: any) => { const idx = resolvedTracks.findIndex(t => t.id === item.id); return <TrackRowItem item={item} drag={drag} isActive={isActive} handlePlayTrack={handlePlayTrack} index={idx} handleTrackOptions={handleTrackOptions} playlistId={playlistId} />; }, [resolvedTracks, handlePlayTrack, handleTrackOptions, playlistId]);

  if (!playlist && !isResolving) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="albums-outline" size={48} color="#ffffff80" />
        <Text style={{ color: '#fff', fontSize: 20, marginTop: 16, fontWeight: '600', fontFamily: 'Manrope-Bold' }}>Playlist unavailable</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#ffffff20', borderRadius: 24 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'Inter-Medium' }}>Return Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#08080d" }]} />
        <View style={[styles.glowBlob, { top: "-5%", left: "-25%", backgroundColor: gradientColors[0] }]} />
        <View style={[styles.glowBlob, { bottom: "15%", right: "-30%", backgroundColor: gradientColors[1] }]} />
        <LinearGradient colors={["rgba(8,8,13,0)", "rgba(8,8,13,0.70)", "#08080d"]} style={StyleSheet.absoluteFill} />
      </View>

      <AnimatedReanimated.View style={[styles.stickyHeader, { paddingTop: insets.top }, headerOpacityStyle]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.stickyHeaderInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}><Ionicons name="chevron-back" size={24} color="#FFF" /></TouchableOpacity>
          <Text style={styles.stickyTitle} numberOfLines={1}>{playlist?.name}</Text>
          <TouchableOpacity onPress={() => handlePlayAll(false)} style={styles.headerBtn}><Ionicons name={isPlaying && activeContextId === playlistId ? "pause" : "play"} size={22} color="#FFF" /></TouchableOpacity>
        </View>
      </AnimatedReanimated.View>

      {isLikedPlaylist ? (
        <AnimatedFlashList data={resolvedTracks} keyExtractor={(t: any, i: number) => `${t.id}-${i}`} renderItem={renderFlashItem} estimatedItemSize={72} extraData={currentTrack?.id} onScroll={scrollHandler} {...ScrollPhysics.STANDARD} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: bottomPadding, paddingHorizontal: 20 }}
          ListHeaderComponent={<ListHeader playlist={playlist} resolvedTracks={resolvedTracks} isCurrentPlaylistPlaying={isPlaying && activeContextId === playlistId} scrollY={scrollY} downloadStatus={downloadStatus} downloadSpin={downloadSpin} isShuffle={isShuffle && activeContextId === playlistId} gradientColors={gradientColors} handleDownload={() => {}} handlePlayAll={handlePlayAll} shufflePress={shufflePress} playPress={playPress} downloadPress={downloadPress} sharePress={sharePress} glowPulse={glowPulse} glowScale={glowScale} showActionSheet={showActionSheet} onAddSongsPress={() => setIsAddSongsVisible(true)} isLikedPlaylist={isLikedPlaylist} />}
          ListEmptyComponent={
            isSeedLoading ? (
              <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={gradientColors[0]} />
                <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 14, fontSize: 14, fontWeight: '600' }}>
                  Curating tracks for your mix...
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <AnimatedDraggableFlatList data={resolvedTracks} onDragEnd={({ from, to }) => { reorderTracks(playlistId, from, to); if (activeContextId === playlistId) usePlayerStore.getState().reorderQueue(from, to); }} keyExtractor={(t, i) => `${t.id}-${i}`} renderItem={renderDraggableItem} extraData={currentTrack?.id} onScroll={scrollHandler} {...ScrollPhysics.STANDARD} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: bottomPadding, paddingHorizontal: 20 }}
          ListHeaderComponent={<ListHeader playlist={playlist} resolvedTracks={resolvedTracks} isCurrentPlaylistPlaying={isPlaying && activeContextId === playlistId} scrollY={scrollY} downloadStatus={downloadStatus} downloadSpin={downloadSpin} isShuffle={isShuffle && activeContextId === playlistId} gradientColors={gradientColors} handleDownload={() => {}} handlePlayAll={handlePlayAll} shufflePress={shufflePress} playPress={playPress} downloadPress={downloadPress} sharePress={sharePress} glowPulse={glowPulse} glowScale={glowScale} showActionSheet={showActionSheet} onAddSongsPress={() => setIsAddSongsVisible(true)} isLikedPlaylist={isLikedPlaylist} />}
          ListEmptyComponent={
            isSeedLoading ? (
              <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={gradientColors[0]} />
                <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 14, fontSize: 14, fontWeight: '600' }}>
                  Curating tracks for your mix...
                </Text>
              </View>
            ) : null
          }
        />
      )}

      <View style={[styles.floatingHeader, { top: insets.top + 16 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCircle}><BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} /><Ionicons name="chevron-back" size={22} color="#FFF" /></TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleOptionsPress} style={styles.moreCircle}><BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} /><Ionicons name="ellipsis-vertical" size={20} color="#FFF" /></TouchableOpacity>
      </View>

      <Modal visible={actionSheetVisible} transparent animationType="fade" onRequestClose={() => setActionSheetVisible(false)} statusBarTranslucent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionSheetVisible(false)}><BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} /></TouchableOpacity>
        <View style={styles.modalCardWrap} pointerEvents="box-none">
          <LiquidGlassSurface style={styles.actionSheetCard} borderRadius={30} blurIntensity={70} showLeftGlow showTopSpecular showLeftSpecular>
            {actionSheetConfig && (
              <>
                <Text style={styles.modalTitle}>{actionSheetConfig.title}</Text>
                {actionSheetConfig.actions.map((act: any) => (
                  <TouchableOpacity key={act.label} style={styles.modalActionRow} onPress={() => { act.onPress(); setActionSheetVisible(false); }}>
                    <Ionicons name={act.icon} size={20} color={act.destructive ? "#ff453a" : "#FFF"} />
                    <Text style={[styles.modalActionLabel, act.destructive && { color: "#ff453a" }]}>{act.label}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            <TouchableOpacity onPress={() => setActionSheetVisible(false)} style={styles.modalDoneBtn}><LinearGradient colors={[COLORS.primary, COLORS.primaryDeep]} style={StyleSheet.absoluteFill} /><Text style={styles.modalDoneText}>DONE</Text></TouchableOpacity>
          </LiquidGlassSurface>
        </View>
      </Modal>

      <Modal visible={isRenameVisible} transparent animationType="fade" onRequestClose={() => setIsRenameVisible(false)} statusBarTranslucent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsRenameVisible(false)}><BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} /></TouchableOpacity>
        <View style={styles.modalCardWrap} pointerEvents="box-none">
          <LiquidGlassSurface style={styles.renameCard} borderRadius={24} blurIntensity={65} showLeftGlow showTopSpecular showLeftSpecular>
            <Text style={styles.modalTitle}>Rename Playlist</Text>
            <View style={styles.inputWrap}><TextInput style={styles.renameInput} value={tempName} onChangeText={setTempName} autoFocus onSubmitEditing={saveRename} selectionColor={COLORS.primary} /></View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setIsRenameVisible(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSaveBtn]} onPress={saveRename}><LinearGradient colors={[gradientColors[0], COLORS.primaryMid]} style={StyleSheet.absoluteFill} /><Text style={styles.modalSaveText}>Save</Text></TouchableOpacity>
            </View>
          </LiquidGlassSurface>
        </View>
      </Modal>

      <AddSongsModal isVisible={isAddSongsVisible} onClose={() => setIsAddSongsVisible(false)} playlistId={playlistId} />
    </View>
  );
});

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08080d" },
  glowBlob: { position: "absolute", width: width * 0.85, height: width * 0.85, borderRadius: width * 0.425, opacity: 0.14 },
  stickyHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, overflow: "hidden" },
  stickyHeaderInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 56 },
  headerBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  stickyTitle: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  navHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 28 },
  backBtnCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  moreCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  heroSection: { flexDirection: "column", alignItems: "center", paddingHorizontal: 20, marginBottom: 32 },
  artWrapper: { width: width * 0.76, aspectRatio: 1, borderRadius: 24, marginBottom: 28, position: "relative" },
  artAmbientGlow: { position: "absolute", inset: -20, borderRadius: 44, shadowOffset: { width: 0, height: 8 }, shadowRadius: 36 },
  artAmbientGlowInner: { position: "absolute", inset: -12, borderRadius: 36 },
  artGlassFrame: { flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "rgba(18,18,22,0.72)" },
  heroArt: { flex: 1, borderRadius: 24 },
  enhancedBadge: { position: "absolute", bottom: 14, left: 14, paddingHorizontal: 14, paddingVertical: 7 },
  badgeContent: { flexDirection: "row", alignItems: "center" },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginRight: 5 },
  badgeText: { color: "#FFF", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  heroTextContainer: { width: "100%" },
  heroTitle: { color: "#FFF", fontSize: 44, fontWeight: "900", letterSpacing: -1.5, lineHeight: 46, marginBottom: 8 },
  heroDescription: { color: "rgba(170,170,185,0.55)", fontSize: 14, marginBottom: 6, lineHeight: 20 },
  heroStats: { color: "rgba(170,170,185,0.65)", fontSize: 13, fontWeight: "500", marginBottom: 22 },
  seedArtistsText: { color: "rgba(255, 255, 255, 0.65)", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  explanationContainer: { marginTop: 6, marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: GLASS.borderSubtle, backgroundColor: "rgba(255,255,255,0.035)", overflow: "hidden" },
  explanationHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  explanationHeaderTitle: { flex: 1, color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" },
  explanationBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: GLASS.borderSubtle, paddingTop: 10 },
  explanationBodyText: { color: "rgba(170,170,185,0.7)", fontSize: 13, lineHeight: 18 },
  heroActions: { flexDirection: "row", gap: 12 },
  actionBtn: { width: 56, height: 56, justifyContent: "center", alignItems: "center" },
  controlSection: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, marginBottom: 28 },
  shuffleBtnOuter: { flex: 1, height: 62, borderRadius: 31, overflow: "hidden" },
  shuffleLabel: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  playBtnWrapper: { width: 62, height: 62, alignItems: "center", justifyContent: "center" },
  playBtnGlow: { position: "absolute", width: 62, height: 62, borderRadius: 31 },
  playBtnShell: { width: 62, height: 62, borderRadius: 31, justifyContent: "center", alignItems: "center", overflow: "hidden", zIndex: 2 },
  playBtnGlowRing: { position: "absolute", width: 92, height: 92, borderRadius: 46, borderWidth: 1 },
  floatingHeader: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", zIndex: 120 },
  trackListSection: { gap: 2, marginBottom: 36, paddingHorizontal: 12 },
  trackRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: "transparent", overflow: "hidden", position: "relative" },
  activeTrackRow: { borderRadius: 16, borderColor: "rgba(191,90,242,0.18)" },
  activeAccentBar: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: COLORS.primary },
  trackIndexContainer: { width: 28, justifyContent: "center", alignItems: "center" },
  trackIndex: { color: "rgba(170,170,185,0.65)", fontSize: 12, fontWeight: "700" },
  trackArtWrapper: { width: 48, height: 48, borderRadius: 10, marginRight: 14, position: "relative", overflow: "hidden" },
  trackArt: { width: 48, height: 48, borderRadius: 10 },
  trackArtPlayOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 10, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  trackInfo: { flex: 1 },
  trackName: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  trackArtist: { color: "rgba(170,170,185,0.65)", fontSize: 13, marginTop: 2 },
  trackMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  trackDuration: { color: "rgba(170,170,185,0.65)", fontSize: 12, fontWeight: "600", width: 38, textAlign: "right" },
  trackOptionsBtn: { paddingHorizontal: 8, paddingVertical: 12, marginLeft: 2 },
  trackLikeBtn: { paddingHorizontal: 8, paddingVertical: 12, marginLeft: 2 },
  addSongsBtn: { borderRadius: 20, overflow: "hidden" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 64, paddingHorizontal: 28 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#FFF", marginTop: 4, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "rgba(170,170,185,0.65)", textAlign: "center", lineHeight: 20, marginBottom: 28 },
  modalOverlay: { flex: 1 },
  modalCardWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  renameCard: { width: width * 0.88, padding: 28 },
  actionSheetCard: { width: width * 0.9, maxHeight: height * 0.8, paddingTop: 12, paddingBottom: 24, paddingHorizontal: 24 },
  modalHandleWrap: { alignItems: "center", marginBottom: 20 },
  modalHandle: { width: 36, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.22)" },
  modalHeaderInfo: { alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#FFF", textAlign: "center", marginBottom: 6 },
  modalSubtitle: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.45)", textAlign: "center" },
  modalDivider: { height: 1, backgroundColor: GLASS.borderSubtle, marginBottom: 8 },
  modalActionsList: { maxHeight: height * 0.4 },
  modalActionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14 },
  modalActionLabel: { fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.9)", flex: 1 },
  inputWrap: { height: 54, borderRadius: 16, overflow: "hidden", marginBottom: 24, paddingHorizontal: 16, justifyContent: "center" },
  renameInput: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 12 },
  modalBtn: { flex: 1, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" },
  modalSaveBtn: { elevation: 8 },
  modalCancelText: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "700" },
  modalSaveText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  modalDoneBtn: { height: 54, borderRadius: 27, justifyContent: "center", alignItems: "center", overflow: "hidden", marginTop: 16 },
  modalDoneText: { fontSize: 14, fontWeight: "900", color: "#FFF", letterSpacing: 1.5 },
});
