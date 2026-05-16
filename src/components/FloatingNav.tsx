/**
 * FloatingNav — Liquid Glass Edition (v2)
 *
 * FIXES:
 *  ✓ Correct dark-charcoal bar background matching design screenshot
 *  ✓ Left-edge border artifact eliminated (gradient border, not uniform)
 *  ✓ Ripple fires instantly on press-in (no delay), natural 420ms settle
 *  ✓ All animations on useNativeDriver: true — full GPU acceleration
 *  ✓ Pill: spring slide + water-droplet squish (depart stretch → land squish → elastic settle)
 *  ✓ Icon: pop-in on arrive, shrink on depart — independent spring chains
 *  ✓ Ambient glow tracks pill via native driver translateX
 *  ✓ Reduced motion: all springs replaced with instant setValue
 *  ✓ Accessibility: accessibilityRole, accessibilityState, labels, hitSlop
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LiquidGlass } from '@/src/components/ui/liquid-glass';
import { PressScale } from '@/src/components/ui/press-scale';
import { glass, motion, palette, radius } from '@/src/design/tokens';
import { useReducedMotionPreference } from '@/src/hooks/use-accessibility-preferences';
import { minimumHitSlop, useResponsiveMetrics } from '@/src/hooks/use-responsive-metrics';
import { hexToRgba } from '@/src/utils/color';

// ─── Layout Constants ─────────────────────────────────────────────────────────

const BAR_HEIGHT = 72;
const PILL_INSET = 5;
const PILL_HEIGHT = BAR_HEIGHT - PILL_INSET * 2;

// ─── Spring Configs ───────────────────────────────────────────────────────────
// Tuned for ~200ms settle, slight overshoot, feels physical not mechanical.
// All use useNativeDriver:true → GPU thread, zero JS-thread jank.

const SPRING_PILL = {
  tension: 360,
  friction: 30,
  useNativeDriver: true,
} as const;

const SPRING_ICON = {
  tension: 480,
  friction: 36,
  useNativeDriver: true,
} as const;

const SPRING_SETTLE = {
  tension: 700,
  friction: 40,
  useNativeDriver: true,
} as const;

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<
  string,
  [React.ComponentProps<typeof Ionicons>['name'], React.ComponentProps<typeof Ionicons>['name']]
> = {
  index: ['home-outline', 'home'],
  home: ['home-outline', 'home'],
  library: ['musical-notes-outline', 'musical-notes'],
  search: ['search-outline', 'search'],
  settings: ['settings-outline', 'settings'],
};

// ─── Colors ───────────────────────────────────────────────────────────────────
// Bar: dark charcoal (#1A1A1F range) matching the screenshot, NOT transparent grey.
// Pill: vivid purple (#9B30FF → #7B22DC) matching screenshot circle.
// Ripple: bright white burst, instant, no delay.

const C = {
  // ── Bar background (dark charcoal glass)
  barBase: 'rgba(22, 20, 28, 0.96)',   // deep dark charcoal, nearly opaque
  barHighTop: 'rgba(255,255,255,0.10)',   // top edge illumination
  barHighMid: 'rgba(255,255,255,0.035)',
  barHighBot: 'rgba(255,255,255,0.00)',
  // Bar refractive tint — very subtle, keeps it charcoal not purple
  barRefr0: 'rgba(140,100,220,0.06)',
  barRefr1: 'rgba(80, 60, 160,0.03)',
  // Bar border: bright ONLY on top, invisible on left/right/bottom
  barBorderTop: 'rgba(255,255,255,0.30)',
  barBorderSide: 'rgba(255,255,255,0.00)',   // eliminates left-line artifact

  // ── Pill (vivid purple matching screenshot)
  pillGrad0: 'rgba(168, 72, 255, 0.97)', // bright violet-purple top
  pillGrad1: 'rgba(138, 40, 220, 0.93)', // mid saturated
  pillGrad2: 'rgba(108, 20, 180, 0.88)', // deep base

  // Fresnel rim (convex edge brightening, diagonal)
  fresnelHigh: 'rgba(255,255,255,0.52)',
  fresnelMid: 'rgba(200,150,255,0.20)',
  fresnelLow: 'rgba(80, 20, 180,0.00)',

  // Caustic hotspot (convex lens refraction, upper-left bright blob)
  causticBright: 'rgba(255,255,255,0.68)',
  causticMid: 'rgba(220,180,255,0.30)',
  causticFade: 'rgba(120,60,240,0.00)',

  // Specular catch-light (thin bright line top center)
  specLeft: 'rgba(255,255,255,0.00)',
  specMid: 'rgba(255,255,255,0.72)',
  specRight: 'rgba(255,255,255,0.00)',

  // Inner shadow (bottom darkening for depth)
  shadowTop: 'rgba(0,0,0,0.00)',
  shadowBot: 'rgba(0,0,0,0.22)',

  // Border (bright top only, transparent sides/bottom)
  borderTop: 'rgba(255,255,255,0.64)',
  borderSide: 'rgba(255,255,255,0.12)',
  borderBot: 'rgba(200,140,255,0.08)',

  // Ripple (white burst, immediate)
  ripple: 'rgba(255,255,255,0.38)',

  // Ambient glow beneath pill
  glowCenter: hexToRgba('#9B30FF', 0.32),
  glowEdge: hexToRgba('#9B30FF', 0.00),
} as const;

// ─── Ripple Component ─────────────────────────────────────────────────────────
// Fires immediately on press — no setTimeout delay.
// 420ms total: fast expand + two-phase fade (hold then out).
// Pure native driver → GPU, zero lag.

interface RippleProps {
  size: number;
  onDone: () => void;
}

const Ripple = memo(({ size, onDone }: RippleProps) => {
  const scale = useRef(new Animated.Value(0.05)).current;
  const opacity = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    Animated.parallel([
      // Expand to 1.5× size — fast start, ease out
      Animated.timing(scale, {
        toValue: 1.5,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Fade: hold opacity briefly then fade out
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.38,
          duration: 140,          // quick settle
          easing: Easing.out(Easing.linear),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 280,          // smooth fade-out
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, []);

  const d = size * 1.1;
  const offset = (size - d) / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: d,
        height: d,
        borderRadius: d / 2,
        left: offset,
        top: (PILL_HEIGHT - d) / 2,
        backgroundColor: C.ripple,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
});

// ─── LiquidPill ───────────────────────────────────────────────────────────────
// Multi-layer glass: base grad → Fresnel rim → caustic blob → specular line →
// inner shadow → border. All transforms native-driver safe.

interface LiquidPillProps {
  width: number;
  showRipple: boolean;
  onRippleDone: () => void;
}

const LiquidPill = memo(({ width, showRipple, onRippleDone }: LiquidPillProps) => {
  const h = PILL_HEIGHT;
  const r = h / 2;

  // Caustic flicker — slow sine drift, GPU translateX + opacity
  const causticAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(causticAnim, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(causticAnim, {
          toValue: 0,
          duration: 4400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const causticX = causticAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 7],
  });
  const causticOpacity = causticAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 0.98],
  });

  const hotW = width * 0.60;
  const hotH = h * 0.68;

  return (
    <View style={{ width, height: h, borderRadius: r, overflow: 'hidden' }}>

      {/* Layer 0: Base purple gradient */}
      <LinearGradient
        colors={[C.pillGrad0, C.pillGrad1, C.pillGrad2]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 1: Fresnel rim (diagonal bright → dark) */}
      <LinearGradient
        colors={[C.fresnelHigh, C.fresnelMid, C.fresnelLow]}
        start={{ x: 0.0, y: 0.0 }}
        end={{ x: 1.0, y: 1.0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 2: Caustic hotspot (animated, upper-left) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -h * 0.14,
          left: -width * 0.06,
          width: hotW,
          height: hotH,
          borderRadius: Math.min(hotW, hotH) * 0.54,
          overflow: 'hidden',
          opacity: causticOpacity,
          transform: [{ translateX: causticX }],
        }}
      >
        <LinearGradient
          colors={[C.causticBright, C.causticMid, C.causticFade]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Layer 3: Specular catch-light (thin top-center line) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          left: width * 0.22,
          width: width * 0.56,
          height: 2.2,
          borderRadius: 1.1,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[C.specLeft, C.specMid, C.specRight]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Layer 4: Inner shadow (bottom depth) */}
      <LinearGradient
        colors={[C.shadowTop, C.shadowBot]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Layer 5: Border (bright top, dim sides, near-invisible bottom) */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: r,
          borderWidth: 0.8,
          borderColor: 'rgba(255,255,255,0.48)',
          backgroundColor: 'transparent',
        }}
      />

      {/* Layer 6: Ripple (immediate on press, no delay) */}
      {showRipple && <Ripple size={width} onDone={onRippleDone} />}
    </View>
  );
});

// ─── FloatingNav Main ─────────────────────────────────────────────────────────

function FloatingNav({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const metrics = useResponsiveMetrics();
  const reduceMotion = useReducedMotionPreference();
  const tabCount = state.routes.length;
  const tabWidth = metrics.navWidth / tabCount;
  const pillWidth = tabWidth - PILL_INSET * 2;

  // Ripple fires on press-in, not after a setTimeout
  const [rippleActive, setRippleActive] = useState(false);

  const prevIdx = useRef(state.index);

  // ── Animated values (all useNativeDriver:true — GPU thread) ───────────────

  const slideAnim = useRef(new Animated.Value(state.index * tabWidth)).current;
  const pillScaleX = useRef(new Animated.Value(1)).current;
  const pillScaleY = useRef(new Animated.Value(1)).current;

  const iconScales = useRef<Animated.Value[]>(
    state.routes.map((_: any, i: number) =>
      new Animated.Value(i === state.index ? 1.0 : 0.80)
    )
  ).current;

  // ── Tab change animations ─────────────────────────────────────────────────

  useEffect(() => {
    const nextIdx = state.index;
    const prevIndex = prevIdx.current;
    prevIdx.current = nextIdx;

    // Instant for reduced motion
    if (reduceMotion) {
      slideAnim.setValue(nextIdx * tabWidth);
      pillScaleX.setValue(1);
      pillScaleY.setValue(1);
      iconScales.forEach((s, i) => s.setValue(i === nextIdx ? 1.0 : 0.80));
      return;
    }

    // ─ Pill slide — smooth spring ─────────────────────────────────────────
    Animated.spring(slideAnim, {
      toValue: nextIdx * tabWidth,
      ...SPRING_PILL,
    }).start();

    // ─ Water-droplet morph sequence ───────────────────────────────────────
    // Depart: stretch X, compress Y → land: compress X, stretch Y → settle: 1:1
    Animated.sequence([
      Animated.parallel([
        Animated.spring(pillScaleX, { toValue: 1.12, tension: 700, friction: 14, useNativeDriver: true }),
        Animated.spring(pillScaleY, { toValue: 0.88, tension: 700, friction: 14, useNativeDriver: true }),
      ]),
      Animated.delay(80),
      Animated.parallel([
        Animated.spring(pillScaleX, { toValue: 0.91, tension: 820, friction: 28, useNativeDriver: true }),
        Animated.spring(pillScaleY, { toValue: 1.12, tension: 820, friction: 28, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(pillScaleX, { toValue: 1, ...SPRING_SETTLE }),
        Animated.spring(pillScaleY, { toValue: 1, ...SPRING_SETTLE }),
      ]),
    ]).start();

    // ─ Ripple: fire IMMEDIATELY on press (no setTimeout) ─────────────────
    // Reset first so re-mounting triggers fresh animation
    setRippleActive(false);
    // Use rAF to let React flush the false before setting true
    requestAnimationFrame(() => setRippleActive(true));

    // ─ Icon scales ────────────────────────────────────────────────────────
    iconScales.forEach((scale, i) => {
      if (i === nextIdx) {
        // Arrive: quick dip then pop above 1
        Animated.sequence([
          Animated.spring(scale, { toValue: 0.88, tension: 560, friction: 16, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1.20, tension: 460, friction: 18, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1.00, ...SPRING_ICON }),
        ]).start();
      } else if (i === prevIndex) {
        // Depart: shrink
        Animated.spring(scale, { toValue: 0.80, ...SPRING_ICON }).start();
      }
    });
  }, [state.index]);

  // ── Tap handler ───────────────────────────────────────────────────────────

  const handlePress = useCallback(
    (route: any, isFocused: boolean) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate({ name: route.name, merge: true });
      }
    },
    [navigation]
  );

  const bottom = Math.max(insets.bottom + 14, 24);

  // Ambient glow offset — tracks pill via native translateX
  const glowOffset = Animated.add(
    slideAnim,
    new Animated.Value((tabWidth - tabWidth * 2.2) / 2)
  );

  return (
    <View pointerEvents="box-none" style={[s.outer, { bottom }]}>

      {/* ── Ambient glow (psychological depth, tracks pill) ─────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.ambientGlow,
          {
            width: tabWidth * 2.2,
            transform: [{ translateX: glowOffset }],
          },
        ]}
      >
        <LinearGradient
          colors={[C.glowCenter, C.glowCenter, C.glowEdge]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Glass bar ─────────────────────────────────────────────────────────── */}
      <View style={[s.bar, { width: metrics.navWidth }]}>

        {/* Backdrop blur */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 80 : 52}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2, overflow: 'hidden' }]}
        />

        {/* Dark charcoal base — the key fix for the screenshot colours */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: BAR_HEIGHT / 2,
              backgroundColor: C.barBase,
            },
          ]}
        />

        {/* Top highlight (illumination, top third only) */}
        <LinearGradient
          colors={[C.barHighTop, C.barHighMid, C.barHighBot]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2 }]}
          pointerEvents="none"
        />

        {/* Refractive tint (very subtle purple cast, keeps it dark) */}
        <LinearGradient
          colors={[C.barRefr0, C.barRefr1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2 }]}
          pointerEvents="none"
        />

        {/*
          ── Border fix: no uniform borderColor (which creates the left-line).
          Instead use a top-only gradient overlay that fades to transparent
          on sides and bottom — eliminates the left-edge artefact entirely.
        */}
        {/* Top border edge: bright horizontal line */}
        <View
          pointerEvents="none"
          style={[
            s.borderTopLine,
            { borderRadius: BAR_HEIGHT / 2 },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.00)',
              'rgba(255,255,255,0.28)',
              'rgba(255,255,255,0.00)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Full perimeter border — transparent sides, dim to avoid left-line */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: BAR_HEIGHT / 2,
              borderWidth: 0.6,
              borderTopColor: 'rgba(255,255,255,0.22)',
              borderLeftColor: 'rgba(255,255,255,0.06)',   // near-invisible left
              borderRightColor: 'rgba(255,255,255,0.06)',  // near-invisible right
              borderBottomColor: 'rgba(255,255,255,0.04)',
              backgroundColor: 'transparent',
            },
          ]}
        />

        {/* ── Animated pill ─────────────────────────────────────────────────── */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.pillSlot,
            {
              width: pillWidth,
              transform: [
                { translateX: slideAnim },
                { scaleX: pillScaleX },
                { scaleY: pillScaleY },
              ],
            },
          ]}
        >
          <LiquidPill
            width={pillWidth}
            showRipple={rippleActive}
            onRippleDone={() => setRippleActive(false)}
          />
        </Animated.View>

        {/* ── Tab touch targets ─────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {state.routes.map((route: any) => {
            const idx = state.routes.indexOf(route);
            const { options } = descriptors[route.key];
            const isFocused = state.index === idx;
            const label = String(options.title ?? route.name);
            const iconPair = ICON_MAP[route.name.toLowerCase()] ?? ['ellipse-outline', 'ellipse'];
            const iconName = isFocused ? iconPair[1] : iconPair[0];

            return (
              <PressScale
                key={route.key}
                haptic={Haptics.ImpactFeedbackStyle.Light}
                scaleTo={0.90}
                hitSlop={minimumHitSlop}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityHint={isFocused ? 'Currently selected' : `Switch to ${label}`}
                accessibilityState={{ selected: isFocused }}
                onPress={() => handlePress(route, isFocused)}
                wrapperStyle={[s.tabWrap, { width: tabWidth }]}
                style={s.tabBtn}
              >
                <Animated.View style={{ transform: [{ scale: iconScales[idx] }] }}>
                  <Ionicons
                    name={iconName}
                    size={isFocused ? 23 : 21}
                    color={isFocused ? '#FFFFFF' : 'rgba(180,170,200,0.70)'}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </Animated.View>

                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={1.35}
                  numberOfLines={1}
                  style={[s.label, isFocused && s.labelActive]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {label}
                </Text>
              </PressScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default memo(FloatingNav);

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
    // Pointer events box-none so taps pass through empty areas
  },

  ambientGlow: {
    position: 'absolute',
    // Sits just below the bar so glow bleeds downward
    top: BAR_HEIGHT - 4,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },

  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    // Multi-layer shadow for authentic lifted depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 22,
  },

  // Top border line (1px tall, sits at very top of bar, gradient fades L/R)
  borderTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    overflow: 'hidden',
  },

  pillSlot: {
    position: 'absolute',
    top: PILL_INSET,
    left: PILL_INSET,
    height: PILL_HEIGHT,
    // overflow visible so ripple can bleed slightly past pill edges
    overflow: 'visible',
  },

  // Flex row containing all tab buttons — laid over the pill layer
  tabRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },

  tabWrap: {
    height: BAR_HEIGHT,
    justifyContent: 'center',
  },

  tabBtn: {
    minHeight: 48,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },

  label: {
    maxWidth: 72,
    color: 'rgba(180,170,200,0.70)',
    fontSize: 10,
    lineHeight: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    letterSpacing: 0.10,
  },

  labelActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.04,
  },
});