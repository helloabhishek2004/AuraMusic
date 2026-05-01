import React, { memo } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, palette, radius } from '@/src/design/tokens';
import { hexToRgba } from '@/src/utils/color';

type LiquidGlassProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial';
  accentColor?: string;
  accentOpacity?: number;
  dense?: boolean;
  gradient?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

function getBlurIntensity(intensity: number) {
  return Platform.OS === 'android'
    ? Math.min(intensity, glass.androidBlurLimit)
    : intensity;
}

function LiquidGlassComponent({
  children,
  style,
  contentStyle,
  borderRadius = radius.lg,
  intensity = glass.surfaceBlur,
  tint = 'dark',
  accentColor = palette.primary,
  accentOpacity = 0,
  dense = false,
  gradient = false,
  pointerEvents,
}: LiquidGlassProps) {
  const backgroundColor = dense ? palette.glassDense : palette.glass;

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.shell,
        {
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    >
      <BlurView intensity={getBlurIntensity(intensity)} tint={tint} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius, backgroundColor }]} />

      {accentOpacity > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius,
              backgroundColor: hexToRgba(accentColor, accentOpacity),
            },
          ]}
        />
      )}

      {gradient && (
        <LinearGradient
          pointerEvents="none"
          colors={[hexToRgba(accentColor, 0.16), 'rgba(255,255,255,0.03)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius }]}
        />
      )}

      <View
        pointerEvents="none"
        style={[
          styles.topEdge,
          {
            left: borderRadius * 0.45,
            right: borderRadius * 0.45,
          },
        ]}
      />
      <View pointerEvents="none" style={styles.leftEdge} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderColor: palette.border,
          },
          styles.refraction,
        ]}
      />

      <View style={contentStyle}>{children}</View>
    </View>
  );
}

export const LiquidGlass = memo(LiquidGlassComponent);

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    height: 1.5,
    backgroundColor: palette.edge,
    zIndex: 4,
  },
  leftEdge: {
    position: 'absolute',
    left: 7,
    top: 10,
    bottom: 10,
    width: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ skewX: '-7deg' }],
    zIndex: 4,
  },
  refraction: {
    borderWidth: 1,
    backgroundColor: palette.glassSoft,
  },
});
