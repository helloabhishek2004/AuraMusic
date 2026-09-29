import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  AccessibilityInfo,
  ImageBackground,
  Image,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: SW, height: SH } = Dimensions.get('window');

export type BlurLevel = 'none' | 'subtle' | 'medium' | 'strong' | number;

export interface AuraBlendAtmosphereProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  blurLevel?: BlurLevel;
  dimmed?: boolean;
  dimLevel?: number;
}

/**
 * AuraBlendAtmosphere — The Sonic Nebula Signature Background
 *
 * Implements the Apple-grade animated fluid gradient based on FeralUI Untitled Blend:
 * - 5-Color Harmonic Palette: Edo Purple (#745399), Orchid Grey (#C9A6F2),
 *   Wisteria (#B28FCE), Dark Purple (#460E44), Lapis (#1E50A2)
 * - Noticeable, calm, UI-thread horizontal drift (translateX -50 -> +50 over 15s)
 * - Gentle vertical floating and breathing scale
 * - Progressive blur evolution (none -> subtle -> medium -> strong)
 * - Layered 0.030 film grain noise overlay
 * - Multi-stop obsidian vignette for high-contrast typography and controls
 * - Full reduced-motion accessibility support
 */
export const AuraBlendAtmosphere = React.memo(({
  style,
  children,
  blurLevel = 'none',
  dimmed = false,
  dimLevel = 0,
}: AuraBlendAtmosphereProps) => {
  const [reduceMotion, setReduceMotion] = useState(false);

  // Shared values for UI-thread animation
  const driftX = useSharedValue(-48);
  const driftY = useSharedValue(-8);
  const scaleAnim = useSharedValue(1.04);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => setReduceMotion(enabled)
    );

    return () => {
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      driftX.value = 0;
      driftY.value = 0;
      scaleAnim.value = 1.04;
      return;
    }

    // 1. Organic Noticeable Rightward-Leftward Drift (-50 to +50 over 15s)
    driftX.value = withRepeat(
      withSequence(
        withTiming(50, {
          duration: 15000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(-50, {
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      true
    );

    // 2. Micro Vertical Floating
    driftY.value = withRepeat(
      withSequence(
        withTiming(12, {
          duration: 19000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(-12, {
          duration: 21000,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      true
    );

    // 3. Gentle Breathing Scale (1.04 to 1.08)
    scaleAnim.value = withRepeat(
      withSequence(
        withTiming(1.08, {
          duration: 17000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1.04, {
          duration: 18000,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      true
    );
  }, [reduceMotion]);

  const animatedCanvasStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scaleAnim.value },
        { translateX: driftX.value },
        { translateY: driftY.value },
      ],
    };
  });

  // Compute blur intensity
  const blurIntensity = (() => {
    if (typeof blurLevel === 'number') return Math.max(0, blurLevel);
    switch (blurLevel) {
      case 'subtle':
        return 14;
      case 'medium':
        return 30;
      case 'strong':
        return 54;
      case 'none':
      default:
        return 0;
    }
  })();

  // Compute progressive dimming values
  const effectiveDim = dimmed ? 0.32 : Math.min(0.65, Math.max(0, dimLevel));

  return (
    <View style={[styles.root, style]}>
      {/* ── 1. Fluid Gradient Canvas (High-Res Mesh with Rightward Drift) ── */}
      <Animated.View style={[styles.gradientCanvas, animatedCanvasStyle]}>
        <ImageBackground
          source={require('@/assets/images/untitled_blend.jpg')}
          style={styles.meshImage}
          resizeMode="cover"
        />
      </Animated.View>

      {/* ── 2. Subtle Film Grain Overlay (0.030 opacity texture) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={require('@/assets/images/film_grain.png')}
          style={styles.grainOverlay}
          resizeMode="repeat"
        />
      </View>

      {/* ── 3. Progressive Blur Layer ── */}
      {blurIntensity > 0 && (
        <BlurView
          intensity={blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {/* ── 4. Progressive Obsidian Vignette (Protects Top Status Bar & Bottom Actions) ── */}
      <LinearGradient
        colors={[
          `rgba(10, 8, 18, ${Math.min(0.9, 0.45 + effectiveDim * 0.8)})`,
          `rgba(10, 8, 18, ${Math.min(0.85, 0.15 + effectiveDim * 0.9)})`,
          `rgba(10, 8, 18, ${Math.min(0.94, 0.65 + effectiveDim * 0.7)})`,
          `rgba(10, 8, 18, ${Math.min(0.99, 0.95 + effectiveDim * 0.1)})`,
        ]}
        locations={[0, 0.32, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── 5. Screen Content ── */}
      {children}
    </View>
  );
});

AuraBlendAtmosphere.displayName = 'AuraBlendAtmosphere';

// Backward compatibility alias
export const GrapeDuskAtmosphere = AuraBlendAtmosphere;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#120E1E', // Dark Violet Base matching #460E44 / #1E50A2 depth
    overflow: 'hidden',
  },
  gradientCanvas: {
    ...StyleSheet.absoluteFillObject,
    width: SW * 1.36,
    height: SH * 1.30,
    left: -SW * 0.18,
    top: -SH * 0.15,
  },
  meshImage: {
    width: '100%',
    height: '100%',
  },
  grainOverlay: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.030, // Faithful to FeralUI 0.030 grain
  },
});
