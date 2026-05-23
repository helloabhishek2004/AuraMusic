import React, { memo, useCallback, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { motion } from '@/src/design/tokens';
import { useReducedMotionPreference } from '@/src/hooks/use-accessibility-preferences';
import { impact } from '@/src/utils/haptics';

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
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotionPreference();

  const animateTo = useCallback(
    (value: number) => {
      if (reduceMotion) return;
      Animated.spring(scale, {
        toValue: value,
        ...motion.spring.press,
        useNativeDriver: true,
      }).start();
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

  return (
    <Animated.View style={[wrapperStyle, { transform: [{ scale }] }]}>
      <Pressable
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

// Hook variant: returns an object with `scale`, `onIn`, and `onOut` to match legacy callers
export const usePressScale = (scaleTo = 0.96) => {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotionPreference();

  const onIn = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: scaleTo,
      ...motion.spring.press,
      useNativeDriver: true,
    }).start();
  };

  const onOut = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      ...motion.spring.press,
      useNativeDriver: true,
    }).start();
  };

  return { scale, onIn, onOut };
};
