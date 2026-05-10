import React, { useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Platform,
  ScrollViewProps,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useDerivedValue,
  runOnJS,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { palette, spacing, radius, typography } from "@/src/design/tokens";

const { width, height } = Dimensions.get("window");

interface LyricsDisplayProps {
  lyrics: Array<{ time: number; text: string }> | null;
  isSynced: boolean;
  currentProgress: number;
  activeLineIndex: number;
  isFollowingPlayback: boolean;
  onUserScroll: (scrolled: boolean) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Individual lyric line row component with animation.
 * Memoized to prevent unnecessary rerenders.
 */
interface LyricLineProps {
  text: string;
  isActive: boolean;
  isSynced: boolean;
  isPast: boolean;
}

const LyricLine = memo(
  ({ text, isActive, isSynced, isPast }: LyricLineProps) => {
    const opacityAnim = useSharedValue(isPast ? 0.35 : 0.6);
    const scaleAnim = useSharedValue(isActive ? 1.08 : 1.0);

    useEffect(() => {
      if (isActive) {
        opacityAnim.value = withSpring(1.0, {
          damping: 12,
          stiffness: 150,
          mass: 0.8,
        });
        scaleAnim.value = withSpring(1.08, {
          damping: 12,
          stiffness: 150,
          mass: 0.8,
        });
      } else if (isPast) {
        opacityAnim.value = withTiming(0.35, { duration: 240 });
        scaleAnim.value = withTiming(1.0, { duration: 240 });
      } else {
        opacityAnim.value = withTiming(0.6, { duration: 240 });
        scaleAnim.value = withTiming(1.0, { duration: 240 });
      }
    }, [isActive, isPast]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacityAnim.value,
      transform: [{ scale: scaleAnim.value }],
    }));

    return (
      <Animated.View style={[styles.lyricLineContainer, animatedStyle]}>
        <Text
          style={[
            styles.lyricText,
            isActive && styles.lyricTextActive,
          ]}
          numberOfLines={3}
        >
          {text || "♪"}
        </Text>
      </Animated.View>
    );
  }
);

LyricLine.displayName = "LyricLine";

/**
 * Empty state for when no lyrics are available.
 */
const LyricsEmpty = memo(() => (
  <View style={styles.emptyContainer}>
    <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    />
    <View style={styles.emptyContent}>
      <Text style={styles.emptyIcon}>♪</Text>
      <Text style={styles.emptyTitle}>No Lyrics Available</Text>
      <Text style={styles.emptySubtitle}>
        Enjoy the music while we search for lyrics
      </Text>
    </View>
  </View>
));

LyricsEmpty.displayName = "LyricsEmpty";

/**
 * Error state for when lyrics fetch fails.
 */
const LyricsError = memo(({ error }: { error: string }) => (
  <View style={styles.emptyContainer}>
    <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    />
    <View style={styles.emptyContent}>
      <Text style={styles.emptyIcon}>✕</Text>
      <Text style={styles.emptyTitle}>Lyrics Failed</Text>
      <Text style={styles.emptySubtitle}>{error}</Text>
    </View>
  </View>
));

LyricsError.displayName = "LyricsError";

/**
 * Loading state skeleton.
 */
const LyricsLoading = memo(() => (
  <View style={styles.emptyContainer}>
    <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    />
    <View style={styles.emptyContent}>
      <Text style={styles.emptyIcon}>…</Text>
      <Text style={styles.emptyTitle}>Loading Lyrics</Text>
    </View>
  </View>
));

LyricsLoading.displayName = "LyricsLoading";

/**
 * Main LyricsDisplay Component
 * Renders lyrics with synchronized highlighting and smooth auto-scroll.
 */
export const LyricsDisplay = memo(
  ({
    lyrics,
    isSynced,
    currentProgress,
    activeLineIndex,
    isFollowingPlayback,
    onUserScroll,
    isLoading = false,
    error = null,
  }: LyricsDisplayProps) => {
    const flashListRef = useRef<FlashList<any>>(null);
    const scrollOffsetY = useSharedValue(0);
    const lastScrollTime = useRef<number>(0);
    const isAutoScrolling = useRef<boolean>(false);

    // Line height constant for scroll calculations
    const LINE_HEIGHT = 72; // Estimated height of each lyric line
    const SCROLL_OFFSET = height / 3; // Offset from top to center active line

    /**
     * Handle manual scroll detection.
     * Temporarily disable auto-follow when user manually scrolls.
     */
    const handleScroll = useCallback(
      (event: any) => {
        if (!isAutoScrolling.current) {
          const now = Date.now();
          // Debounce: only mark as scrolled if sufficient time has passed
          if (now - lastScrollTime.current > 200) {
            onUserScroll(true);
            lastScrollTime.current = now;
          }
        }
        scrollOffsetY.value = event.nativeEvent.contentOffset.y;
      },
      [onUserScroll]
    );

    /**
     * Auto-scroll to center the active lyric line.
     * Uses smooth animation for premium feel.
     */
    useEffect(() => {
      if (
        !isFollowingPlayback ||
        activeLineIndex < 0 ||
        !flashListRef.current ||
        !lyrics
      ) {
        return;
      }

      // Calculate target scroll position
      const targetY = Math.max(0, activeLineIndex * LINE_HEIGHT - SCROLL_OFFSET);

      isAutoScrolling.current = true;

      // Use a small delay to ensure view measurements are ready
      const timeoutId = setTimeout(() => {
        flashListRef.current?.scrollToIndex({
          index: activeLineIndex,
          animated: true,
          viewPosition: 0.5, // Center the item vertically
        });

        // Reset auto-scrolling flag after animation completes
        setTimeout(() => {
          isAutoScrolling.current = false;
        }, 400);
      }, 50);

      return () => clearTimeout(timeoutId);
    }, [activeLineIndex, isFollowingPlayback, lyrics]);

    /**
     * Handle scroll gestures to resume auto-follow after inactivity.
     */
    const panGesture = useMemo(
      () =>
        Gesture.Pan()
          .onTouchesDown(() => {
            // User touched the list
            if (isFollowingPlayback) {
              runOnJS(onUserScroll)(true);
            }
          })
          .onFinalize(() => {
            // After pan ends, wait a bit then resume auto-follow
            const timer = setTimeout(() => {
              // Resume after inactivity threshold
              if (Date.now() - lastScrollTime.current > 3000) {
                runOnJS(onUserScroll)(false);
              }
            }, 1500);

            return () => clearTimeout(timer);
          }),
      [isFollowingPlayback, onUserScroll]
    );

    // Render content based on state
    if (isLoading) {
      return <LyricsLoading />;
    }

    if (error) {
      return <LyricsError error={error} />;
    }

    if (!lyrics || lyrics.length === 0) {
      return <LyricsEmpty />;
    }

    // Prepare data for FlashList with index-based rendering
    const renderData = lyrics.map((lyric, index) => ({
      ...lyric,
      id: `lyric-${index}`,
      index,
    }));

    const renderLyricLine = useCallback(
      ({ item, index }: { item: any; index: number }) => (
        <LyricLine
          text={item.text}
          isActive={isSynced && index === activeLineIndex}
          isSynced={isSynced}
          isPast={isSynced && index < activeLineIndex}
        />
      ),
      [isSynced, activeLineIndex]
    );

    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.container}>
          {/* Background with glass effect */}
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "100%",
              backgroundColor: "rgba(255,255,255,0.01)",
            }}
          />

          {/* Gradient overlay for premium feel */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 80,
              background: "linear-gradient(180deg, rgba(7,7,12,0.8) 0%, rgba(7,7,12,0) 100%)",
            }}
          />

          {/* Lyrics List */}
          <FlashList
            ref={flashListRef}
            data={renderData}
            renderItem={renderLyricLine}
            keyExtractor={(item) => item.id}
            estimatedItemSize={LINE_HEIGHT}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={<View style={{ height: SCROLL_OFFSET }} />}
            ListFooterComponent={<View style={{ height: SCROLL_OFFSET }} />}
            scrollIndicatorInsets={{ top: 0, left: 5, bottom: 0, right: 5 }}
          />

          {/* Center highlight line indicator */}
          {isSynced && (
            <View style={styles.centerLineIndicator}>
              <View
                style={{
                  height: 2,
                  backgroundColor: palette.primary,
                  borderRadius: 1,
                }}
              />
            </View>
          )}
        </View>
      </GestureDetector>
    );
  }
);

LyricsDisplay.displayName = "LyricsDisplay";

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    overflow: "hidden",
    borderRadius: radius.xl,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  lyricLineContainer: {
    height: 72,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.md,
    marginVertical: spacing.sm,
  },

  lyricText: {
    ...typography.headline,
    color: palette.inkMuted,
    textAlign: "center",
    fontSize: 18,
    lineHeight: 26,
  },

  lyricTextActive: {
    color: palette.ink,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
  },

  centerLineIndicator: {
    position: "absolute",
    top: "50%",
    left: spacing.lg,
    right: spacing.lg,
    marginTop: -1,
    height: 4,
    justifyContent: "center",
    pointerEvents: "none",
  },

  emptyContainer: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: radius.xl,
  },

  emptyContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },

  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.lg,
    opacity: 0.4,
  },

  emptyTitle: {
    ...typography.headline,
    fontSize: 18,
    marginBottom: spacing.sm,
    color: palette.ink,
  },

  emptySubtitle: {
    ...typography.body,
    color: palette.inkDim,
    textAlign: "center",
  },
});
