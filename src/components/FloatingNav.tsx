import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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

const BAR_HEIGHT = 72;
const PILL_INSET = 6;
const PILL_HEIGHT = BAR_HEIGHT - PILL_INSET * 2;

const icons: Record<string, [React.ComponentProps<typeof Ionicons>['name'], React.ComponentProps<typeof Ionicons>['name']]> = {
  index: ['home-outline', 'home'],
  home: ['home-outline', 'home'],
  library: ['musical-notes-outline', 'musical-notes'],
  search: ['search-outline', 'search'],
  settings: ['settings-outline', 'settings'],
};

function FloatingNav({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const metrics = useResponsiveMetrics();
  const reduceMotion = useReducedMotionPreference();
  const tabCount = state.routes.length;
  const tabWidth = metrics.navWidth / tabCount;

  const slideAnim = useRef(new Animated.Value(state.index * tabWidth)).current;
  const glowOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const targetX = state.index * tabWidth;

    if (reduceMotion) {
      slideAnim.setValue(targetX);
      glowOpacity.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: targetX,
        ...motion.spring.nav,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.58,
          duration: motion.duration.instant,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: motion.duration.base,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [glowOpacity, reduceMotion, slideAnim, state.index, tabWidth]);

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

  const pillColors = useMemo(
    () => [palette.primary, palette.primaryMid, palette.primaryDeep] as const,
    []
  );

  const bottom = Math.max(insets.bottom + 12, 24);
  const glowWidth = tabWidth * 1.8;

  return (
    <View pointerEvents="box-none" style={[styles.outer, { bottom }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: glowWidth,
            opacity: glowOpacity,
            transform: [{ translateX: Animated.add(slideAnim, (tabWidth - glowWidth) / 2) }],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', hexToRgba(palette.primary, 0.34), 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[hexToRgba(palette.primary, 0.22), 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <LiquidGlass
        dense
        intensity={glass.navBlur}
        borderRadius={BAR_HEIGHT / 2}
        style={[styles.bar, { width: metrics.navWidth }]}
        contentStyle={styles.barContent}
      >
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePill,
            {
              left: PILL_INSET,
              width: tabWidth - PILL_INSET * 2,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={pillColors}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.pillShine} />
          <View pointerEvents="none" style={styles.pillBorder} />
        </Animated.View>

        {state.routes.map((route: any) => {
          const index = state.routes.indexOf(route);
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = String(options.title ?? route.name);
          const iconPair = icons[route.name.toLowerCase()] ?? ['ellipse-outline', 'ellipse'];
          const iconName = isFocused ? iconPair[1] : iconPair[0];

          return (
            <PressScale
              key={route.key}
              haptic={Haptics.ImpactFeedbackStyle.Light}
              scaleTo={0.92}
              hitSlop={minimumHitSlop}
              accessibilityRole="tab"
              accessibilityLabel={`${label} tab`}
              accessibilityState={{ selected: isFocused }}
              onPress={() => handlePress(route, isFocused)}
              wrapperStyle={[styles.tabWrapper, { width: tabWidth }]}
              style={styles.tabButton}
            >
              <Ionicons
                name={iconName}
                size={isFocused ? 23 : 21}
                color={isFocused ? palette.ink : palette.inkDim}
              />
              <Text
                allowFontScaling
                maxFontSizeMultiplier={1.25}
                numberOfLines={1}
                style={[styles.tabLabel, isFocused && styles.activeTabLabel]}
              >
                {label}
              </Text>
            </PressScale>
          );
        })}
      </LiquidGlass>
    </View>
  );
}

export default memo(FloatingNav);

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  glow: {
    position: 'absolute',
    top: BAR_HEIGHT - 4,
    height: 34,
  },
  bar: {
    height: BAR_HEIGHT,
    boxShadow: '0 16px 34px rgba(0, 0, 0, 0.42)',
  },
  barContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activePill: {
    position: 'absolute',
    top: PILL_INSET,
    height: PILL_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  pillShine: {
    position: 'absolute',
    top: 4,
    left: 18,
    right: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabWrapper: {
    height: BAR_HEIGHT,
  },
  tabButton: {
    minHeight: 48,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    maxWidth: 72,
    color: palette.inkDim,
    fontSize: 10,
    lineHeight: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  activeTabLabel: {
    color: palette.ink,
  },
});
