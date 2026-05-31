import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

interface MarqueeProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
  speed?: number; // ms per pixel
}

export const Marquee: React.FC<MarqueeProps> = ({
  children,
  style,
  delay = 2000,
  speed = 30,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = 0;

    if (contentWidth > containerWidth && containerWidth > 0) {
      const offset = contentWidth - containerWidth;
      const animDuration = Math.max(3000, offset * speed);

      translateX.value = withDelay(
        delay,
        withRepeat(
          withTiming(-offset, {
            duration: animDuration,
            easing: Easing.inOut(Easing.ease),
          }),
          -1, // Infinite loops
          true // Ping-pong (reverse direction back to start)
        )
      );
    }

    return () => {
      cancelAnimation(translateX);
    };
  }, [children, containerWidth, contentWidth, delay, speed]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const isScrollable = contentWidth > containerWidth;

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Off-screen measurer to compute unwrapped natural width */}
      <View
        style={styles.measurer}
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
        pointerEvents="none"
      >
        {children}
      </View>

      {isScrollable ? (
        <Animated.View style={[styles.animatedWrapper, { width: contentWidth }, animatedStyle]}>
          {children}
        </Animated.View>
      ) : (
        <View style={styles.normalWrapper}>
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
  },
  measurer: {
    position: 'absolute',
    opacity: 0,
    flexDirection: 'row',
  },
  animatedWrapper: {
    flexDirection: 'row',
  },
  normalWrapper: {
    width: '100%',
  },
});
