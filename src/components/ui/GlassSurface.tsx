import React, { memo } from 'react';
import {
  DimensionValue,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: 'R' | 'G' | 'B';
  yChannel?: 'R' | 'G' | 'B';
  mixBlendMode?: BlendMode | string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

/**
 * GlassSurface — Authentic React Bits Liquid Glass Surface
 *
 * Implements the React Bits Liquid Glass aesthetic for React Native:
 *  - High-translucency frosted base allowing background content to blur through
 *  - Multi-layer chromatic refraction simulation (delicate iridescent edge bevel)
 *  - Specular top highlight line (liquid edge reflection)
 *  - Vertical light refraction gradient
 *  - Floating atmospheric drop shadow
 */
function GlassSurfaceComponent({
  children,
  width,
  height,
  borderRadius = 24,
  borderWidth = 1,
  opacity = 0.40,
  blur = 40,
  backgroundOpacity = 0,
  style = {},
  contentStyle,
  pointerEvents,
}: GlassSurfaceProps) {
  const isIOS = Platform.OS === 'ios';

  // Natural dark tint translucency (deep obsidian liquid glass, no washed-out white)
  const frostAlpha = backgroundOpacity > 0 ? backgroundOpacity : Math.min(0.70, Math.max(0.35, opacity));
  const baseBackgroundColor = `rgba(16, 12, 24, ${frostAlpha})`;

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.container,
        {
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
          borderRadius,
        },
        style,
      ]}
    >
      {/* ── Layer 1: Native Backdrop Blur (iOS & Android) — 40% Blur ─────────── */}
      <BlurView
        intensity={blur}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
      />

      {/* ── Layer 2: Deep Translucent Dark Glass Base ────────────────────────── */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            backgroundColor: baseBackgroundColor,
          },
        ]}
      />

      {/* ── Layer 3: Smooth Natural Dark Tint Gradient (No washed out white) ── */}
      <LinearGradient
        colors={[
          'rgba(28, 22, 42, 0.72)',
          'rgba(14, 11, 22, 0.88)',
        ]}
        start={{ x: 0.5, y: 0.0 }}
        end={{ x: 0.5, y: 1.0 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* ── Layer 4: Subtle Dark Ambient Violet Accent Rim ─────────────────── */}
      <LinearGradient
        colors={[
          'rgba(191, 90, 242, 0.10)',
          'transparent',
        ]}
        start={{ x: 0.0, y: 0.0 }}
        end={{ x: 1.0, y: 1.0 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* ── Layer 5: Smooth Dark Refractive Glass Border ────────────────────── */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderWidth,
            borderTopColor: 'rgba(191, 90, 242, 0.22)',
            borderLeftColor: 'rgba(255, 255, 255, 0.08)',
            borderRightColor: 'rgba(255, 255, 255, 0.08)',
            borderBottomColor: 'rgba(0, 0, 0, 0.55)',
            backgroundColor: 'transparent',
          },
        ]}
      />

      {/* ── Content Slot ───────────────────────────────────────────────────── */}
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

export const GlassSurface = memo(GlassSurfaceComponent);
export default GlassSurface;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    // Apple / React Bits liquid floating drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.50,
    shadowRadius: 24,
    elevation: 18,
  },
  specularCatchLine: {
    position: 'absolute',
    top: 0.5,
    height: 1.2,
    overflow: 'hidden',
  },
  content: {
    width: '100%',
    height: '100%',
  },
});
