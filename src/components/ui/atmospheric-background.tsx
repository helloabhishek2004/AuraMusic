import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, AppState, AppStateStatus } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '@/src/design/tokens';
import { useReducedMotionPreference } from '@/src/hooks/use-accessibility-preferences';
import { hexToRgba } from '@/src/utils/color';

import { Dimensions } from 'react-native';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type AtmosphericBackgroundProps = {
  colors?: string[];
  intensity?: number;
};

function AtmosphericBackgroundComponent({
  colors = [palette.primary, palette.cyan, palette.coral],
  intensity = 1,
}: AtmosphericBackgroundProps) {
  const reduceMotion = useReducedMotionPreference();
  const phase = useRef(new Animated.Value(0)).current;
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || appState !== 'active') {
      if (reduceMotion) phase.setValue(0.35);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [phase, reduceMotion, appState]);

  const meshColors = useMemo(() => {
    const [a, b, c] = colors;
    return {
      a: hexToRgba(a ?? palette.primary, 0.26 * intensity),
      b: hexToRgba(b ?? palette.cyan, 0.18 * intensity),
      c: hexToRgba(c ?? palette.coral, 0.16 * intensity),
    };
  }, [colors, intensity]);

  const driftA = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 34],
  });
  const driftB = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [28, -28],
  });
  const opacity = phase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.82, 1, 0.82],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[palette.background, '#0d0c14', '#09090e']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.layer,
          {
            height: SCREEN_HEIGHT * 0.58,
            top: -SCREEN_HEIGHT * 0.1,
            opacity,
            transform: [{ translateY: driftA }, { rotate: '-8deg' }],
          },
        ]}
      >
        <LinearGradient
          colors={[meshColors.a, 'rgba(255,255,255,0.035)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.layer,
          {
            height: SCREEN_HEIGHT * 0.72,
            bottom: -SCREEN_HEIGHT * 0.18,
            opacity: 0.86,
            transform: [{ translateY: driftB }, { rotate: '10deg' }],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', meshColors.b, meshColors.c]}
          start={{ x: 0.1, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.68)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export const AtmosphericBackground = memo(AtmosphericBackgroundComponent);

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: '-18%',
    right: '-18%',
  },
});
