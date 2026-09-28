import React, { memo, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export interface LiquidToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}

// ── Design Tokens & Dimensions ──────────────────────────────────────────────
// Based on the React web template:
// Track: 46dp width x 24dp height (scaled comfortably for touch screens)
// Thumb: 26dp width x 20dp height pill shape
// Slide distance: 2px -> 18px (delta = 16dp)
const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 24;
const THUMB_WIDTH = 26;
const THUMB_HEIGHT = 20;
const TRAVEL_DIST = TRACK_WIDTH - THUMB_WIDTH - 3; // 46 - 26 - 3 = 17dp

const DEFAULT_ACTIVE = '#BF5AF2'; // AuraMusic Signature Violet
const DEFAULT_INACTIVE = 'rgba(255, 255, 255, 0.12)';

/**
 * LiquidToggle — AuraMusic Liquid Glass Interactive Switch
 *
 * Implements the optical liquid pop & morph effects from the React switch template:
 * - Smooth track color morph with translucent obsidian/violet gradient
 * - Elastic pill thumb translating smoothly
 * - Dynamic "lt-pop" lens flare expansion: pop scale expands to 1.35x and fades
 * - Specular liquid fill layer with directional reflection
 * - Chromatic liquid border that illuminates during the pop phase
 * - Native haptic feedback on every switch event
 */
function LiquidToggleComponent({
  value,
  onChange,
  disabled = false,
  activeColor = DEFAULT_ACTIVE,
  style,
  hitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
}: LiquidToggleProps) {
  // Continuous position progress: 0 (unchecked) to 1 (checked)
  const anim = useSharedValue(value ? 1 : 0);

  // Pop burst key progress: runs a quick 0 -> 1 animation on every toggle
  const popAnim = useSharedValue(0);

  useEffect(() => {
    // 500ms smooth translation and color transition (matching template duration-500)
    anim.value = withTiming(value ? 1 : 0, {
      duration: 480,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    });

    // lt-pop pulse: scale bursts up, holds momentarily, then settles back
    popAnim.value = 0;
    popAnim.value = withTiming(1, {
      duration: 480,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
  }, [value]);

  // Track background & glow
  const animatedTrackStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      anim.value,
      [0, 1],
      [DEFAULT_INACTIVE, 'rgba(191, 90, 242, 0.82)']
    );
    const borderColor = interpolateColor(
      anim.value,
      [0, 1],
      ['rgba(255, 255, 255, 0.14)', 'rgba(215, 130, 255, 0.45)']
    );
    return {
      backgroundColor: bgColor,
      borderColor,
    };
  });

  // Thumb container translation
  const animatedThumbContainerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(anim.value, [0, 1], [2, 2 + TRAVEL_DIST]);
    return {
      transform: [{ translateX }],
    };
  });

  // lt-pop optical lens aura: 0% -> scale 1, 20-65% -> scale 1.38, 100% -> scale 1
  // border-color: transparent -> #e0f2fe30 / #bf5af240 -> transparent
  const animatedPopRingStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      popAnim.value,
      [0, 0.22, 0.68, 1],
      [1, 1.36, 1.36, 1]
    );
    const borderColor = interpolateColor(
      popAnim.value,
      [0, 0.22, 0.68, 1],
      [
        'rgba(255, 255, 255, 0)',
        'rgba(224, 242, 254, 0.40)',
        'rgba(191, 90, 242, 0.40)',
        'rgba(255, 255, 255, 0)',
      ]
    );
    return {
      borderColor,
      transform: [{ scale }],
    };
  });

  // lt-fill layer: 0% -> 1, 20-65% -> 0.15 (revealing the glassy translucent core), 100% -> 1
  const animatedFillStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      popAnim.value,
      [0, 0.22, 0.68, 1],
      [1, 0.22, 0.22, 1]
    );
    return { opacity };
  });

  const handlePress = () => {
    if (disabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore
    }
    onChange(!value);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={hitSlop}
      style={[styles.pressable, disabled && styles.disabled, style]}
    >
      <Animated.View style={[styles.track, animatedTrackStyle]}>
        {/* Track interior liquid sheen */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.16)', 'transparent', 'rgba(0, 0, 0, 0.22)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Sliding thumb container */}
        <Animated.View
          style={[styles.thumbContainer, animatedThumbContainerStyle]}
          pointerEvents="none"
        >
          {/* lt-pop expanding ring layer */}
          <Animated.View style={[styles.popLayer, animatedPopRingStyle]}>
            {/* Glassy backdrop refraction base */}
            <View style={styles.glassBackdrop} />

            {/* Solid liquid gradient pill fill (fades down during pop) */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.fillLayer, animatedFillStyle]}>
              <LinearGradient
                colors={
                  value
                    ? ['#FFFFFF', '#E0F2FE', '#D0E4FF']
                    : ['#FFFFFF', '#F1F5F9', '#E2E8F0']
                }
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Specular high-light reflection */}
              <View style={styles.thumbSpecular} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export const LiquidToggle = memo(LiquidToggleComponent);
LiquidToggle.displayName = 'LiquidToggle';
export default LiquidToggle;

const styles = StyleSheet.create({
  pressable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbContainer: {
    position: 'absolute',
    top: (TRACK_HEIGHT - THUMB_HEIGHT) / 2 - 1, // center vertically inside track border
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    zIndex: 10,
  },
  popLayer: {
    width: '100%',
    height: '100%',
    borderRadius: THUMB_HEIGHT / 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: THUMB_HEIGHT / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  fillLayer: {
    borderRadius: THUMB_HEIGHT / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 3,
  },
  thumbSpecular: {
    position: 'absolute',
    top: 1,
    left: 3,
    right: 3,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderRadius: 0.5,
  },
});
