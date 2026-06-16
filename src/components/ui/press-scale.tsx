import React, { memo, useCallback } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotionPreference } from '@/src/hooks/use-accessibility-preferences';
import { impact } from '@/src/utils/haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

type PressScaleProps = PressableProps & {
  children: React.ReactNode;
  wrapperStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: Haptics.ImpactFeedbackStyle | false;
};

function PressScaleComponent({
  children,
  wrapperStyle,
  scaleTo = 0.96,
  haptic = false,
  onPressIn,
  onPressOut,
  disabled,
  ...pressableProps
}: PressScaleProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotionPreference();

  const animateTo = useCallback(
    (value: number) => {
      if (reduceMotion) return;
      scale.value = withSpring(value, {
        stiffness: 260,
        damping: 18,
      });
    },
    [reduceMotion, scale]
  );

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!disabled) {
        if (haptic) impact(haptic);
        animateTo(scaleTo);
      }
      onPressIn?.(event);
    },
    [animateTo, disabled, haptic, onPressIn, scaleTo]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      if (!disabled) animateTo(1);
      onPressOut?.(event);
    },
    [animateTo, disabled, onPressOut]
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Animated.View style={[wrapperStyle, animatedStyle]}>
      <Pressable
        {...({ unstable_pressDelay: 90 } as any)}
        {...pressableProps}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={pressableProps.android_ripple ?? { color: 'rgba(255,255,255,0.08)', borderless: false }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export const PressScale = memo(PressScaleComponent);

// Hook variant: returns an object with `scale` (SharedValue), `onIn`, `onOut`, and `style` (animated style)
export const usePressScale = (scaleTo = 0.96) => {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotionPreference();

  const onIn = useCallback(() => {
    if (reduceMotion) return;
    scale.value = withSpring(scaleTo, {
      stiffness: 260,
      damping: 18,
    });
  }, [reduceMotion, scaleTo]);

  const onOut = useCallback(() => {
    if (reduceMotion) return;
    scale.value = withSpring(1, {
      stiffness: 260,
      damping: 18,
    });
  }, [reduceMotion]);

  const style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return { scale, onIn, onOut, style };
};
