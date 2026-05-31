import React, { memo, useCallback, useRef, useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  LayoutChangeEvent,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Text
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  useAnimatedRef,
  withTiming,
  SharedValue,
  runOnJS,
  useSharedValue,
  interpolate,
  Extrapolation
} from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import { palette, spacing, typography } from "@/src/design/tokens";

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList as any) as any;

interface LyricLineData {
  time: number;
  endTime: number;
  text: string;
}

interface LyricLineProps {
  item: LyricLineData;
  index: number;
  activeLineIndex: SharedValue<number>;
  onPress: (time: number) => void;
}

const LyricLine = memo(({ item, index, activeLineIndex, onPress }: LyricLineProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const ai = activeLineIndex.value;
    const isActive = ai === index;
    const dist = Math.abs(index - ai);
    const isUpcoming = index > ai;

    // Distance-Based Easing Gate: Distant lines use static low-cost styles
    if (dist > 2) {
      return {
        opacity: isUpcoming ? 0.3 : 0.2,
        transform: [{ scale: 0.96 }],
      };
    }

    return {
      opacity: withTiming(isActive ? 1.0 : 0.55, { duration: 200 }),
      transform: [{ scale: withTiming(isActive ? 1.05 : 1.0, { duration: 200 }) }],
    };
  });

  const textStyle = useAnimatedStyle(() => {
    "worklet";
    const isActive = activeLineIndex.value === index;
    return {
      color: isActive ? palette.primary : palette.ink,
      fontWeight: isActive ? "700" : "500",
    };
  });

  return (
    <Animated.View style={[styles.lineWrapper, animatedStyle]}>
      <Animated.Text 
        onPress={() => onPress(item.time)}
        style={[styles.lineText, textStyle]}
        suppressHighlighting
      >
        {item.text || "♪"}
      </Animated.Text>
    </Animated.View>
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
  const flashListRef = useAnimatedRef<any>();
  const { height: windowHeight } = useWindowDimensions();
  const listHeight = useSharedValue(windowHeight * 0.6);

  const lastScrolledIndex = useSharedValue(-1);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    listHeight.value = e.nativeEvent.layout.height;
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => { "worklet"; isFollowing.value = false; },
  });

  // Deterministic Scroll Controller
  useAnimatedReaction(
    () => ({
      index: activeLineIndex.value,
      following: isFollowing.value,
      ready: lyrics.length > 0
    }),
    (cur, prev) => {
      "worklet";
      if (!cur.following || !cur.ready || cur.index < 0) return;
      
      // Only scroll when active line actually changes
      if (cur.index !== lastScrolledIndex.value) {
        lastScrolledIndex.value = cur.index;
        
        // FlashList scrollToItem is performant
        runOnJS((idx: number) => {
            flashListRef.current?.scrollToIndex({
                index: idx,
                animated: true,
                viewPosition: 0.38, // Center-ish alignment
            });
        })(cur.index);
      }
    }
  );

  const renderItem = useCallback(({ item, index }: any) => (
    <LyricLine 
      item={item} 
      index={index} 
      activeLineIndex={activeLineIndex} 
      onPress={seekToLine} 
    />
  ), [seekToLine]);

  if (isLoading) return <LyricsStatus text="Searching for lyrics..." />;
  if (error) return <LyricsStatus text="Couldn't load lyrics" subtext={error} />;
  if (!lyrics || lyrics.length === 0) return <LyricsStatus text="No lyrics available" icon="♪" />;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <AnimatedFlashList
        ref={flashListRef}
        data={lyrics}
        renderItem={renderItem}
        keyExtractor={(item: any, index: number) => `${index}-${item.time}`}
        estimatedItemSize={60}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
            paddingTop: windowHeight * 0.35,
            paddingBottom: windowHeight * 0.5,
            paddingHorizontal: spacing.lg,
        }}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
});

const LyricsStatus = ({ text, subtext, icon }: { text: string; subtext?: string; icon?: string }) => (
  <View style={styles.statusContainer}>
    {icon && <Text style={styles.statusIcon}>{icon}</Text>}
    <Text style={styles.statusText}>{text}</Text>
    {subtext && <Text style={styles.statusSubtext}>{subtext}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  lineWrapper: { justifyContent: "center", paddingVertical: spacing.sm, minHeight: 60 },
  lineText: { ...typography.headline, fontSize: 24, lineHeight: 34, textAlign: "left" },
  statusContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  statusIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5, color: palette.ink },
  statusText: { ...typography.title, fontSize: 18, color: palette.ink, textAlign: "center" },
  statusSubtext: { ...typography.body, color: palette.inkDim, marginTop: spacing.sm, textAlign: "center" },
});
