import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';

const { width: SW } = Dimensions.get('window');

// Organic celestial star coordinates (relative to 320x220 container)
const STARS = [
  { cx: 35, cy: 45, r: 2.5, color: '#FFFFFF', baseOp: 0.7 },
  { cx: 75, cy: 95, r: 2.0, color: '#DAB9FF', baseOp: 0.5 },
  { cx: 125, cy: 40, r: 3.2, color: '#FFFFFF', baseOp: 0.9 },
  { cx: 180, cy: 80, r: 2.2, color: '#46F5E0', baseOp: 0.6 },
  { cx: 245, cy: 50, r: 2.8, color: '#DAB9FF', baseOp: 0.8 },
  { cx: 290, cy: 110, r: 2.0, color: '#FFFFFF', baseOp: 0.5 },
  { cx: 160, cy: 145, r: 3.5, color: '#BF5AF2', baseOp: 0.85 },
  { cx: 90, cy: 170, r: 2.2, color: '#FFFFFF', baseOp: 0.65 },
  { cx: 220, cy: 165, r: 2.4, color: '#46F5E0', baseOp: 0.7 },
  { cx: 275, cy: 195, r: 1.8, color: '#FFFFFF', baseOp: 0.4 },
  { cx: 50, cy: 130, r: 1.5, color: '#DAB9FF', baseOp: 0.45 },
  { cx: 210, cy: 25, r: 1.6, color: '#FFFFFF', baseOp: 0.5 },
];

// Faint constellation links between key star nodes
const CONSTELLATIONS = [
  { x1: 35, y1: 45, x2: 75, y2: 95 },
  { x1: 75, y1: 95, x2: 125, y2: 40 },
  { x1: 125, y1: 40, x2: 180, y2: 80 },
  { x1: 180, y1: 80, x2: 245, y2: 50 },
  { x1: 180, y1: 80, x2: 160, y2: 145 },
  { x1: 160, y1: 145, x2: 220, y2: 165 },
  { x1: 160, y1: 145, x2: 90, y2: 170 },
];

export const ConstellationParticles = React.memo(() => {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 3200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.55,
          duration: 3400,
          useNativeDriver: true,
        }),
      ])
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 4,
          duration: 6000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    floatLoop.start();

    return () => {
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [pulseAnim, floatAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: pulseAnim,
          transform: [{ translateY: floatAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <Svg width={320} height={220} viewBox="0 0 320 220">
        {/* Constellation connective lines */}
        {CONSTELLATIONS.map((c, i) => (
          <Line
            key={`line-${i}`}
            x1={c.x1}
            y1={c.y1}
            x2={c.x2}
            y2={c.y2}
            stroke="rgba(218, 185, 255, 0.16)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ))}

        {/* Stars */}
        {STARS.map((s, i) => (
          <Circle
            key={`star-${i}`}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={s.color}
            opacity={s.baseOp}
          />
        ))}
      </Svg>
    </Animated.View>
  );
});

ConstellationParticles.displayName = 'ConstellationParticles';

const styles = StyleSheet.create({
  container: {
    width: 320,
    height: 220,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
});
