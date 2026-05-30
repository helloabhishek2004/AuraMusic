import React, { useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  useDerivedValue,
  SharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { palette, spacing, radius, typography } from "@/src/design/tokens";
import { LyricsDisplay } from "./LyricsDisplay";
import { useLyricsIntegration } from "../hooks/useLyricsIntegration";

const { width, height } = Dimensions.get("window");

interface LyricsSheetProps {
  isVisible: boolean;
  onClose: () => void;
  isExpanded?: boolean;
}

export const LyricsSheet = React.memo(
  ({
    isVisible,
    onClose,
    isExpanded = false,
  }: LyricsSheetProps) => {
    // Get performance-first lyrics integration
    const {
      lyrics,
      isLoading,
      error,
      isSynced,
      activeLineIndex,
      isFollowing,
      seekToLine,
    } = useLyricsIntegration(isVisible);

    // Animation values for sheet entry/exit
    const scaleAnim = useSharedValue(0.95);
    const opacityAnim = useSharedValue(0);
    const bgOpacityAnim = useSharedValue(0);

    // Animate in/out
    useEffect(() => {
      if (isVisible) {
        scaleAnim.value = withSpring(1.0, { damping: 15, stiffness: 100 });
        opacityAnim.value = withSpring(1.0, { damping: 15, stiffness: 100 });
        bgOpacityAnim.value = withSpring(1.0, { damping: 15, stiffness: 100 });
      } else {
        scaleAnim.value = withSpring(0.95);
        opacityAnim.value = withSpring(0);
        bgOpacityAnim.value = withSpring(0);
      }
    }, [isVisible, scaleAnim, opacityAnim, bgOpacityAnim]);

    const containerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleAnim.value }],
      opacity: opacityAnim.value,
    }));

    const bgStyle = useAnimatedStyle(() => ({
      opacity: bgOpacityAnim.value,
    }));

    // Derived values for progress indicator (UI Thread)
    const progressScale = useDerivedValue(() => {
      if (!lyrics || lyrics.length === 0 || activeLineIndex.value < 0) return 0;
      return (activeLineIndex.value + 1) / lyrics.length;
    });

    const progressFillStyle = useAnimatedStyle(() => ({
      transform: [{ scaleX: progressScale.value }],
      width: "100%",
      transformOrigin: "left",
    } as any));

    if (!isVisible) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents={isVisible ? "auto" : "none"}>
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, bgStyle, styles.backdrop]}
          pointerEvents={isVisible ? "auto" : "none"}
        >
          <BlurView intensity={64} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheetContainer, containerStyle]} pointerEvents="box-none">
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>Lyrics</Text>
                {isSynced && (
                  <View style={styles.syncBadge}>
                    <Text style={styles.syncBadgeText}>Synced</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <View style={styles.closeButtonBg}>
                  <Ionicons name="close" size={20} color={palette.ink} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Progress indicator */}
            {isSynced && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <Animated.View style={[styles.progressFill, progressFillStyle]} />
                </View>
              </View>
            )}

            {/* Display */}
            <View style={styles.lyricsContainer}>
              <LyricsDisplay
                lyrics={lyrics}
                isSynced={isSynced}
                activeLineIndex={activeLineIndex}
                isFollowing={isFollowing}
                seekToLine={seekToLine}
                isLoading={isLoading}
                error={error}
              />
            </View>

            {/* Resume button (JS thread controlled) */}
            <ResumeIndicator isFollowing={isFollowing} onResume={() => { isFollowing.value = true; }} />
          </View>
        </Animated.View>
      </View>
    );
  }
);

/**
 * ResumeIndicator - Reactive but efficient button to resume auto-scroll.
 */
const ResumeIndicator = ({ isFollowing, onResume }: { isFollowing: SharedValue<boolean>, onResume: () => void }) => {
    const animatedStyle = useAnimatedStyle(() => ({
        opacity: withTiming(isFollowing.value ? 0 : 1, { duration: 300 }),
        transform: [{ translateY: withTiming(isFollowing.value ? 20 : 0, { duration: 300 }) }],
        pointerEvents: isFollowing.value ? "none" : "auto" as any,
    }));

    return (
        <Animated.View style={[styles.resumeIndicator, animatedStyle]}>
            <TouchableOpacity onPress={onResume} style={styles.resumeBg} activeOpacity={0.8}>
                <Text style={styles.resumeText}>Tap to resume auto-scroll</Text>
                <View style={styles.resumeButton}>
                    <Ionicons name="arrow-down" size={14} color={palette.ink} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

LyricsSheet.displayName = "LyricsSheet";

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0, 0, 0, 0.6)" },
  sheetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  sheet: {
    width: "100%",
    maxHeight: height * 0.8,
    backgroundColor: "rgba(25, 25, 30, 0.95)",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerContent: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerTitle: { ...typography.title, fontSize: 22, color: palette.ink },
  syncBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: palette.primary,
    borderRadius: radius.sm,
  },
  syncBadgeText: { ...typography.caption, fontSize: 10, color: "#000", fontWeight: "800" },
  closeButton: { padding: spacing.sm },
  closeButtonBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.glassSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  progressBar: { height: 3, backgroundColor: palette.border, borderRadius: 1.5, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: palette.primary },
  lyricsContainer: { flex: 1, minHeight: 400 },
  resumeIndicator: {
    position: "absolute",
    bottom: spacing.lg,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  resumeBg: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  resumeText: { ...typography.caption, color: "#000", fontWeight: "700" },
  resumeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
});
