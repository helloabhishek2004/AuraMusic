import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

export interface MarqueeProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  delay?: number;
  speed?: number; // ms per pixel (e.g. 25-35 ms/px)
  gap?: number; // spacing between repetitions in continuous loop
  enabled?: boolean;
}

export const Marquee: React.FC<MarqueeProps> = memo(({
  children,
  style,
  contentContainerStyle,
  delay = 2000,
  speed = 28,
  gap = 48,
  enabled = true,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const translateX = useSharedValue(0);

  const isScrollable = enabled && containerWidth > 0 && contentWidth > containerWidth + 4;

  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = 0;

    if (isScrollable) {
      const totalDistance = contentWidth + gap;
      const scrollDuration = Math.max(2500, Math.round(totalDistance * speed));

      translateX.value = withRepeat(
        withSequence(
          // Pause at initial start position so user can comfortably read the beginning
          withDelay(
            delay,
            withTiming(-totalDistance, {
              duration: scrollDuration,
              easing: Easing.linear,
            })
          ),
          // Instantly reset to 0 (visually seamless because duplicate copy is at exactly 0)
          withTiming(0, { duration: 0 })
        ),
        -1, // Infinite continuous loop
        false // Do NOT reverse/ping-pong - true continuous carousel
      );
    }

    return () => {
      cancelAnimation(translateX);
    };
  }, [children, containerWidth, contentWidth, delay, speed, gap, isScrollable]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== containerWidth) setContainerWidth(w);
      }}
    >
      {/* Off-screen unwrapped measurer */}
      <View
        style={styles.measurer}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== contentWidth) setContentWidth(w);
        }}
        pointerEvents="none"
      >
        <View style={styles.measurerInner}>{children}</View>
      </View>

      {isScrollable ? (
        <Animated.View style={[styles.animatedWrapper, contentContainerStyle, animatedStyle]}>
          <View style={{ marginRight: gap, flexDirection: 'row', alignItems: 'center' }}>
            {children}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {children}
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.normalWrapper, contentContainerStyle]}>
          {children}
        </View>
      )}
    </View>
  );
});

Marquee.displayName = 'Marquee';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
    position: 'relative',
  },
  measurer: {
    position: 'absolute',
    opacity: 0,
    top: -9999,
    left: -9999,
    flexDirection: 'row',
  },
  measurerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  animatedWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  normalWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
