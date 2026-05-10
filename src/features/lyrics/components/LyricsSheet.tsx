import React, { useMemo, useEffect } from "react";
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
  useSharedValue,
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

/**
 * LyricsSheet Component
 * A modal sheet that displays synchronized lyrics with premium animations.
 * Integrates with the player for automatic progress tracking.
 */
export const LyricsSheet = React.memo(
  ({
    isVisible,
    onClose,
    isExpanded = false,
  }: LyricsSheetProps) => {
    // Get lyrics integration
    const {
      lyrics,
      isLoading,
      error,
      activeLineIndex,
      currentProgress,
      isFollowingPlayback,
      setHasUserScrolled,
    } = useLyricsIntegration({ enabled: isVisible });

    // Animation values
    const scaleAnim = useSharedValue(0.95);
    const opacityAnim = useSharedValue(0);
    const bgOpacityAnim = useSharedValue(0);

    // Animate in/out
    useEffect(() => {
      if (isVisible) {
        scaleAnim.value = withSpring(1.0, {
          damping: 14,
          stiffness: 120,
          mass: 0.7,
        });
        opacityAnim.value = withSpring(1.0, {
          damping: 14,
          stiffness: 120,
          mass: 0.7,
        });
        bgOpacityAnim.value = withSpring(1.0, {
          damping: 14,
          stiffness: 120,
          mass: 0.7,
        });
      } else {
        scaleAnim.value = withSpring(0.95, {
          damping: 14,
          stiffness: 120,
          mass: 0.7,
        });
        opacityAnim.value = withSpring(0, {
          damping: 14,
          stiffness: 120,
          mass: 0.7,
        });
        bgOpacityAnim.value = withSpring(0, {
          damping: 14,
          stiffness: 120,
          mass: 0.7,
        });
      }
    }, [isVisible]);

    const containerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleAnim.value }],
      opacity: opacityAnim.value,
    }));

    const bgStyle = useAnimatedStyle(() => ({
      opacity: bgOpacityAnim.value,
    }));

    // Calculate progress for indicator
    const progressPercent = useMemo(() => {
      if (!lyrics || !lyrics.lyrics || lyrics.lyrics.length === 0) {
        return 0;
      }
      if (activeLineIndex < 0) return 0;
      return ((activeLineIndex + 1) / lyrics.lyrics.length) * 100;
    }, [lyrics, activeLineIndex]);

    if (!isVisible) {
      return null;
    }

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents={isVisible ? "auto" : "none"}>
        {/* Background overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            bgStyle,
            styles.backdrop,
          ]}
          pointerEvents={isVisible ? "auto" : "none"}
        >
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        {/* Sheet content */}
        <Animated.View
          style={[
            styles.sheetContainer,
            containerStyle,
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>Lyrics</Text>
                {lyrics?.synced && (
                  <View style={styles.syncBadge}>
                    <Text style={styles.syncBadgeText}>Synced</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
                style={styles.closeButton}
              >
                <View style={styles.closeButtonBg}>
                  <Ionicons
                    name="close"
                    size={20}
                    color={palette.ink}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Progress indicator */}
            {lyrics && lyrics.synced && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {activeLineIndex + 1} / {lyrics.lyrics.length}
                </Text>
              </View>
            )}

            {/* Lyrics display */}
            <View style={styles.lyricsContainer}>
              <LyricsDisplay
                lyrics={lyrics?.lyrics || []}
                isSynced={lyrics?.synced || false}
                currentProgress={currentProgress}
                activeLineIndex={activeLineIndex}
                isFollowingPlayback={isFollowingPlayback}
                onUserScroll={setHasUserScrolled}
                isLoading={isLoading}
                error={error}
              />
            </View>

            {/* Auto-follow indicator */}
            {!isFollowingPlayback && (
              <View style={styles.resumeIndicator}>
                <View style={styles.resumeBg}>
                  <Text style={styles.resumeText}>Tap to resume auto-scroll</Text>
                  <TouchableOpacity
                    onPress={() => setHasUserScrolled(false)}
                    style={styles.resumeButton}
                  >
                    <Text style={styles.resumeButtonText}>Resume</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    );
  }
);

LyricsSheet.displayName = "LyricsSheet";

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },

  sheetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },

  sheet: {
    width: "100%",
    maxHeight: height * 0.85,
    backgroundColor: palette.glass,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },

  headerTitle: {
    ...typography.title,
    fontSize: 20,
    color: palette.ink,
  },

  syncBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: palette.primary,
    borderRadius: radius.sm,
    opacity: 0.7,
  },

  syncBadgeText: {
    ...typography.caption,
    fontSize: 10,
    color: palette.ink,
    fontWeight: "600",
  },

  closeButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
  },

  closeButtonBg: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: palette.glassSoft,
    justifyContent: "center",
    alignItems: "center",
  },

  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },

  progressBar: {
    height: 2,
    backgroundColor: palette.border,
    borderRadius: 1,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: palette.primary,
  },

  progressText: {
    ...typography.caption,
    color: palette.inkDim,
    textAlign: "center",
  },

  lyricsContainer: {
    flex: 1,
    minHeight: 300,
    paddingVertical: spacing.md,
  },

  resumeIndicator: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  resumeBg: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: palette.glassDense,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  resumeText: {
    ...typography.body,
    color: palette.inkMuted,
    flex: 1,
  },

  resumeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: palette.primary,
    borderRadius: radius.sm,
    marginLeft: spacing.md,
  },

  resumeButtonText: {
    ...typography.caption,
    color: palette.ink,
    fontWeight: "600",
  },
});
