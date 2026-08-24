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
  width?: number | string;
  height?: number | string;
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
 * GlassSurface — Authentic Apple-inspired iOS Liquid Glass Surface
 *
 * Provides a pure, clean, ultra-translucent frosted glass finish with:
 *  - Native backdrop blur on iOS / smooth deep frost on Android
 *  - Delicate 1.2px specular top highlight line (liquid edge reflection)
 *  - Subtle vertical luminosity gradient (specular to ambient depth)
 *  - Razor-thin glass perimeter bevel
 *  - Zero muddy colored overlays or edge distortion artifacts
 */
function GlassSurfaceComponent({
  children,
  width = 200,
  height = 80,
  borderRadius = 24,
  borderWidth = 0.75,
  brightness = 50,
  opacity = 0.85,
  blur = 60,
  backgroundOpacity = 0,
  className = '',
  style = {},
  contentStyle,
  pointerEvents,
}: GlassSurfaceProps) {
  const isIOS = Platform.OS === 'ios';

  const containerWidth: DimensionValue =
    typeof width === 'number' ? width : (width as DimensionValue);
  const containerHeight: DimensionValue =
    typeof height === 'number' ? height : (height as DimensionValue);

  // Clean, dark glass translucency
  const frostAlpha = backgroundOpacity > 0 ? backgroundOpacity : Math.min(0.92, Math.max(0.70, opacity));
  const baseBackgroundColor = isIOS
    ? `rgba(20, 18, 28, ${Math.max(0.55, frostAlpha * 0.75)})`
    : `rgba(18, 16, 25, ${frostAlpha})`;

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.container,
        {
          width: containerWidth,
          height: containerHeight,
          borderRadius,
        },
        style,
      ]}
    >
      {/* ── Layer 1: Native Backdrop Blur (iOS) ──────────────────────────── */}
      {isIOS && (
        <BlurView
          intensity={Math.max(40, blur)}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
        />
      )}

      {/* ── Layer 2: Pristine Liquid Glass Base ───────────────────────────── */}
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

      {/* ── Layer 3: Subtle Vertical Luminosity (Clean Liquid Sheen) ─────── */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.09)',
          'rgba(255, 255, 255, 0.02)',
          'rgba(0, 0, 0, 0.15)',
        ]}
        start={{ x: 0.5, y: 0.0 }}
        end={{ x: 0.5, y: 1.0 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* ── Layer 4: Delicate Top-Edge Specular Catch-Light ───────────────── */}
      <View
        pointerEvents="none"
        style={[
          styles.specularCatchLine,
          {
            borderRadius: borderRadius / 2,
            left: '12%',
            right: '12%',
          },
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.00)',
            'rgba(255, 255, 255, 0.38)',
            'rgba(255, 255, 255, 0.00)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* ── Layer 5: Refractive Perimeter Glass Border ────────────────────── */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderWidth,
            borderTopColor: 'rgba(255, 255, 255, 0.22)',
            borderLeftColor: 'rgba(255, 255, 255, 0.07)',
            borderRightColor: 'rgba(255, 255, 255, 0.07)',
            borderBottomColor: 'rgba(255, 255, 255, 0.03)',
            backgroundColor: 'transparent',
          },
        ]}
      />

      {/* ── Content Slot ─────────────────────────────────────────────────── */}
      <View style={[StyleSheet.absoluteFill, styles.content, contentStyle]}>
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
    // Apple-style atmospheric floating drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.40,
    shadowRadius: 28,
    elevation: 20,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
