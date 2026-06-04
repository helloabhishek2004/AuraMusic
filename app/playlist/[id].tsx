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
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaybackInsets } from "@/src/hooks/use-playback-insets";

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
import { useNetInfo } from "@react-native-community/netinfo";

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

const MOTION = {
  SLIDE: { tension: 60, friction: 9 },
  POP: { tension: 200, friction: 8 },
  SHEET: { tension: 45, friction: 11 },
  // Spring configs — softened for iOS 26 cinematic feel
  SPRING_EXPAND: { tension: 160, friction: 24, useNativeDriver: true },
  SPRING_COLLAPSE: { tension: 180, friction: 28, useNativeDriver: true },
  SPRING_BOUNCE: { tension: 140, friction: 16, useNativeDriver: true },
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
// Provides: frosted translucency, left-edge glow, specular highlights,
// layered border diffusion, refraction shimmer — all on a single composable pane.
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
    leftGlowAnimValue?: Animated.Value;
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
        style={[glassStyles.surface, { borderRadius }, style]}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
      >
        {/* Base blur layer */}
        <BlurView
          intensity={blurIntensity}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />

        {/* Refraction tint */}
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

        {/* Frosted glass fill */}
        <LinearGradient
          colors={[GLASS.frostMid, GLASS.frost, "rgba(255,255,255,0.03)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          pointerEvents="none"
        />

        {/* Top specular highlight */}
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

        {/* Left specular reflection */}
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

        {/* Left-edge glow (iOS 26 signature) */}
        {showLeftGlow && (
          <>
            <Animated.View
              style={[
                glassStyles.leftGlowCore,
                {
                  borderTopLeftRadius: borderRadius,
                  borderBottomLeftRadius: borderRadius,
                  backgroundColor: resolvedGlowColor,
                  opacity: leftGlowAnimValue
                    ? leftGlowAnimValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.45, 0.85],
                      })
                    : 0.6,
                },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                glassStyles.leftGlowDiffuse,
                {
                  borderTopLeftRadius: borderRadius,
                  borderBottomLeftRadius: borderRadius,
                  backgroundColor: resolvedGlowColor,
                  opacity: leftGlowAnimValue
                    ? leftGlowAnimValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.18, 0.38],
                      })
                    : 0.22,
                },
              ]}
              pointerEvents="none"
            />
          </>
        )}

        {/* Outer border (subtle glass edge) */}
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

        {/* Bottom inner shadow for depth */}
        <LinearGradient
          colors={["transparent", GLASS.innerShadow]}
          start={{ x: 0.5, y: 0.6 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          pointerEvents="none"
        />

        {/* Accent glow overlay */}
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

        {/* Ripple effect on press */}
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

const LEGACY_PLAYLIST_DATA: Record<
  string,
  {
    title: string;
    description: string;
    stats: string;
    art: string;
    tracks: Array<{
      id: string;
      title: string;
      artist: string;
      art: string;
      duration: string;
    }>;
  }
> = {
  "late-night-drive": {
    title: "Late Night Drive",
    description: "Moody synthwave and deep club tracks for the open road.",
    stats: "8 songs • Legacy mix",
    art: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=800",
    tracks: [
      {
        id: "nightcall",
        title: "Nightcall",
        artist: "Kavinsky",
        art: "https://picsum.photos/seed/kavinsky/400",
        duration: "4:18",
      },
      {
        id: "neon",
        title: "Neon Nights",
        artist: "Synthwave Collective",
        art: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=480",
        duration: "7:05",
      },
      {
        id: "solar",
        title: "Solar Flare",
        artist: "Cosmic Echo",
        art: "https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=480",
        duration: "5:44",
      },
    ],
  },
  "chill-vibes": {
    title: "Chill Vibes",
    description: "Smooth ambient grooves for a laid-back listening session.",
    stats: "6 songs • Relaxed mix",
    art: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&q=80&w=800",
    tracks: [
      {
        id: "nebula",
        title: "Nebula Drift",
        artist: "Lumina Synthetics",
        art: "https://picsum.photos/seed/nebula/400",
        duration: "6:12",
      },
      {
        id: "neon",
        title: "Neon Nights",
        artist: "Synthwave Collective",
        art: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=480",
        duration: "7:05",
      },
      {
        id: "solar",
        title: "Solar Flare",
        artist: "Cosmic Echo",
        art: "https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=480",
        duration: "5:44",
      },
    ],
  },
  "workout-energy": {
    title: "Workout Energy",
    description: "High-drive beats and bright synths to keep your pulse up.",
    stats: "7 songs • Pumped mix",
    art: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&q=80&w=800",
    tracks: [
      {
        id: "nightcall",
        title: "Nightcall",
        artist: "Kavinsky",
        art: "https://picsum.photos/seed/kavinsky/400",
        duration: "4:18",
      },
      {
        id: "solar",
        title: "Solar Flare",
        artist: "Cosmic Echo",
        art: "https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=480",
        duration: "5:44",
      },
      {
        id: "nebula",
        title: "Nebula Drift",
        artist: "Lumina Synthetics",
        art: "https://picsum.photos/seed/nebula/400",
        duration: "6:12",
      },
    ],
  },
};

// ─── MAIN ROUTER SCREEN SWITCHER ──────────────────────────────────────────────
export default function PlaylistScreen() {
  const { id } = useLocalSearchParams();
  const playlistId =
    typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const isLegacy =
    playlistId === "late-night-drive" ||
    playlistId === "chill-vibes" ||
    playlistId === "workout-energy";

  if (!isLegacy || playlistId.startsWith("pl_")) {
    return <LocalPlaylistView playlistId={playlistId} />;
  }
  return <LegacyPlaylistView playlistId={playlistId} />;
}

// ─── STABLE SUB-COMPONENTS ──────────────────────────────────────────────────

const ListHeader = React.memo(
  ({
    playlist,
    resolvedTracks,
    isCurrentPlaylistPlaying,
    artParallax,
    heroFade,
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
    const [isExplanationExpanded, setIsExplanationExpanded] = React.useState(playlist._isExpanded || false);
    // Animated value for left glow intensity on the art frame
    const artGlowAnim = useRef(
      new Animated.Value(isCurrentPlaylistPlaying ? 1 : 0.4),
    ).current;

    useEffect(() => {
      Animated.spring(artGlowAnim, {
        toValue: isCurrentPlaylistPlaying ? 1 : 0.4,
        ...MOTION.SPRING_EXPAND,
      }).start();
    }, [isCurrentPlaylistPlaying]);

    return (
      <View style={styles.heroSection}>
        <Animated.View
          style={[
            styles.artWrapper,
            { transform: [{ translateY: artParallax }] },
          ]}
        >
          {/* Ambient glow blobs */}
          <Animated.View
            style={[
              styles.artAmbientGlow,
              {
                backgroundColor: gradientColors[0],
                opacity: artGlowAnim.interpolate({
                  inputRange: [0.4, 1],
                  outputRange: [0.18, 0.42],
                }),
                shadowColor: gradientColors[0],
                shadowOpacity: isCurrentPlaylistPlaying ? 0.8 : 0.3,
                shadowRadius: isCurrentPlaylistPlaying ? 50 : 28,
              },
            ]}
            pointerEvents="none"
          />
          <View style={styles.artAmbientGlowInner} />

          {/* iOS 26 glass art frame with left glow */}
          <View style={styles.artGlassFrame}>
            <BlurView
              intensity={30}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            {/* Top specular edge */}
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
            {/* Left specular + glow (iOS 26 signature) */}
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
            <Animated.View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 18,
                backgroundColor: gradientColors[0],
                opacity: artGlowAnim.interpolate({
                  inputRange: [0.4, 1],
                  outputRange: [0.14, 0.35],
                }),
                zIndex: 9,
              }}
              pointerEvents="none"
            />

            <PlaylistArtwork
              playlist={playlist}
              size={width * 0.76}
              style={styles.heroArt}
            />

            {/* Glass overlay on art */}
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

          {/* Vibe badge */}
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
              <Text style={styles.badgeText}>{playlist.mood || "MY VIBE"}</Text>
            </View>
          </GlassPane>
        </Animated.View>

        {/* Hero text */}
        <Animated.View
          style={[styles.heroTextContainer, { opacity: heroFade }]}
        >
          <Text style={styles.heroTitle}>{playlist.name}</Text>
          {playlist.isSeed && playlist.seedArtists && playlist.seedArtists.length > 0 ? (
            <Text style={styles.seedArtistsText}>
              Generated from: {playlist.seedArtists.join(', ')}
            </Text>
          ) : null}
          {playlist.description ? (
            <Text style={styles.heroDescription}>{playlist.description}</Text>
          ) : null}
          <Text style={styles.heroStats}>
            {resolvedTracks.length} song{resolvedTracks.length !== 1 ? "s" : ""}{" "}
            • {playlist.isSeed ? `${(() => {
              const totalSec = resolvedTracks.reduce((acc: number, t: any) => acc + (t.duration || 0), 0);
              const hours = Math.floor(totalSec / 3600);
              const minutes = Math.floor((totalSec % 3600) / 60);
              return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            })()} • Updated ${playlist.generatedAt || 'today'}` : isLikedPlaylist ? "Your Favorites" : "Local Playlist"}
          </Text>

          {playlist.isSeed && playlist.reason ? (
            <View style={styles.explanationContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const expanded = !playlist._isExpanded;
                  playlist._isExpanded = expanded; // toggle
                  // Triggers re-render since it mutates state via state change
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

          {/* Action buttons row */}
          <View style={styles.heroActions}>
            {/* Download */}
            <Animated.View
              style={{ transform: [{ scale: downloadPress.scale }] }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={downloadPress.onIn}
                onPressOut={downloadPress.onOut}
                onPress={handleDownload}
                accessibilityLabel={
                  downloadStatus === "updated"
                    ? "Downloaded"
                    : "Download playlist"
                }
                accessibilityRole="button"
              >
                <LiquidGlassSurface
                  style={styles.actionBtn}
                  borderRadius={28}
                  blurIntensity={60}
                  glowColor={
                    downloadStatus === "updated"
                      ? COLORS.accent
                      : COLORS.primary
                  }
                  glowOpacity={downloadStatus === "updated" ? 0.2 : 0}
                  showLeftGlow={downloadStatus === "updated"}
                  showTopSpecular
                  showLeftSpecular
                  enableRipple
                >
                  {downloadStatus === "checking" ? (
                    <Animated.View
                      style={{
                        transform: [
                          {
                            rotate: downloadSpin.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0deg", "360deg"],
                            }),
                          },
                        ],
                      }}
                    >
                      <Ionicons
                        name="sync"
                        size={22}
                        color={gradientColors[0]}
                      />
                    </Animated.View>
                  ) : (
                    <Ionicons
                      name={
                        downloadStatus === "updated"
                          ? "cloud-done"
                          : "download-outline"
                      }
                      size={22}
                      color={
                        downloadStatus === "updated" ? COLORS.accent : "#FFF"
                      }
                    />
                  )}
                </LiquidGlassSurface>
              </TouchableOpacity>
            </Animated.View>

            {/* Share */}
            <Animated.View style={{ transform: [{ scale: sharePress.scale }] }}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={sharePress.onIn}
                onPressOut={sharePress.onOut}
                accessibilityLabel="Share playlist"
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  showActionSheet(
                    "Share Playlist",
                    [
                      {
                        label: "Copy Link",
                        icon: "link-outline",
                        onPress: () => {},
                      },
                      {
                        label: "Send to Friends",
                        icon: "people-outline",
                        onPress: () => {},
                      },
                    ],
                    "Sharing feature coming soon!",
                  );
                }}
              >
                <LiquidGlassSurface
                  style={styles.actionBtn}
                  borderRadius={28}
                  blurIntensity={60}
                  showTopSpecular
                  showLeftSpecular
                  enableRipple
                >
                  <Ionicons name="share-outline" size={22} color="#FFF" />
                </LiquidGlassSurface>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Shuffle + Play controls */}
        {resolvedTracks.length > 0 && (
          <View
            style={[
              styles.controlSection,
              { paddingHorizontal: 0, marginTop: 24, marginBottom: 0 },
            ]}
          >
            {/* Shuffle button — full liquid glass */}
            <Animated.View
              style={[
                styles.shuffleBtnOuter,
                { transform: [{ scale: shufflePress.scale }] },
              ]}
            >
              <TouchableOpacity
                onPress={() => handlePlayAll(true)}
                onPressIn={shufflePress.onIn}
                onPressOut={shufflePress.onOut}
                activeOpacity={1}
                style={{ flex: 1 }}
                accessibilityLabel="Shuffle all tracks"
                accessibilityRole="button"
              >
                <LiquidGlassSurface
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                  borderRadius={31}
                  blurIntensity={55}
                  glowColor={isShuffle ? gradientColors[0] : COLORS.primary}
                  glowOpacity={isShuffle ? 0.25 : 0}
                  showLeftGlow={isShuffle}
                  showTopSpecular
                  showLeftSpecular
                  enableRipple
                >
                  {/* Conditional gradient fill when active */}
                  {isShuffle && (
                    <LinearGradient
                      colors={[
                        hexToRgba(gradientColors[0], 0.55),
                        hexToRgba(gradientColors[0], 0.3),
                        "transparent",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  )}
                  <Ionicons
                    name="shuffle"
                    size={28}
                    color={isShuffle ? "#FFF" : "rgba(255,255,255,0.35)"}
                    style={{ zIndex: 2 }}
                  />
                  <Text
                    style={[
                      styles.shuffleLabel,
                      !isShuffle && { color: "rgba(255,255,255,0.35)" },
                    ]}
                  >
                    Shuffle All
                  </Text>
                </LiquidGlassSurface>
              </TouchableOpacity>
            </Animated.View>

            {/* Play/Pause button */}
            <View style={styles.playBtnWrapper}>
              {/* Glow rings */}
              <Animated.View
                style={[
                  styles.playBtnGlow,
                  {
                    backgroundColor: gradientColors[0],
                    opacity: glowPulse.interpolate({
                      inputRange: [0.4, 1],
                      outputRange: [0.18, 0.38],
                    }),
                    transform: [{ scale: glowScale }],
                  },
                ]}
                pointerEvents="none"
              />
              <Animated.View
                style={[
                  styles.playBtnGlowRing,
                  {
                    borderColor: hexToRgba(gradientColors[0], 0.22),
                    transform: [{ scale: glowScale }],
                  },
                ]}
                pointerEvents="none"
              />

              <Animated.View
                style={{ transform: [{ scale: playPress.scale }] }}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={playPress.onIn}
                  onPressOut={playPress.onOut}
                  onPress={() => handlePlayAll(false)}
                  style={styles.playBtnShell}
                  accessibilityLabel={
                    isCurrentPlaylistPlaying ? "Pause" : "Play all"
                  }
                  accessibilityRole="button"
                >
                  <BlurView
                    intensity={30}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={[
                      gradientColors[0],
                      COLORS.primaryMid,
                      COLORS.primaryDeep,
                    ]}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* Top specular on play btn */}
                  <View
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 14,
                      right: 14,
                      height: 2.5,
                      borderRadius: 2,
                      backgroundColor: "rgba(255,255,255,0.30)",
                      zIndex: 4,
                    }}
                    pointerEvents="none"
                  />
                  {/* Left specular skew */}
                  <View
                    style={{
                      position: "absolute",
                      left: 8,
                      top: 10,
                      width: 22,
                      bottom: 10,
                      borderRadius: 8,
                      backgroundColor: "rgba(255,255,255,0.16)",
                      transform: [{ skewX: "-8deg" }],
                      zIndex: 4,
                    }}
                    pointerEvents="none"
                  />
                  {/* Glass border overlay */}
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      borderRadius: 32,
                      borderWidth: 1,
                      borderColor: GLASS.borderBright,
                      backgroundColor: "rgba(255,255,255,0.04)",
                      zIndex: 3,
                    }}
                    pointerEvents="none"
                  />
                  <Ionicons
                    name={isCurrentPlaylistPlaying ? "pause" : "play"}
                    size={34}
                    color="#FFF"
                    style={{
                      marginLeft: isCurrentPlaylistPlaying ? 0 : 4,
                      zIndex: 5,
                    }}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )}

        {/* Add Songs button */}
        {!isLikedPlaylist && (
          <View style={{ marginTop: 24, width: "100%", marginBottom: 10 }}>
            <TouchableOpacity
              style={styles.addSongsBtn}
              activeOpacity={0.85}
              onPress={onAddSongsPress}
              accessibilityLabel="Add songs to playlist"
              accessibilityRole="button"
            >
              <LiquidGlassSurface
                style={{
                  paddingVertical: 14,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                }}
                borderRadius={20}
                blurIntensity={50}
                showTopSpecular
                showLeftSpecular
                showLeftGlow
                glowColor={COLORS.primary}
                enableRipple
              >
                <Ionicons name="add" size={20} color="#FFF" />
                <Text
                  style={{
                    color: "#FFF",
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  Add Songs
                </Text>
              </LiquidGlassSurface>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

// ── Track Row Item ─────────────────────────────────────────────────────────────
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
    // Surgical selector: only re-render when THIS track's active state changes
    const isTrackActive = usePlayerStore((s) => 
       s.currentTrack?.id === item.id && 
       s.activeContext?.type === 'playlist' && 
       s.activeContext?.id === playlistId
    );

    // Spring-animated highlight for active track
    const rowHighlight = useRef(
      new Animated.Value(isTrackActive ? 1 : 0),
    ).current;
    useEffect(() => {
      Animated.spring(rowHighlight, {
        toValue: isTrackActive ? 1 : 0,
        ...MOTION.SPRING_EXPAND,
      }).start();
    }, [isTrackActive]);

    const isLiked = useLikesStore((s) => !!s.likedTrackIds[item.id]);
    const toggleLike = useLikesStore((s) => s.toggleLike);

    return (
      <ScaleDecorator>
        <TouchableOpacity
          style={[
            styles.trackRow,
            isTrackActive && styles.activeTrackRow,
            isActive && { backgroundColor: "rgba(255,255,255,0.06)" },
          ]}
          onPress={() => handlePlayTrack(item, index)}
          onLongPress={drag}
          delayLongPress={220}
          activeOpacity={0.8}
          disabled={isActive}
          accessibilityLabel={`${item.title} by ${item.artist}`}
          accessibilityRole="button"
          accessibilityState={{ selected: isTrackActive }}
        >
          {/* Active track glass background */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: rowHighlight.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                borderRadius: 16,
              },
            ]}
            pointerEvents="none"
          >
            <BlurView
              intensity={25}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            {/* Left glow accent bar with gradient diffusion */}
            <LinearGradient
              colors={[
                hexToRgba(COLORS.primary, 0.22),
                hexToRgba(COLORS.primary, 0.08),
                "transparent",
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </Animated.View>

          {/* Left accent bar */}
          <Animated.View
            style={[
              styles.activeAccentBar,
              {
                opacity: rowHighlight,
                transform: [
                  {
                    scaleY: rowHighlight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          />

          {/* Track index / drag handle */}
          <View style={styles.trackIndexContainer}>
            {isTrackActive ? (
              <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
            ) : (
              <Ionicons name="menu" size={20} color="rgba(255,255,255,0.25)" />
            )}
          </View>

          {/* Artwork */}
          <View style={styles.trackArtWrapper}>
            <Image source={{ uri: item.art }} style={styles.trackArt} />
            {isTrackActive && (
              <View style={styles.trackArtPlayOverlay}>
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: hexToRgba(COLORS.primary, 0.35),
                    backgroundColor: hexToRgba(COLORS.primary, 0.15),
                  }}
                />
                <Ionicons
                  name="volume-medium"
                  size={14}
                  color={COLORS.primary}
                />
              </View>
            )}
          </View>

          {/* Track info */}
          <View style={styles.trackInfo}>
            <Text
              style={[
                styles.trackName,
                isTrackActive && { color: COLORS.primary },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>

          {/* Like Button */}
          <TouchableOpacity
            style={styles.trackLikeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleLike(item);
            }}
            accessibilityLabel={
              isLiked ? "Remove from favorites" : "Add to favorites"
            }
            accessibilityRole="button"
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={18}
              color={isLiked ? COLORS.primary : "rgba(255,255,255,0.25)"}
            />
          </TouchableOpacity>

          {/* Options */}
          <TouchableOpacity
            style={styles.trackOptionsBtn}
            onPress={() => handleTrackOptions(item)}
            disabled={isActive}
            accessibilityLabel={`More options for ${item.title}`}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={18}
              color="rgba(255,255,255,0.4)"
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// ─── ADD SONGS MODAL (iOS 26 glass search experience) ─────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
const AddSongsModal = React.memo(({ isVisible, onClose, playlistId }: any) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [onlineResults, setOnlineResults] = useState<PlayerTrack[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Animated values for search focus effect
  const searchGlowAnim = useRef(new Animated.Value(0)).current;
  const searchScaleAnim = useRef(new Animated.Value(1)).current;
  const modalSlideAnim = useRef(new Animated.Value(60)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;

  const playlist = usePlaylistStore((s) => s.playlists[playlistId]);
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const removeTrack = usePlaylistStore((s) => s.removeTrack);

  // Modal entrance animation
  useEffect(() => {
    if (isVisible) {
      modalSlideAnim.setValue(60);
      modalOpacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(modalSlideAnim, {
          toValue: 0,
          tension: 160,
          friction: 22,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacityAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Instant focus for premium UX
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Search focus animations
  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
    Haptics.selectionAsync();
    Animated.parallel([
      Animated.spring(searchGlowAnim, {
        toValue: 1,
        tension: 200,
        friction: 20,
        useNativeDriver: false,
      }),
      Animated.spring(searchScaleAnim, {
        toValue: 1.015,
        tension: 280,
        friction: 18,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSearchBlur = useCallback(() => {
    setSearchFocused(false);
    Animated.parallel([
      Animated.spring(searchGlowAnim, {
        toValue: 0,
        tension: 180,
        friction: 24,
        useNativeDriver: false,
      }),
      Animated.spring(searchScaleAnim, {
        toValue: 1,
        tension: 220,
        friction: 22,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setOnlineResults([]);
      setIsSearching(false);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { musicService } = await import("@/src/services/api/music");
        const results = await musicService.searchSongs(query);
        if (!ac.signal.aborted) {
          const newTracks: PlayerTrack[] = results.slice(0, 8).map((r) => ({
            id: r.id,
            title: r.title,
            artist: r.artist || "Unknown",
            art: r.art || "",
            url: "",
            albumId: r.albumId,
            album: r.album,
            source: r.source || "ytmusic",
            duration:
              typeof r.duration === "string"
                ? r.duration
                    .split(":")
                    .reduce(
                      (acc: number, time: string) => 60 * acc + +time,
                      0,
                    ) * 1000
                : 0,
            isLocal: false,
          }));
          setOnlineResults(newTracks);
        }
      } catch (e: any) {
        if (e.name !== "AbortError" && e.name !== "CanceledError") {
          console.warn("[Online Search] Failed:", e);
        }
      } finally {
        if (!ac.signal.aborted) setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleToggle = useCallback(
    (track: PlayerTrack) => {
      const isAdded = playlist?.trackIds.includes(track.id);
      if (isAdded) {
        removeTrack(playlistId, track.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        addTrack(playlistId, track);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [playlist?.trackIds, addTrack, removeTrack, playlistId],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    Haptics.selectionAsync();
    inputRef.current?.focus();
  }, []);

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop blur */}
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.55)" },
          ]}
        />

        {/* Modal content with slide-up spring */}
        <Animated.View
          style={{
            flex: 1,
            marginTop: insets.top + 12,
            transform: [{ translateY: modalSlideAnim }],
            opacity: modalOpacityAnim,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingBottom: 14,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 26,
                fontWeight: "800",
                color: "#FFF",
                letterSpacing: -0.8,
              }}
            >
              Add Songs
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close Add Songs"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <LiquidGlassSurface
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                borderRadius={18}
                blurIntensity={55}
                showTopSpecular
                showLeftSpecular
                enableRipple
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </LiquidGlassSurface>
            </TouchableOpacity>
          </View>

          {/* Search bar — iOS 26 liquid glass with dynamic focus glow */}
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Animated.View
              style={{
                transform: [{ scale: searchScaleAnim }],
                // Shadow/elevation glow when focused
                ...Platform.select({
                  ios: {
                    shadowColor: COLORS.primary,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: searchGlowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.5],
                    }),
                    shadowRadius: 14,
                  },
                  android: {
                    elevation: 0,
                  },
                }),
              }}
            >
              {/* Animated border glow ring */}
              <Animated.View
                style={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: 29,
                  borderWidth: 1.5,
                  borderColor: searchGlowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      "rgba(191,90,242,0)",
                      "rgba(191,90,242,0.65)",
                    ],
                  }),
                  zIndex: 0,
                }}
                pointerEvents="none"
              />

              <LiquidGlassSurface
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  height: 52,
                  paddingHorizontal: 16,
                  gap: 10,
                }}
                borderRadius={26}
                blurIntensity={60}
                glowColor={COLORS.primary}
                glowOpacity={searchFocused ? 0.1 : 0}
                showLeftGlow={searchFocused}
                leftGlowAnimValue={searchGlowAnim}
                showTopSpecular
                showLeftSpecular
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: searchGlowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.12],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons
                    name="search"
                    size={20}
                    color={
                      searchFocused ? COLORS.primary : "rgba(255,255,255,0.5)"
                    }
                  />
                </Animated.View>

                <TextInput
                  ref={inputRef}
                  placeholder="Search online..."
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  style={{
                    flex: 1,
                    color: "#FFF",
                    fontSize: 16,
                    fontWeight: "500",
                    letterSpacing: -0.2,
                    // Android: remove default underline
                    ...(Platform.OS === "android" && {
                      paddingVertical: 0,
                      includeFontPadding: false,
                    }),
                  }}
                  value={query}
                  onChangeText={(text) => {
                    setQuery(text);
                  }}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  returnKeyType="search"
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel="Search for songs"
                  accessibilityRole="search"
                  underlineColorAndroid="transparent"
                  selectionColor={COLORS.primary}
                  cursorColor={COLORS.primary}
                />

                {/* Clear button */}
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={handleClear}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Clear search"
                    accessibilityRole="button"
                  >
                    <Animated.View
                      style={{
                        transform: [
                          {
                            scale: searchGlowAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.9, 1],
                            }),
                          },
                        ],
                      }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={
                          searchFocused
                            ? "rgba(191,90,242,0.8)"
                            : "rgba(255,255,255,0.45)"
                        }
                      />
                    </Animated.View>
                  </TouchableOpacity>
                )}
              </LiquidGlassSurface>
            </Animated.View>
          </View>

          {/* Results list */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 28,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isSearching ? (
              <View style={{ padding: 48, alignItems: "center" }}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    marginTop: 14,
                    fontSize: 14,
                    fontWeight: "500",
                  }}
                >
                  Searching online...
                </Text>
              </View>
            ) : onlineResults.length > 0 ? (
              onlineResults.map((t, idx) => {
                const added = playlist?.trackIds.includes(t.id);
                return (
                  <SearchResultRow
                    key={t.id}
                    track={t}
                    added={!!added}
                    onToggle={handleToggle}
                    index={idx}
                  />
                );
              })
            ) : query.length > 1 ? (
              <View style={{ padding: 48, alignItems: "center" }}>
                <Ionicons
                  name="search-outline"
                  size={44}
                  color="rgba(255,255,255,0.18)"
                />
                <Text
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    marginTop: 14,
                    fontSize: 15,
                    fontWeight: "500",
                  }}
                >
                  No matches found
                </Text>
              </View>
            ) : (
              <View style={{ padding: 48, alignItems: "center" }}>
                <LiquidGlassSurface
                  style={{
                    width: 80,
                    height: 80,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 18,
                  }}
                  borderRadius={40}
                  blurIntensity={50}
                  showTopSpecular
                  showLeftSpecular
                >
                  <Ionicons
                    name="search"
                    size={36}
                    color="rgba(255,255,255,0.28)"
                  />
                </LiquidGlassSurface>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    marginTop: 4,
                    textAlign: "center",
                    fontSize: 15,
                    fontWeight: "500",
                    lineHeight: 22,
                  }}
                >
                  {"Search for any track online\nto add it to your playlist"}
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

// ── Search result row with stagger animation ──────────────────────────────────
const SearchResultRow = React.memo(
  ({
    track,
    added,
    onToggle,
    index,
  }: {
    track: PlayerTrack;
    added: boolean;
    onToggle: (t: PlayerTrack) => void;
    index: number;
  }) => {
    const enterAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.spring(enterAnim, {
        toValue: 1,
        tension: 180,
        friction: 22,
        delay: index * 48,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 12,
          opacity: enterAnim,
          transform: [
            {
              translateY: enterAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        }}
      >
        <Image
          source={{ uri: track.art }}
          style={{
            width: 50,
            height: 50,
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}
            numberOfLines={1}
          >
            {track.title}
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              marginTop: 3,
            }}
            numberOfLines={1}
          >
            {track.artist}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onToggle(track)}
          accessibilityLabel={
            added ? `Remove ${track.title}` : `Add ${track.title}`
          }
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <LiquidGlassSurface
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
            borderRadius={18}
            blurIntensity={50}
            glowColor={added ? COLORS.primary : "rgba(255,255,255,0.15)"}
            glowOpacity={added ? 0.3 : 0}
            showLeftGlow={added}
            showTopSpecular
            enableRipple
          >
            {added && (
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDeep]}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Ionicons
              name={added ? "checkmark" : "add"}
              size={20}
              color={added ? "#FFF" : "rgba(255,255,255,0.7)"}
            />
          </LiquidGlassSurface>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// ─── 1. LOCAL DYNAMIC PLAYLIST VIEW ───────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
const LocalPlaylistView = React.memo(
  ({ playlistId }: { playlistId: string }) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { bottomPadding } = usePlaybackInsets();
    const {
      setQueue,
      toggleShuffle,
      isShuffle,
      isPlaying,
      pause,
      play,
      isLoading,
      isBuffering,
    } = useMusicControls();

    const currentTrack = usePlayerStore((s) => s.currentTrack);
    const activeContext = usePlayerStore((s) => s.activeContext);

    const isLikedPlaylist = playlistId === "liked-songs";
    const storePlaylist = usePlaylistStore((s) => s.playlists[playlistId]);

    const isSeedPlaylist = useMemo(() => {
      return !isLikedPlaylist && !storePlaylist;
    }, [isLikedPlaylist, storePlaylist]);

    const dailyMixes = useRecommendationsStore((s) => s.dailyMixes || []);
    const madeForYou = useRecommendationsStore((s) => s.madeForYou || []);
    const becauseYouLike = useRecommendationsStore((s) => s.becauseYouLike || []);
    const rediscover = useRecommendationsStore((s) => s.rediscover || []);
    const recentlyLoved = useRecommendationsStore((s) => s.recentlyLoved || []);
    const trendingSeeds = useRecommendationsStore((s) => s.trendingSeeds || []);
    const generatedAtTime = useRecommendationsStore((s) => s.generatedAt);

    const seed = useMemo(() => {
      if (!isSeedPlaylist) return null;
      const allSeeds = [...dailyMixes, ...madeForYou, ...becauseYouLike, ...rediscover, ...recentlyLoved, ...trendingSeeds];
      return allSeeds.find((s) => s.id === playlistId) || null;
    }, [isSeedPlaylist, playlistId, dailyMixes, madeForYou, becauseYouLike, rediscover, recentlyLoved, trendingSeeds]);

    const [seedTracks, setSeedTracks] = useState<PlayerTrack[]>([]);
    const [isSeedLoading, setIsSeedLoading] = useState(false);

    useEffect(() => {
      if (!seed) return;
      let active = true;
      const hydrate = async () => {
        setIsSeedLoading(true);
        try {
          const { hydrateRecommendationSeed } = require("@/src/features/recommendations/services/recommendation-hydrator");
          const tracks = await hydrateRecommendationSeed(seed);
          if (active && tracks) {
            // HARDENING: Verify tracks do not contain placeholder/demo audio (No SoundHelix/PicSum urls in playback uri)
            const verifiedTracks = tracks.filter((t: PlayerTrack) => {
              const urlLower = (t.url || '').toLowerCase();
              const isPlaceholderUrl = urlLower.includes("soundhelix") || urlLower.includes("placeholder");
              return t.id && t.title && t.artist && !isPlaceholderUrl;
            });
            setSeedTracks(verifiedTracks);
          }
        } catch (err) {
          console.error("[PlaylistDetails] Seed hydration failed:", err);
        } finally {
          if (active) setIsSeedLoading(false);
        }
      };
      hydrate();
      return () => {
        active = false;
      };
    }, [seed]);

    const playlist = useMemo(() => {
      if (isLikedPlaylist) {
        return {
          id: "liked-songs",
          name: "Liked Songs",
          description: "Your favorite tracks, all in one place.",
          trackIds: [],
          gradientColors: [COLORS.primary, "#7B2FBE"],
          mood: "LIKES",
        };
      }
      if (isSeedPlaylist) {
        let formattedTime = "today";
        if (generatedAtTime) {
          try {
            const date = new Date(generatedAtTime);
            formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            // ignore
          }
        }
        return {
          id: playlistId,
          name: seed?.title || "Personalized Mix",
          description: seed?.type === 'playlist' ? ((seed as any)?.reason || 'Custom themed mix based on your preferences.') : `Vibe playlist generated from top artist ${seed?.title || 'your taste'}.`,
          trackIds: seedTracks.map(t => t.id),
          gradientColors: ['#9B38DA', '#46f5e0'] as [string, string],
          mood: seed?.type?.toUpperCase() || "MIX",
          coverArt: seed?.image || undefined,
          isSeed: true,
          generatedAt: formattedTime,
          seedArtists: (seed as any)?.seedArtists || [],
          reason: (seed as any)?.reason || "",
        };
      }
      return storePlaylist;
    }, [isLikedPlaylist, isSeedPlaylist, storePlaylist, seed, seedTracks, playlistId, generatedAtTime]);

    const downloadedTracks = useDownloadStore((s) => s.downloadedTracks);
    const netInfo = useNetInfo();
    const isOffline = netInfo.isConnected === false;

    const likedTracks = useLikesStore((s) => s.likedTrackIds);

    const resolvedTracks = useMemo(() => {
      if (isLikedPlaylist) {
        return getLikedTracks();
      }
      if (isSeedPlaylist) {
        return seedTracks;
      }
      if (!playlist) return [];
      const resolved: PlayerTrack[] = [];
      for (const trackId of playlist.trackIds) {
        const downloaded = downloadedTracks[trackId];
        if (downloaded) {
          resolved.push(downloaded as PlayerTrack);
          continue;
        }
        if (isOffline) continue;
        const snap = (playlist as any).trackSnapshots?.[trackId];
        if (snap) {
          resolved.push({
            id: snap.id,
            title: snap.title,
            artist: snap.artist,
            art: snap.art,
            url: "",
            duration: snap.duration,
            isLocal: snap.isLocal,
            albumId: snap.albumId,
            artistId: snap.artistId,
            source: snap.source,
            album: snap.album,
          });
          continue;
        }
      }
      return resolved;
    }, [isLikedPlaylist, isSeedPlaylist, playlist, downloadedTracks, isOffline, likedTracks, seedTracks]);

    const removeTrack = usePlaylistStore((s) => s.removeTrack);
    const reorderTracks = usePlaylistStore((s) => s.reorderTracks);
    const renamePlaylist = usePlaylistStore((s) => s.renamePlaylist);
    const deletePlaylist = usePlaylistStore((s) => s.deletePlaylist);

    const [isRenameVisible, setIsRenameVisible] = useState(false);
    const [isAddSongsVisible, setIsAddSongsVisible] = useState(false);
    const [tempName, setTempName] = useState("");
    const downloadedTracksMap = useDownloadStore((s) => s.downloadedTracks);
    const activeTasks = useDownloadStore((s) => s.activeTasks);

    // Sync player queue when track resolution changes (e.g. newly downloaded)
    useEffect(() => {
      const isPlaylistActive =
        activeContext?.type === "playlist" && activeContext?.id === playlistId;
      if (isPlaylistActive && resolvedTracks.length > 0) {
        const store = usePlayerStore.getState();
        const storeQueue = store.queue;
        if (storeQueue.length === resolvedTracks.length) {
          resolvedTracks.forEach((rt, i) => {
            if (rt.url !== storeQueue[i].url) {
              const newQueue = [...usePlayerStore.getState().queue];
              newQueue[i] = rt;
              usePlayerStore.setState({ queue: newQueue });
              // Also sync with native player if not currently transitioning
              if (!store.isTransitioning) {
                PlaybackService.updateMediaItem(i, rt);
              }
            }
          });
        }
      }
    }, [activeContext?.id, activeContext?.type, playlistId, resolvedTracks]);

    const downloadStatus = useMemo(() => {
      if (!playlist?.trackIds?.length) return "none";
      let downloadedCount = 0;
      let activeCount = 0;
      for (const trackId of playlist.trackIds) {
        if (downloadedTracksMap[trackId]) downloadedCount++;
        else if (activeTasks[trackId]) activeCount++;
      }
      if (downloadedCount === playlist.trackIds.length) return "updated";
      if (activeCount > 0) return "checking";
      return "none";
    }, [playlist?.trackIds, downloadedTracksMap, activeTasks]);

    const downloadSpin = useRef(new Animated.Value(0)).current;
    const scrollY = useRef(new Animated.Value(0)).current;
    const glowPulse = useRef(new Animated.Value(0.5)).current;
    const glowScale = useRef(new Animated.Value(1.0)).current;

    const shufflePress = usePressScale();
    const playPress = usePressScale();
    const downloadPress = usePressScale();
    const sharePress = usePressScale();
    const backPress = usePressScale();

    const isPlaylistActive = useMemo(() => {
      return (
        activeContext?.type === "playlist" && activeContext?.id === playlistId
      );
    }, [activeContext, playlistId]);

    const isCurrentPlaylistPlaying = isPlaylistActive && isPlaying;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, {
            toValue: 1.0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowPulse, {
            toValue: 0.4,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.3,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1.0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, []);

    useEffect(() => {
      if (downloadStatus === "checking") {
        Animated.loop(
          Animated.timing(downloadSpin, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ).start();
      } else {
        downloadSpin.stopAnimation();
      }
    }, [downloadStatus, downloadSpin]);

    const handleDownload = useCallback(async () => {
      if (downloadStatus === "none" && resolvedTracks.length > 0) {
        try {
          const { DownloadManager } =
            await import("@/src/features/download/services/download.manager");
          const { useDownloadStore } =
            await import("@/src/features/download/store/download.store");
          for (const track of resolvedTracks) {
            useDownloadStore.getState().addDownload(track);
          }
          DownloadManager.initialize();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
          console.error("Download failed:", e);
        }
      }
    }, [downloadStatus, resolvedTracks]);

    const handlePlayAll = useCallback(
      async (shuffle = false) => {
        if (isLoading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (resolvedTracks.length === 0) return;

        const store = usePlayerStore.getState();
        const wasPlaylistActive =
          store.activeContext?.type === "playlist" &&
          store.activeContext?.id === playlistId;
        const currentIsShuffle = store.isShuffle;

        store.setActiveContext({
          type: "playlist",
          id: playlistId,
          name: playlist?.name || "Local Playlist",
        });

        if (wasPlaylistActive) {
          if (shuffle) {
            await toggleShuffle();
          } else {
            isPlaying ? await pause() : await play();
          }
          return;
        }

        if (shuffle) {
          if (!currentIsShuffle) await toggleShuffle();
          await setQueue(resolvedTracks, 0, {
            sourceId: playlistId,
            sourceType: "playlist",
            generatedAt: Date.now()
          });
        } else {
          if (currentIsShuffle) await toggleShuffle();
          await setQueue(resolvedTracks, 0, {
            sourceId: playlistId,
            sourceType: "playlist",
            generatedAt: Date.now()
          });
        }
      },
      [
        isLoading,
        isBuffering,
        resolvedTracks,
        isPlaying,
        toggleShuffle,
        pause,
        play,
        setQueue,
        playlistId,
        playlist?.name,
      ],
    );

    const handlePlayTrack = useCallback(
      async (track: PlayerTrack, index: number) => {
        if (isLoading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const context = {
          type: "playlist",
          id: playlistId,
          name: playlist?.name || "Local Playlist",
        };

        const store = usePlayerStore.getState();
        if (store.currentTrack?.id === track.id) {
          isPlaying ? await pause() : await play();
          return;
        }

        // If it's a different track but same playlist, we just jump index to be faster
        if (store.activeContext?.id === playlistId && store.queue.length === resolvedTracks.length) {
            await store.jumpToQueueIndex(index);
        } else {
            await setQueue(resolvedTracks, index, {
              sourceId: playlistId,
              sourceType: "playlist",
              generatedAt: Date.now()
            });
            store.setActiveContext(context as any);
        }
      },
      [
        isLoading,
        isPlaying,
        pause,
        play,
        setQueue,
        resolvedTracks,
        playlistId,
        playlist?.name,
      ],
    );

    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [actionSheetConfig, setActionSheetConfig] = useState<{
      title: string;
      subtitle?: string;
      actions: {
        label: string;
        icon: string;
        onPress: () => void;
        destructive?: boolean;
      }[];
    } | null>(null);

    const showActionSheet = useCallback(
      (title: string, actions: any[], subtitle?: string) => {
        setActionSheetConfig({ title, actions, subtitle });
        setActionSheetVisible(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      [],
    );

    const handleOptionsPress = useCallback(() => {
      if (isLikedPlaylist) return;
      showActionSheet(
        playlist?.name ?? "Playlist Options",
        [
          {
            label: "Rename Playlist",
            icon: "pencil-outline",
            onPress: () => {
              setTempName(playlist?.name ?? "");
              setIsRenameVisible(true);
            },
          },
          {
            label: "Delete Playlist",
            icon: "trash-outline",
            destructive: true,
            onPress: () => {
              showActionSheet(
                "Delete Playlist",
                [
                  {
                    label: "Confirm Delete",
                    icon: "trash",
                    destructive: true,
                    onPress: () => {
                      deletePlaylist(playlistId);
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      );
                      router.back();
                    },
                  },
                  {
                    label: "Cancel",
                    icon: "close",
                    onPress: () => setActionSheetVisible(false),
                  },
                ],
                `Are you sure you want to delete "${playlist?.name}"?`,
              );
            },
          },
        ],
        "Manage this playlist",
      );
    }, [
      playlist,
      showActionSheet,
      deletePlaylist,
      playlistId,
      router,
      isLikedPlaylist,
    ]);

    const handleTrackOptions = useCallback(
      (track: PlayerTrack) => {
        const store = usePlayerStore.getState();
        const activeTrackId = store.currentTrack?.albumId;
        
        const { useMediaCacheStore } = require("@/src/features/cache/store/media-cache.store");
        const cacheStore = useMediaCacheStore.getState();
        const cachedTrack = cacheStore.getCachedTrack(track.id);
        const targetAlbumId =
          track.albumId ||
          cachedTrack?.track?.albumId ||
          (track.album && track.artist ? cacheStore.getAlbumId(track.album, track.artist) : null) ||
          (store.currentTrack?.id === track.id ? activeTrackId : null);

        const options: any[] = [
          {
            label: "Remove from Playlist",
            icon: "remove-circle-outline",
            destructive: true,
            onPress: () => {
              removeTrack(playlistId, track.id);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              setActionSheetVisible(false);
            },
          },
          {
            label: "Go to Artist",
            icon: "person-outline",
            onPress: () => {
              setActionSheetVisible(false);
              openArtistByName(router, track.artist);
            },
          },
          {
            label: "Go to Album",
            icon: "disc-outline",
            onPress: async () => {
              setActionSheetVisible(false);
              if (targetAlbumId) {
                router.push(`/album/${targetAlbumId}`);
              } else {
                try {
                  const { musicService } = await import("@/src/services/api/music");
                  const { MetadataCache } = await import("@/src/features/cache/services/metadata-cache.service");
                  const { usePlayerStore } = await import("@/src/features/player/store/player.store");
                  
                  let search = null;
                  if (track.album && track.album !== 'Unknown' && track.album !== '') {
                    search = await musicService.lookupAlbumByName(
                      `${track.album} ${track.artist || ''}`.trim()
                    );
                  }

                  // Title + Artist fuzzy search fallback
                  if (!search || !search.id) {
                    const searchQuery = `${track.title || ''} ${track.artist || ''}`.trim();
                    const songSearch = await musicService.searchSongs(searchQuery);
                    const bestMatch = songSearch && songSearch[0];
                    if (bestMatch && bestMatch.albumId) {
                      search = { id: bestMatch.albumId, title: bestMatch.album || 'Album' };
                    }
                  }

                  if (search && search.id) {
                    MetadataCache.mergeEntry(track, { albumId: search.id, album: search.title });
                    usePlayerStore.getState().updateTrackMetadata(track.id, { albumId: search.id, album: search.title });
                    router.push(`/album/${search.id}`);
                  } else {
                    const fallbackAlbum = track.album || 'Unknown Album';
                    router.push(`/album/local-album-${encodeURIComponent(fallbackAlbum)}`);
                  }
                } catch (e) {
                  console.warn(e);
                  const fallbackAlbum = track.album || 'Unknown Album';
                  router.push(`/album/local-album-${encodeURIComponent(fallbackAlbum)}`);
                }
              }
            },
          }
        ];

        showActionSheet(track.title, options, `by ${track.artist}`);
      },
      [playlistId, removeTrack, router, showActionSheet],
    );

    const saveRename = useCallback(() => {
      const trimmed = tempName.trim();
      if (trimmed) {
        renamePlaylist(playlistId, trimmed);
        setIsRenameVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, [tempName, renamePlaylist, playlistId]);

    const rawColors = playlist?.gradientColors || [
      COLORS.primary,
      COLORS.primaryDeep,
    ];
    const gradientColors = useMemo(() => {
      const hasYellow = rawColors.some((c) => {
        const lower = c.toLowerCase();
        return (
          lower === "#ffd166" || lower === "#cc8c00" || lower === "#ffd700"
        );
      });
      if (hasYellow) return ["#d946ef", "#701a75"] as [string, string];
      return rawColors;
    }, [rawColors]);

    const headerOpacity = useRef(
      scrollY.interpolate({
        inputRange: [60, 160],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    ).current;
    const artParallax = useRef(
      scrollY.interpolate({
        inputRange: [0, 300],
        outputRange: [0, -60],
        extrapolate: "clamp",
      }),
    ).current;
    const heroFade = useRef(
      scrollY.interpolate({
        inputRange: [0, 200],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    ).current;

    const renderDraggableItem = useCallback(
      ({ item, drag, isActive }: RenderItemParams<PlayerTrack>) => {
        const index = resolvedTracks.findIndex((t) => t.id === item.id);
        return (
          <TrackRowItem
            item={item}
            drag={drag}
            isActive={isActive}
            handlePlayTrack={handlePlayTrack}
            index={index}
            handleTrackOptions={handleTrackOptions}
            playlistId={playlistId}
          />
        );
      },
      [resolvedTracks, handlePlayTrack, handleTrackOptions, playlistId],
    );

    const isPlaylistMissing = !playlist;

    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />

        {isPlaylistMissing ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: height * 0.4 }}
          />
        ) : (
          <>
        {/* Background blobs */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: "#08080d" }]}
          />
          <View
            style={[
              styles.glowBlob,
              { top: "-5%", left: "-25%", backgroundColor: gradientColors[0] },
            ]}
          />
          <View
            style={[
              styles.glowBlob,
              {
                bottom: "15%",
                right: "-30%",
                backgroundColor: gradientColors[1],
              },
            ]}
          />
          <LinearGradient
            colors={["rgba(8,8,13,0)", "rgba(8,8,13,0.70)", "#08080d"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Sticky header */}
        <Animated.View
          style={[
            styles.stickyHeader,
            { paddingTop: insets.top, opacity: headerOpacity },
          ]}
        >
          <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          {/* Bottom border on sticky header */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: GLASS.borderSubtle,
            }}
          />
          <View style={styles.stickyHeaderInner}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={1}
              style={styles.headerBtn}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.stickyTitle} numberOfLines={1}>
              {playlist.name}
            </Text>
            <TouchableOpacity
              style={[
                styles.headerBtn,
                isCurrentPlaylistPlaying && {
                  backgroundColor: hexToRgba(gradientColors[0], 0.2),
                  borderRadius: 22,
                },
              ]}
              onPress={() => handlePlayAll(false)}
              accessibilityLabel={isCurrentPlaylistPlaying ? "Pause" : "Play"}
              accessibilityRole="button"
            >
              <Ionicons
                name={isCurrentPlaylistPlaying ? "pause" : "play"}
                size={22}
                color={isCurrentPlaylistPlaying ? gradientColors[0] : "#FFF"}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Main list */}
        <DraggableFlatList
          data={resolvedTracks}
          onDragEnd={({ from, to }) => {
            if (isLikedPlaylist) return;
            reorderTracks(playlistId, from, to);
            if (activeContext?.type === "playlist" && activeContext?.id === playlistId) {
              usePlayerStore.getState().reorderQueue(from, to);
            }
          }}

          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderDraggableItem}
          extraData={currentTrack?.id}
          ListHeaderComponent={
            <ListHeader
              playlist={playlist}
              resolvedTracks={resolvedTracks}
              isCurrentPlaylistPlaying={isCurrentPlaylistPlaying}
              artParallax={artParallax}
              heroFade={heroFade}
              downloadStatus={downloadStatus}
              downloadSpin={downloadSpin}
              isShuffle={isShuffle && isPlaylistActive}
              gradientColors={gradientColors}
              handleDownload={handleDownload}
              handlePlayAll={handlePlayAll}
              shufflePress={shufflePress}
              playPress={playPress}
              downloadPress={downloadPress}
              sharePress={sharePress}
              glowPulse={glowPulse}
              glowScale={glowScale}
              showActionSheet={showActionSheet}
              onAddSongsPress={() => setIsAddSongsVisible(true)}
              isLikedPlaylist={isLikedPlaylist}
              />

          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: bottomPadding,
            paddingHorizontal: 20,
          }}
          scrollIndicatorInsets={{ bottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isSeedLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={{ marginBottom: 20 }}
                />
                <Text style={styles.emptyTitle}>Curating your vibe...</Text>
                <Text style={styles.emptySubtitle}>
                  Please wait while we hydrate personalized tracks.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <LiquidGlassSurface
                  style={{
                    width: 88,
                    height: 88,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                  borderRadius={44}
                  blurIntensity={50}
                  showTopSpecular
                  showLeftSpecular
                >
                  <Ionicons
                    name="musical-notes-outline"
                    size={40}
                    color="rgba(255,255,255,0.28)"
                  />
                </LiquidGlassSurface>
                <Text style={styles.emptyTitle}>Empty Playlist</Text>
                <Text style={styles.emptySubtitle}>
                  Start adding songs from your library.
                </Text>
              </View>
            )
          }
        />

        {/* Floating nav buttons */}
        <View
          style={[styles.floatingHeader, { top: insets.top + 16 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtnCircle}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <BlurView
              intensity={50}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            {/* Top specular */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 8,
                right: 8,
                height: 1,
                backgroundColor: GLASS.specularTop,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 6,
                bottom: 6,
                width: 2,
                backgroundColor: GLASS.specularLeft,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: GLASS.borderSubtle,
              }}
            />
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.moreCircle}
            onPress={handleOptionsPress}
            accessibilityLabel="Playlist options"
            accessibilityRole="button"
          >
            <BlurView
              intensity={50}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 8,
                right: 8,
                height: 1,
                backgroundColor: GLASS.specularTop,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: GLASS.borderSubtle,
              }}
            />
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color="rgba(255,255,255,0.8)"
            />
          </TouchableOpacity>
        </View>

        {/* Action sheet modal */}
        <Modal
          visible={actionSheetVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setActionSheetVisible(false)}
          statusBarTranslucent
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActionSheetVisible(false)}
          >
            <BlurView
              intensity={50}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(0,0,0,0.6)" },
              ]}
            />
          </TouchableOpacity>
          <View style={styles.modalCardWrap} pointerEvents="box-none">
            <LiquidGlassSurface
              style={styles.actionSheetCard}
              borderRadius={30}
              blurIntensity={70}
              showLeftGlow
              glowColor={
                actionSheetConfig?.actions[0]?.destructive
                  ? "#ff453a"
                  : COLORS.primary
              }
              showTopSpecular
              showLeftSpecular
            >
              <View style={styles.modalHandleWrap}>
                <View style={styles.modalHandle} />
              </View>
              {actionSheetConfig && (
                <>
                  <View style={styles.modalHeaderInfo}>
                    <Text style={styles.modalTitle} numberOfLines={1}>
                      {actionSheetConfig.title}
                    </Text>
                    {actionSheetConfig.subtitle && (
                      <Text style={styles.modalSubtitle} numberOfLines={1}>
                        {actionSheetConfig.subtitle}
                      </Text>
                    )}
                  </View>
                  <View style={styles.modalDivider} />
                  <ScrollView
                    style={styles.modalActionsList}
                    showsVerticalScrollIndicator={false}
                  >
                    {actionSheetConfig.actions.map((act) => (
                      <TouchableOpacity
                        key={act.label}
                        style={styles.modalActionRow}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          act.onPress();
                          if (!act.label.includes("Delete"))
                            setActionSheetVisible(false);
                        }}
                        accessibilityLabel={act.label}
                        accessibilityRole="button"
                      >
                        <LiquidGlassSurface
                          style={{
                            width: 40,
                            height: 40,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          borderRadius={12}
                          blurIntensity={40}
                          glowColor={
                            act.destructive ? "#ff453a" : COLORS.primary
                          }
                          glowOpacity={act.destructive ? 0.12 : 0}
                          showTopSpecular
                        >
                          <Ionicons
                            name={act.icon as any}
                            size={20}
                            color={
                              act.destructive
                                ? "#ff453a"
                                : "rgba(255,255,255,0.85)"
                            }
                          />
                        </LiquidGlassSurface>
                        <Text
                          style={[
                            styles.modalActionLabel,
                            act.destructive ? { color: "#ff453a" } : null,
                          ]}
                        >
                          {act.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              <TouchableOpacity
                onPress={() => setActionSheetVisible(false)}
                style={styles.modalDoneBtn}
                accessibilityLabel="Done"
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={[
                    actionSheetConfig?.actions[0]?.destructive
                      ? "#ff453a"
                      : actionSheetConfig
                        ? "#BF5AF2"
                        : COLORS.primary,
                    COLORS.primaryDeep,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Specular on done btn */}
                <View
                  style={{
                    position: "absolute",
                    top: 3,
                    left: 28,
                    right: 28,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: "rgba(255,255,255,0.22)",
                  }}
                />
                <Text style={styles.modalDoneText}>DONE</Text>
              </TouchableOpacity>
            </LiquidGlassSurface>
          </View>
        </Modal>

        {/* Rename modal */}
        <Modal
          visible={isRenameVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsRenameVisible(false)}
          statusBarTranslucent
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsRenameVisible(false)}
          >
            <BlurView
              intensity={50}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          </TouchableOpacity>
          <View style={styles.modalCardWrap} pointerEvents="box-none">
            <LiquidGlassSurface
              style={styles.renameCard}
              borderRadius={24}
              blurIntensity={65}
              showLeftGlow
              glowColor={COLORS.primary}
              showTopSpecular
              showLeftSpecular
            >
              <Text style={styles.modalTitle}>Rename Playlist</Text>
              {/* iOS 26 glass input */}
              <View style={styles.inputWrap}>
                <BlurView
                  intensity={40}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 12,
                    right: 12,
                    height: 1,
                    backgroundColor: GLASS.specularTop,
                    borderRadius: 1,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    backgroundColor: COLORS.primary,
                    opacity: 0.6,
                    borderRadius: 1,
                  }}
                />
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: GLASS.borderMed,
                  }}
                />
                <TextInput
                  style={styles.renameInput}
                  value={tempName}
                  onChangeText={setTempName}
                  autoFocus
                  maxLength={32}
                  placeholder="Vibe Name..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  returnKeyType="done"
                  onSubmitEditing={saveRename}
                  accessibilityLabel="Playlist name input"
                  selectionColor={COLORS.primary}
                  cursorColor={COLORS.primary}
                  underlineColorAndroid="transparent"
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => setIsRenameVisible(false)}
                  accessibilityLabel="Cancel rename"
                  accessibilityRole="button"
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalSaveBtn]}
                  onPress={saveRename}
                  accessibilityLabel="Save new name"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={[gradientColors[0], COLORS.primaryMid]}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* Specular */}
                  <View
                    style={{
                      position: "absolute",
                      top: 3,
                      left: 20,
                      right: 20,
                      height: 1.5,
                      borderRadius: 1,
                      backgroundColor: "rgba(255,255,255,0.22)",
                    }}
                  />
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </LiquidGlassSurface>
          </View>
        </Modal>

        <AddSongsModal
          isVisible={isAddSongsVisible}
          onClose={() => setIsAddSongsVisible(false)}
          playlistId={playlistId}
        />
        </>
        )}
      </View>
    );
  },
);

LocalPlaylistView.displayName = "LocalPlaylistView";

// ──────────────────────────────────────────────────────────────────────────────
// ─── 2. LEGACY PLAYLIST VIEW ──────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
const LegacyPlaylistView = React.memo(
  ({ playlistId }: { playlistId: string }) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const {
      setQueue,
      toggleShuffle,
      isShuffle,
      isPlaying,
      pause,
      play,
      isLoading,
      isBuffering,
    } = useMusicControls();

    const currentTrack = usePlayerStore((s) => s.currentTrack);
    const activeContext = usePlayerStore((s) => s.activeContext);

    const PLAYLIST_DATA = LEGACY_PLAYLIST_DATA[playlistId] || {
      title: "Playlist",
      description: "",
      stats: "",
      art: "",
      tracks: [],
    };

    const downloadSpin = useRef(new Animated.Value(0)).current;
    const scrollY = useRef(new Animated.Value(0)).current;
    const glowPulse = useRef(new Animated.Value(0.5)).current;
    const glowScale = useRef(new Animated.Value(1.0)).current;

    const [downloadStatus, setDownloadStatus] = useState<
      "none" | "checking" | "updated"
    >("none");

    const isPlaylistActive = useMemo(() => {
      return (
        activeContext?.type === "playlist" && activeContext?.id === playlistId
      );
    }, [activeContext, playlistId]);
    const isCurrentPlaylistPlaying = isPlaylistActive && isPlaying;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, {
            toValue: 1.0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowPulse, {
            toValue: 0.4,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.3,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1.0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, []);

    const handleDownload = useCallback(() => {
      if (downloadStatus === "none") {
        setDownloadStatus("checking");
        setTimeout(() => setDownloadStatus("updated"), 2000);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, [downloadStatus]);

    const handlePlayAll = useCallback(
      async (shuffle = false) => {
        if (isLoading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        const tracks: PlayerTrack[] = PLAYLIST_DATA.tracks.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          art: t.art,
          url: "",
          duration: 0,
          isLocal: false,
          source: "ytmusic",
        }));

        if (tracks.length === 0) return;

        const store = usePlayerStore.getState();
        store.setActiveContext({
          type: "playlist",
          id: playlistId,
          name: PLAYLIST_DATA.title,
        });

        const wasActive =
          store.activeContext?.type === "playlist" &&
          store.activeContext?.id === playlistId;

        if (wasActive) {
          if (shuffle) {
            await toggleShuffle();
          } else {
            isPlaying ? await pause() : await play();
          }
          return;
        }

        if (shuffle && !store.isShuffle) await toggleShuffle();
        await setQueue(tracks, 0, {
          sourceId: playlistId,
          sourceType: "playlist",
          generatedAt: Date.now()
        });
      },
      [
        isLoading,
        isPlaying,
        toggleShuffle,
        pause,
        play,
        setQueue,
        PLAYLIST_DATA,
        playlistId,
      ],
    );

    const handlePlayTrack = useCallback(
      async (item: any) => {
        if (isLoading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const tracks: PlayerTrack[] = PLAYLIST_DATA.tracks.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          art: t.art,
          url: "",
          duration: 0,
          isLocal: false,
          source: "ytmusic",
        }));
        const store = usePlayerStore.getState();
        store.setActiveContext({
          type: "playlist",
          id: playlistId,
          name: PLAYLIST_DATA.title,
        });
        const idx = tracks.findIndex((t) => t.id === item.id);
        if (store.currentTrack?.id === item.id) {
          isPlaying ? await pause() : await play();
          return;
        }
        await setQueue(tracks, idx >= 0 ? idx : 0, {
          sourceId: playlistId,
          sourceType: "playlist",
          generatedAt: Date.now()
        });
      },
      [isLoading, isPlaying, pause, play, setQueue, PLAYLIST_DATA, playlistId],
    );

    const headerOpacity = useRef(
      scrollY.interpolate({
        inputRange: [60, 160],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    ).current;
    const artParallax = useRef(
      scrollY.interpolate({
        inputRange: [0, 300],
        outputRange: [0, -60],
        extrapolate: "clamp",
      }),
    ).current;
    const heroFade = useRef(
      scrollY.interpolate({
        inputRange: [0, 200],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    ).current;

    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        {/* Background */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: "#08080d" }]}
          />
          <View
            style={[
              styles.glowBlob,
              { top: "-5%", left: "-25%", backgroundColor: "#2a0053" },
            ]}
          />
          <View
            style={[
              styles.glowBlob,
              { bottom: "15%", right: "-30%", backgroundColor: "#003731" },
            ]}
          />
          <LinearGradient
            colors={["rgba(8,8,13,0)", "rgba(8,8,13,0.70)", "#08080d"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Sticky header */}
        <Animated.View
          style={[
            styles.stickyHeader,
            { paddingTop: insets.top, opacity: headerOpacity },
          ]}
        >
          <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: GLASS.borderSubtle,
            }}
          />
          <View style={styles.stickyHeaderInner}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={1}
              style={styles.headerBtn}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.stickyTitle} numberOfLines={1}>
              {PLAYLIST_DATA.title}
            </Text>
            <TouchableOpacity
              style={[
                styles.headerBtn,
                isCurrentPlaylistPlaying && {
                  backgroundColor: hexToRgba(COLORS.primary, 0.2),
                  borderRadius: 22,
                },
              ]}
              onPress={() => handlePlayAll(false)}
              accessibilityLabel={isCurrentPlaylistPlaying ? "Pause" : "Play"}
              accessibilityRole="button"
            >
              <Ionicons
                name={isCurrentPlaylistPlaying ? "pause" : "play"}
                size={22}
                color={isCurrentPlaylistPlaying ? COLORS.primary : "#FFF"}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.ScrollView
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: 220,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Materialise delay={0}>
            <View style={styles.navHeader}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtnCircle}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <BlurView
                  intensity={50}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 8,
                    right: 8,
                    height: 1,
                    backgroundColor: GLASS.specularTop,
                    borderRadius: 1,
                  }}
                />
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: GLASS.borderSubtle,
                  }}
                />
                <Ionicons name="chevron-back" size={22} color="#FFF" />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.moreCircle}
                onPress={() =>
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }
                accessibilityLabel="More options"
                accessibilityRole="button"
              >
                <BlurView
                  intensity={50}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 8,
                    right: 8,
                    height: 1,
                    backgroundColor: GLASS.specularTop,
                    borderRadius: 1,
                  }}
                />
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: GLASS.borderSubtle,
                  }}
                />
                <Ionicons
                  name="ellipsis-vertical"
                  size={20}
                  color="rgba(255,255,255,0.8)"
                />
              </TouchableOpacity>
            </View>
          </Materialise>

          <Materialise delay={60}>
            <View style={styles.heroSection}>
              <Animated.View
                style={[
                  styles.artWrapper,
                  { transform: [{ translateY: artParallax }] },
                ]}
              >
                <View
                  style={[
                    styles.artAmbientGlow,
                    {
                      backgroundColor: COLORS.primary,
                      shadowOpacity: isCurrentPlaylistPlaying ? 0.8 : 0.3,
                      shadowRadius: isCurrentPlaylistPlaying ? 50 : 28,
                    },
                  ]}
                />
                <View style={styles.artAmbientGlowInner} />
                <View style={styles.artGlassFrame}>
                  <BlurView
                    intensity={30}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                  />
                  {/* Top specular on art frame */}
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
                  {/* Left glow edge */}
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
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 16,
                      backgroundColor: COLORS.primary,
                      opacity: 0.18,
                      zIndex: 9,
                    }}
                    pointerEvents="none"
                  />
                  <Image
                    source={{ uri: PLAYLIST_DATA.art }}
                    style={styles.heroArt}
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
                  accentColor={COLORS.primary}
                >
                  <View style={styles.badgeContent}>
                    <View style={styles.badgeDot} />
                    <Ionicons
                      name="sparkles"
                      size={11}
                      color={COLORS.primary}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={styles.badgeText}>ENHANCED</Text>
                  </View>
                </GlassPane>
              </Animated.View>

              <Animated.View
                style={[styles.heroTextContainer, { opacity: heroFade }]}
              >
                <Text style={styles.heroTitle}>{PLAYLIST_DATA.title}</Text>
                <Text style={styles.heroDescription}>
                  {PLAYLIST_DATA.description}
                </Text>
                <Text style={styles.heroStats}>{PLAYLIST_DATA.stats}</Text>
                <View style={styles.heroActions}>
                  <TouchableOpacity onPress={handleDownload}>
                    <LiquidGlassSurface
                      style={styles.actionBtn}
                      borderRadius={28}
                      blurIntensity={60}
                      glowColor={
                        downloadStatus === "updated"
                          ? COLORS.accent
                          : COLORS.primary
                      }
                      glowOpacity={downloadStatus === "updated" ? 0.2 : 0}
                      showLeftGlow={downloadStatus === "updated"}
                      showTopSpecular
                      showLeftSpecular
                      enableRipple
                    >
                      {downloadStatus === "checking" ? (
                        <Animated.View
                          style={{
                            transform: [
                              {
                                rotate: downloadSpin.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ["0deg", "360deg"],
                                }),
                              },
                            ],
                          }}
                        >
                          <Ionicons
                            name="sync"
                            size={22}
                            color={COLORS.primary}
                          />
                        </Animated.View>
                      ) : (
                        <Ionicons
                          name={
                            downloadStatus === "updated"
                              ? "cloud-done"
                              : "download-outline"
                          }
                          size={22}
                          color={
                            downloadStatus === "updated"
                              ? COLORS.accent
                              : "#FFF"
                          }
                        />
                      )}
                    </LiquidGlassSurface>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Alert.alert("Share", "Coming soon")}
                  >
                    <LiquidGlassSurface
                      style={styles.actionBtn}
                      borderRadius={28}
                      blurIntensity={60}
                      showTopSpecular
                      showLeftSpecular
                      enableRipple
                    >
                      <Ionicons name="share-outline" size={22} color="#FFF" />
                    </LiquidGlassSurface>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          </Materialise>

          <Materialise delay={140}>
            <View style={styles.controlSection}>
              {/* Shuffle btn */}
              <TouchableOpacity
                onPress={() => handlePlayAll(true)}
                style={styles.shuffleBtnOuter}
                accessibilityLabel="Shuffle all"
                accessibilityRole="button"
              >
                <LiquidGlassSurface
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                  borderRadius={31}
                  blurIntensity={55}
                  glowColor={COLORS.primary}
                  glowOpacity={isShuffle && isPlaylistActive ? 0.2 : 0}
                  showLeftGlow={isShuffle && isPlaylistActive}
                  showTopSpecular
                  showLeftSpecular
                  enableRipple
                >
                  {isShuffle && isPlaylistActive && (
                    <LinearGradient
                      colors={[
                        hexToRgba(COLORS.primary, 0.5),
                        hexToRgba(COLORS.primaryDeep, 0.3),
                        "transparent",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  )}
                  <Ionicons
                    name="shuffle"
                    size={28}
                    color={
                      isShuffle && isPlaylistActive
                        ? "#FFF"
                        : "rgba(255,255,255,0.25)"
                    }
                  />
                  <Text
                    style={[
                      styles.shuffleLabel,
                      !(isShuffle && isPlaylistActive) && {
                        color: "rgba(255,255,255,0.3)",
                      },
                    ]}
                  >
                    Shuffle All
                  </Text>
                </LiquidGlassSurface>
              </TouchableOpacity>

              {/* Play btn */}
              <View style={styles.playBtnWrapper}>
                <Animated.View
                  style={[
                    styles.playBtnGlow,
                    {
                      backgroundColor: COLORS.primary,
                      opacity: glowPulse.interpolate({
                        inputRange: [0.4, 1],
                        outputRange: [0.2, 0.4],
                      }),
                      transform: [{ scale: glowScale }],
                    },
                  ]}
                  pointerEvents="none"
                />
                <TouchableOpacity
                  onPress={() => handlePlayAll(false)}
                  style={styles.playBtnShell}
                  accessibilityLabel={
                    isCurrentPlaylistPlaying ? "Pause" : "Play all"
                  }
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={[
                      COLORS.primary,
                      COLORS.primaryMid,
                      COLORS.primaryDeep,
                    ]}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 14,
                      right: 14,
                      height: 2.5,
                      borderRadius: 2,
                      backgroundColor: "rgba(255,255,255,0.30)",
                      zIndex: 4,
                    }}
                    pointerEvents="none"
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: 8,
                      top: 10,
                      width: 22,
                      bottom: 10,
                      borderRadius: 8,
                      backgroundColor: "rgba(255,255,255,0.16)",
                      transform: [{ skewX: "-8deg" }],
                      zIndex: 4,
                    }}
                    pointerEvents="none"
                  />
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      borderRadius: 32,
                      borderWidth: 1,
                      borderColor: GLASS.borderBright,
                      zIndex: 3,
                    }}
                    pointerEvents="none"
                  />
                  <Ionicons
                    name={isCurrentPlaylistPlaying ? "pause" : "play"}
                    size={34}
                    color="#FFF"
                    style={{
                      marginLeft: isCurrentPlaylistPlaying ? 0 : 4,
                      zIndex: 5,
                    }}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Materialise>

          {/* Track list */}
          <View style={styles.trackListSection}>
            {PLAYLIST_DATA.tracks.map((item, index) => (
              <TrackRow
                key={item.id}
                item={{ ...item, active: currentTrack?.id === item.id }}
                index={index}
                router={router}
                onPlay={handlePlayTrack}
              />
            ))}
          </View>
        </Animated.ScrollView>
      </View>
    );
  },
);

LegacyPlaylistView.displayName = "LegacyPlaylistView";

// ── Legacy TrackRow ────────────────────────────────────────────────────────────
const TrackRow = ({ item, index, router, onPlay }: any) => {
  const rowHighlight = useRef(new Animated.Value(item.active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(rowHighlight, {
      toValue: item.active ? 1 : 0,
      ...MOTION.SPRING_EXPAND,
    }).start();
  }, [item.active]);

  const isLiked = useLikesStore((s) => !!s.likedTrackIds[item.id]);
  const toggleLike = useLikesStore((s) => s.toggleLike);

  return (
    <Materialise delay={220 + index * 45}>
      <TouchableOpacity
        style={[styles.trackRow, item.active && styles.activeTrackRow]}
        activeOpacity={0.8}
        onPress={() => onPlay(item)}
        accessibilityLabel={`${item.title} by ${item.artist}`}
        accessibilityRole="button"
        accessibilityState={{ selected: item.active }}
      >
        {/* Active highlight layer */}
        {item.active && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: 16, opacity: rowHighlight },
            ]}
            pointerEvents="none"
          >
            <BlurView
              intensity={25}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[
                hexToRgba(COLORS.primary, 0.22),
                hexToRgba(COLORS.primary, 0.06),
                "transparent",
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </Animated.View>
        )}
        {item.active && (
          <Animated.View
            style={[styles.activeAccentBar, { opacity: rowHighlight }]}
            pointerEvents="none"
          />
        )}
        <View style={styles.trackIndexContainer}>
          {item.active ? (
            <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
          ) : (
            <Text style={styles.trackIndex}>
              {(index + 1).toString().padStart(2, "0")}
            </Text>
          )}
        </View>
        <View style={styles.trackArtWrapper}>
          <Image source={{ uri: item.art }} style={styles.trackArt} />
        </View>
        <View style={styles.trackInfo}>
          <Text
            style={[styles.trackName, item.active && { color: COLORS.primary }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        <View style={styles.trackMeta}>
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleLike(item);
            }}
            accessibilityLabel={isLiked ? "Unlike" : "Like"}
            accessibilityRole="button"
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={18}
              color={isLiked ? COLORS.primary : "rgba(255,255,255,0.25)"}
            />
          </TouchableOpacity>
          <Text style={styles.trackDuration}>{item.duration}</Text>
        </View>
      </TouchableOpacity>
    </Materialise>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08080d" },
  glowBlob: {
    position: "absolute",
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.425,
    opacity: 0.14,
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: "hidden",
  },
  stickyHeaderInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  stickyTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  backBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  moreCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  heroSection: {
    flexDirection: "column",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  artWrapper: {
    width: width * 0.76,
    aspectRatio: 1,
    borderRadius: 24,
    marginBottom: 28,
    position: "relative",
  },
  artAmbientGlow: {
    position: "absolute",
    inset: -20,
    borderRadius: 44,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 36,
    elevation: 0,
  },
  artAmbientGlowInner: {
    position: "absolute",
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: 36,
  },
  artGlassFrame: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(18,18,22,0.72)",
  },
  heroArt: { flex: 1, borderRadius: 24 },
  enhancedBadge: {
    position: "absolute",
    bottom: 14,
    left: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeContent: { flexDirection: "row", alignItems: "center" },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 5,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  heroTextContainer: { width: "100%" },
  heroTitle: {
    color: "#FFF",
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 46,
    marginBottom: 8,
  },
  heroDescription: {
    color: "rgba(170,170,185,0.55)",
    fontSize: 14,
    fontWeight: "400",
    marginBottom: 6,
    lineHeight: 20,
  },
  heroStats: {
    color: "rgba(170,170,185,0.65)",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 22,
    letterSpacing: 0.3,
  },
  seedArtistsText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  explanationContainer: {
    marginTop: 6,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS.borderSubtle,
    backgroundColor: "rgba(255,255,255,0.035)",
    overflow: "hidden",
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  explanationHeaderTitle: {
    flex: 1,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "600",
  },
  explanationBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: GLASS.borderSubtle,
    paddingTop: 10,
  },
  explanationBodyText: {
    color: "rgba(170,170,185,0.7)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
  heroActions: { flexDirection: "row", gap: 12 },
  actionBtn: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  controlSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  shuffleBtnOuter: {
    flex: 1,
    height: 62,
    borderRadius: 31,
    overflow: "hidden",
  },
  shuffleLabel: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  playBtnWrapper: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnGlow: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 31,
    zIndex: 0,
  },
  playBtnShell: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    zIndex: 2,
  },
  playBtnGlowRing: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    zIndex: 1,
  },
  floatingHeader: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 120,
  },
  trackListSection: { gap: 2, marginBottom: 36, paddingHorizontal: 12 },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    overflow: "hidden",
    position: "relative",
  },
  activeTrackRow: {
    borderRadius: 16,
    borderColor: "rgba(191,90,242,0.18)",
  },
  activeAccentBar: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  trackIndexContainer: {
    width: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  trackIndex: {
    color: "rgba(170,170,185,0.65)",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  trackArtWrapper: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 14,
    position: "relative",
    overflow: "hidden",
  },
  trackArt: { width: 48, height: 48, borderRadius: 10 },
  trackArtPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  trackInfo: { flex: 1 },
  trackName: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  trackArtist: { color: "rgba(170,170,185,0.65)", fontSize: 13, marginTop: 2 },
  trackMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  trackDuration: {
    color: "rgba(170,170,185,0.65)",
    fontSize: 12,
    fontWeight: "600",
    width: 38,
    textAlign: "right",
    fontFamily: "monospace",
  },
  trackOptionsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginLeft: 2,
  },
  trackLikeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginLeft: 2,
  },
  addSongsBtn: {
    borderRadius: 20,
    overflow: "hidden",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    marginTop: 4,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "rgba(170,170,185,0.65)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalCardWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  renameCard: {
    width: width * 0.88,
    padding: 28,
  },
  actionSheetCard: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  modalHandleWrap: { alignItems: "center", marginBottom: 20 },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  modalHeaderInfo: { alignItems: "center", marginBottom: 24 },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFF",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },
  modalDivider: {
    height: 1,
    backgroundColor: GLASS.borderSubtle,
    marginBottom: 8,
  },
  modalActionsList: { maxHeight: height * 0.4 },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  modalActionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    flex: 1,
  },
  inputWrap: {
    height: 54,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  renameInput: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 12 },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalSaveBtn: {
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalCancelText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontWeight: "700",
  },
  modalSaveText: { color: "#FFF", fontSize: 15, fontWeight: "800", zIndex: 2 },
  modalDoneBtn: {
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginTop: 16,
  },
  modalDoneText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: 1.5,
  },
});
