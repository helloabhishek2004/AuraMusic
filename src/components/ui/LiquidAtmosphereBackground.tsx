import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  AppStateStatus,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';

const { width: SW, height: SH } = Dimensions.get('window');

const BG_COLOR = '#08080D';

export interface LiquidAtmosphereBackgroundProps {
  /** Optional target route(s) to verify active visibility and pause animation when offscreen */
  targetRoute?: string | string[];
  /** Manual active override */
  active?: boolean;
  /** Custom base background color, defaults to #08080D */
  backgroundColor?: string;
}

/**
 * LiquidAtmosphereBackground
 *
 * Canonical signature AuraMusic Liquid Glass animated background.
 * Matches the Search page:
 * - 3 breathing ambient organic blobs (deep royal purple, deep teal/cyan, twilight plum)
 * - Native driver execution for silky-smooth 60/120 FPS rendering
 * - Multi-stop depth vignette LinearGradient ensuring perfect text & card legibility
 * - Automatic AppState lifecycle & route visibility pausing for zero battery drain
 */
function LiquidAtmosphereBackgroundComponent({
  targetRoute,
  active = true,
  backgroundColor = BG_COLOR,
}: LiquidAtmosphereBackgroundProps) {
  const phase = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();
  const [appState, setAppState] = useState(AppState.currentState);

  // AppState lifecycle listener (pause when backgrounded)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setAppState(next);
    });
    return () => sub.remove();
  }, []);

  // Determine visibility based on route matching if specified
  const isRouteVisible = React.useMemo(() => {
    if (!targetRoute) return true;
    if (Array.isArray(targetRoute)) {
      return targetRoute.some((r) => pathname === r || pathname.startsWith(r));
    }
    return pathname === targetRoute || pathname.startsWith(targetRoute);
  }, [pathname, targetRoute]);

  const shouldAnimate = active && isRouteVisible && appState === 'active';

  useEffect(() => {
    if (!shouldAnimate) {
      phase.stopAnimation();
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 2,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [phase, shouldAnimate]);

  // Interpolations exactly matching search.tsx
  const b1Op = phase.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.12, 0.2, 0.09],
  });
  const b2Op = phase.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.07, 0.13, 0.16],
  });
  const b3Op = phase.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.04, 0.1, 0.06],
  });

  const b1Y = phase.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 24, -12],
  });
  const b2Y = phase.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -18, 10],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base Canvas */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />

      {/* Blob 1 — Top-Left Royal Purple */}
      <Animated.View
        style={[
          styles.blob,
          {
            width: SW * 0.88,
            height: SW * 0.88,
            backgroundColor: '#2a0053',
            transform: [{ translateX: -SW * 0.28 }, { translateY: b1Y }],
            opacity: b1Op,
          },
        ]}
      />

      {/* Blob 2 — Right Deep Atmospheric Teal */}
      <Animated.View
        style={[
          styles.blob,
          {
            width: SW * 0.68,
            height: SW * 0.68,
            backgroundColor: '#003731',
            transform: [{ translateX: SW * 0.24 }, { translateY: b2Y }],
            opacity: b2Op,
            top: SH * 0.15,
          },
        ]}
      />

      {/* Blob 3 — Lower Left Deep Twilight Plum */}
      <Animated.View
        style={[
          styles.blob,
          {
            width: SW * 0.48,
            height: SW * 0.48,
            backgroundColor: '#1a0038',
            left: '-8%',
            bottom: '38%',
            opacity: b3Op,
          },
        ]}
      />

      {/* Depth Vignette Fade Overlay — Ensures absolute typography & card clarity */}
      <LinearGradient
        colors={['rgba(8,8,13,0.0)', 'rgba(8,8,13,0.60)', 'rgba(8,8,13,0.95)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export const LiquidAtmosphereBackground = memo(LiquidAtmosphereBackgroundComponent);
export default LiquidAtmosphereBackground;

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: SW * 0.5,
  },
});
