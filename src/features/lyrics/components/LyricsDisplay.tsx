import React, { memo, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  LayoutChangeEvent,
  useWindowDimensions
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  scrollTo,
  useAnimatedRef,
  withTiming,
  SharedValue,
  interpolate,
  Extrapolation,
  runOnJS,
  useSharedValue
} from "react-native-reanimated";
import { palette, spacing, typography } from "@/src/design/tokens";

interface LyricLineData {
  time: number;
  text: string;
}

interface LyricLineProps {
  item: LyricLineData;
  index: number;
  activeLineIndex: SharedValue<number>;
  lineOffsets: SharedValue<number[]>;
  isFollowing: SharedValue<boolean>;
  onPress: (time: number) => void;
}

const LyricLine = memo(({ item, index, activeLineIndex, lineOffsets, isFollowing, onPress }: LyricLineProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(activeLineIndex.value - index);
    const isActive = activeLineIndex.value === index;
    
    return {
      opacity: withTiming(interpolate(
        distance,
        [0, 1, 3],
        [1, 0.5, 0.3],
        Extrapolation.CLAMP
      ), { duration: 200 }),
      transform: [
        { scale: withTiming(isActive ? 1.05 : 1.0, { duration: 200 }) }
      ],
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const isActive = activeLineIndex.value === index;
    return {
      color: isActive ? palette.primary : palette.ink,
      fontWeight: isActive ? "700" : "500" as any,
    };
  });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    if (lineOffsets.value[index] === undefined) {
      lineOffsets.value[index] = e.nativeEvent.layout.y;
      // Force trigger reaction by reassigning reference
      lineOffsets.value = [...lineOffsets.value];

      if (lineOffsets.value.length > 0 && !isFollowing.value) {
        isFollowing.value = true;
      }
    }
  }, [index, lineOffsets, isFollowing]);

  return (
    <Pressable onPress={() => onPress(item.time)} onLayout={handleLayout}>
      <Animated.View style={[styles.lineWrapper, animatedStyle]}>
        <Animated.Text style={[styles.lineText, textStyle]}>
          {item.text || "♪"}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

LyricLine.displayName = "LyricLine";

interface LyricsDisplayProps {
  lyrics: LyricLineData[];
  isSynced: boolean;
  activeLineIndex: SharedValue<number>;
  isFollowing: SharedValue<boolean>;
  seekToLine: (time: number) => void;
  isLoading?: boolean;
  error?: string | null;
}

export const LyricsDisplay = memo(({
  lyrics,
  isSynced,
  activeLineIndex,
  isFollowing,
  seekToLine,
  isLoading,
  error
}: LyricsDisplayProps) => {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Cached layout values
  const containerHeight = useSharedValue(0);
  const lineOffsets = useSharedValue<number[]>([]);
  const lastScrolledIndex = useSharedValue(-1);

  // Clear offsets and scroll state when lyrics change or orientation changes
  useEffect(() => {
    lineOffsets.value = [];
    lastScrolledIndex.value = -1;
  }, [lyrics, windowWidth, windowHeight, lineOffsets, lastScrolledIndex]);

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    containerHeight.value = e.nativeEvent.layout.height;
  }, [containerHeight]);

  const startResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isFollowing.value = true;
    }, 2000);
  }, [isFollowing]);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      isFollowing.value = false;
      runOnJS(clearResumeTimer)();
    },
    onEndDrag: () => {
      runOnJS(startResumeTimer)();
    },
    onMomentumEnd: () => {
      runOnJS(startResumeTimer)();
    }
  });

  // Reaction for active line changes with Force Retry (Critical Fix #1)
  useAnimatedReaction(
    () => ({
      index: activeLineIndex.value,
      following: isFollowing.value,
      offsetsReady: lineOffsets.value.length,
    }),
    (curr, prev) => {
      const next = curr.index;
      const prevIndex = prev ? prev.index : -1;
      const following = curr.following;
      const offsetsReady = curr.offsetsReady;
      const prevOffsetsReady = prev ? prev.offsetsReady : 0;
      const wasFollowing = prev ? prev.following : false;

      if (next < 0) return;
      const offset = lineOffsets.value[next];
      const validOffset = Number.isFinite(offset);

      const shouldScroll =
        following &&
        offsetsReady > 0 &&
        validOffset &&
        (
          next !== prevIndex ||
          offsetsReady !== prevOffsetsReady ||
          (following && !wasFollowing)
        );

      if (shouldScroll) {
        // Scroll Spam Protection (Critical Fix #5)
        if (lastScrolledIndex.value === next) return;

        const targetY = offset - containerHeight.value * 0.38;

        // Temporary forensic verification logging
        console.log({
          activeIndex: next,
          following: following,
          offset: offset,
          containerHeight: containerHeight.value,
        });

        scrollTo(scrollRef, 0, Math.max(0, targetY), true);
        lastScrolledIndex.value = next;
      }
    }
  );

  // Dynamic content container style padding (Critical Fix #4)
  const animatedContentContainerStyle = useAnimatedStyle(() => {
    return {
      paddingTop: containerHeight.value * 0.38,
      paddingBottom: containerHeight.value * 0.62,
    };
  });

  if (isLoading) return <LyricsStatus text="Searching for lyrics..." />;
  if (error) return <LyricsStatus text="Couldn't load lyrics" subtext={error} />;
  if (!lyrics || lyrics.length === 0) return <LyricsStatus text="No lyrics available" icon="♪" />;

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, animatedContentContainerStyle]}
        decelerationRate="fast"
      >
        {lyrics.map((line, index) => (
          <LyricLine
            key={`${index}-${line.time}`}
            item={line}
            index={index}
            activeLineIndex={activeLineIndex}
            lineOffsets={lineOffsets}
            isFollowing={isFollowing}
            onPress={seekToLine}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
});

LyricsDisplay.displayName = "LyricsDisplay";

const LyricsStatus = ({ text, subtext, icon }: { text: string; subtext?: string; icon?: string }) => (
  <View style={styles.statusContainer}>
    {icon && <Animated.Text style={styles.statusIcon}>{icon}</Animated.Text>}
    <Animated.Text style={styles.statusText}>{text}</Animated.Text>
    {subtext && <Animated.Text style={styles.statusSubtext}>{subtext}</Animated.Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  lineWrapper: {
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  lineText: {
    ...typography.headline,
    fontSize: 22,
    lineHeight: 30,
    textAlign: "left",
  },
  statusContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  statusText: {
    ...typography.title,
    fontSize: 18,
    color: palette.ink,
    textAlign: "center",
  },
  statusSubtext: {
    ...typography.body,
    color: palette.inkDim,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
