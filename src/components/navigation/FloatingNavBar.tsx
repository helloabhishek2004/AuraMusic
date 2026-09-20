/**
 * FloatingNavBar — Apple HIG & Google Photos-inspired Liquid Glass Bottom Navigation
 *
 * Architecture:
 *  - Dual-element floating layout:
 *     1. Primary Navigation Pill (Left): Contains Home, Library, Settings wrapped in React Bits <GlassSurface />
 *        - Vertical layout: Icon above, label below on ALL tabs.
 *        - Selected item illuminated in signature AuraMusic violet.
 *        - No label clipping (Android BoringLayout letterSpacing bug resolved).
 *     2. Separated Search Button (Right): Circular <GlassSurface /> action button for Search.
 *        - Minimalist magnifying glass (star/sparkle removed).
 *        - Turns violet when selected.
 *        - Re-tap triggers search input focus and keyboard appearance.
 *  - Integrated <GlassSurface /> from React Bits:
 *     - Multi-layer frosted liquid glass with native blur, chromatic refraction rim, specular top sheen, and refractive bevel.
 *  - Apple HIG Fluid Spring Physics:
 *     - Smooth active capsule glide with spring physics
 *     - Micro-scale touch-down compression and light haptics
 *     - Re-tap emits `tabPress` for native scroll-to-top and search-focus support
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { palette } from '@/src/design/tokens';
import { FLOATING_BAR_HEIGHT, getFloatingBarBottom } from '@/src/constants/navigation';
import { GlassSurface } from '@/src/components/ui/GlassSurface';

// ─── Constants ───────────────────────────────────────────────────────────────

const SEARCH_BUTTON_SIZE = 54; // Compact circular size to allocate 10% more width to tabs
const ELEMENT_GAP = 10;
const PILL_HORIZONTAL_PADDING = 6;
const PILL_VERTICAL_PADDING = 5;
const ACTIVE_CAPSULE_HEIGHT = FLOATING_BAR_HEIGHT - PILL_VERTICAL_PADDING * 2; // 54dp

interface PrimaryTabConfig {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const PRIMARY_TABS: PrimaryTabConfig[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'library', label: 'Library', icon: 'musical-notes-outline', iconActive: 'musical-notes' },
  { name: 'settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function FloatingNavBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  // Compute immediate stable dimensions with 10% wider container room
  const maxTotalWidth = Math.min(windowWidth - 12, windowWidth >= 720 ? 580 : 520);
  const initialPillWidth = maxTotalWidth - SEARCH_BUTTON_SIZE - ELEMENT_GAP;
  const [pillWidth, setPillWidth] = useState(initialPillWidth);

  // Current active route
  const currentRoute = state.routes[state.index];
  const activeRouteName = currentRoute ? currentRoute.name : 'index';
  const isSearchActive = activeRouteName === 'search';

  // Find index among primary tabs (-1 if on search)
  const activePrimaryIndex = useMemo(() => {
    return PRIMARY_TABS.findIndex((tab) => tab.name === activeRouteName);
  }, [activeRouteName]);

  // Tab width inside pill (immediately defined from initialPillWidth)
  const activeWidth = pillWidth > 0 ? pillWidth : initialPillWidth;
  const tabItemWidth = (activeWidth - PILL_HORIZONTAL_PADDING * 2) / PRIMARY_TABS.length;
  const capsuleWidth = Math.max(0, tabItemWidth - 4);

  // ─── Animations ────────────────────────────────────────────────────────────

  // Entry animation: smooth ease-out from bottom to up (no jiggle/spring)
  const entryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entryAnim]);

  const entryTranslateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [64, 0],
  });

  const entryOpacity = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const slideAnim = useRef(new Animated.Value(activePrimaryIndex >= 0 ? activePrimaryIndex : 0)).current;
  const capsuleOpacity = useRef(new Animated.Value(activePrimaryIndex >= 0 ? 1 : 0)).current;
  const searchActiveAnim = useRef(new Animated.Value(isSearchActive ? 1 : 0)).current;

  // Track sliding capsule and search highlight on route change
  useEffect(() => {
    if (activePrimaryIndex >= 0) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: activePrimaryIndex,
          tension: 280,
          friction: 24,
          useNativeDriver: true,
        }),
        Animated.timing(capsuleOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(searchActiveAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isSearchActive) {
      Animated.parallel([
        Animated.timing(capsuleOpacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.spring(searchActiveAnim, {
          toValue: 1,
          tension: 280,
          friction: 24,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [activePrimaryIndex, isSearchActive, slideAnim, capsuleOpacity, searchActiveAnim]);

  // ─── Navigation Handlers ───────────────────────────────────────────────────

  const handleTabPress = useCallback(
    (routeName: string) => {
      const route = state.routes.find((r) => r.name === routeName);
      if (!route) return;

      const isFocused = activeRouteName === routeName;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (isFocused && routeName === 'search') {
        DeviceEventEmitter.emit('AURA_FOCUS_SEARCH_INPUT');
      }

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate({ name: route.name, params: route.params, merge: true });
      }
    },
    [state.routes, activeRouteName, navigation]
  );

  // Floating elevation from screen bottom
  const bottomPosition = getFloatingBarBottom(insets);

  // Active capsule translation
  const capsuleTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      PILL_HORIZONTAL_PADDING + 2,
      PILL_HORIZONTAL_PADDING + tabItemWidth + 2,
      PILL_HORIZONTAL_PADDING + tabItemWidth * 2 + 2,
    ],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        {
          bottom: bottomPosition,
          opacity: entryOpacity,
          transform: [{ translateY: entryTranslateY }],
        },
      ]}
    >
      <View style={styles.floatingRow}>
        {/* ─── 1. Primary Navigation Pill with <GlassSurface /> ─────────── */}
        <GlassSurface
          height={FLOATING_BAR_HEIGHT}
          borderRadius={999}
          blur={40}
          opacity={0.40}
          style={styles.mainPillGlass}
          contentStyle={styles.mainPillContent}
        >
          <View
            style={StyleSheet.absoluteFill}
            onLayout={(e) => {
              const { width } = e.nativeEvent.layout;
              if (width > 0 && Math.abs(width - pillWidth) > 1) {
                setPillWidth(width);
              }
            }}
            pointerEvents="box-none"
          >
            {/* Layer: Animated Sliding Active Capsule Highlight */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeCapsule,
                {
                  width: capsuleWidth,
                  transform: [{ translateX: capsuleTranslateX }],
                  opacity: capsuleOpacity,
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(191, 90, 242, 0.26)', 'rgba(155, 56, 218, 0.14)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.activeCapsuleBorder} />
            </Animated.View>

            {/* Layer: Primary Tab Items (Vertical Layout on ALL tabs) */}
            <View style={styles.tabItemsRow}>
              {PRIMARY_TABS.map((tab) => {
                const isFocused = activeRouteName === tab.name;
                return (
                  <PrimaryTabButton
                    key={tab.name}
                    tab={tab}
                    isFocused={isFocused}
                    onPress={() => handleTabPress(tab.name)}
                  />
                );
              })}
            </View>
          </View>
        </GlassSurface>

        {/* ─── 2. Separated Search Circle with <GlassSurface /> ─────────── */}
        <SearchCircleButton
          isFocused={isSearchActive}
          activeAnim={searchActiveAnim}
          onPress={() => handleTabPress('search')}
        />
      </View>
    </Animated.View>
  );
}

// ─── Primary Tab Button Component ────────────────────────────────────────────

interface PrimaryTabButtonProps {
  tab: PrimaryTabConfig;
  isFocused: boolean;
  onPress: () => void;
}

const PrimaryTabButton = memo(function PrimaryTabButton({
  tab,
  isFocused,
  onPress,
}: PrimaryTabButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      tension: 300,
      friction: 16,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 280,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={tab.label}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons
          name={isFocused ? tab.iconActive : tab.icon}
          size={22}
          color={isFocused ? palette.primary : 'rgba(240, 235, 250, 0.78)'}
        />
        <Text
          textBreakStrategy="simple"
          style={[
            styles.tabLabel,
            isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
          ]}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

// ─── Separated Search Circle Button ──────────────────────────────────────────

interface SearchCircleButtonProps {
  isFocused: boolean;
  activeAnim: Animated.Value;
  onPress: () => void;
}

const SearchCircleButton = memo(function SearchCircleButton({
  isFocused,
  activeAnim,
  onPress,
}: SearchCircleButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.91,
      tension: 300,
      friction: 16,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 280,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel="Search"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.searchButtonOuter}
    >
      <Animated.View
        style={[
          styles.searchButtonScaleWrapper,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <GlassSurface
          width={SEARCH_BUTTON_SIZE}
          height={SEARCH_BUTTON_SIZE}
          borderRadius={SEARCH_BUTTON_SIZE / 2}
          blur={40}
          opacity={0.40}
          contentStyle={styles.searchButtonContent}
        >
          {/* Active Accent Glow Overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.searchActiveOverlay,
              { opacity: activeAnim },
            ]}
          >
            <LinearGradient
              colors={['rgba(191, 90, 242, 0.32)', 'rgba(155, 56, 218, 0.18)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Clean Magnifying Glass Icon (No Star/Sparkle) */}
          <Ionicons
            name={isFocused ? 'search' : 'search-outline'}
            size={24}
            color={isFocused ? palette.primary : 'rgba(240, 235, 250, 0.82)'}
          />
        </GlassSurface>
      </Animated.View>
    </Pressable>
  );
});

// ─── Stylesheet ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },

  floatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ELEMENT_GAP,
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 6,
  },

  // Main Pill Glass Surface
  mainPillGlass: {
    flex: 1,
    height: FLOATING_BAR_HEIGHT,
  },

  mainPillContent: {
    flex: 1,
  },

  tabItemsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PILL_HORIZONTAL_PADDING,
    paddingVertical: PILL_VERTICAL_PADDING,
  },

  tabButton: {
    flex: 1,
    height: ACTIVE_CAPSULE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },

  // Vertical placement: Icon above, Label below on ALL tabs (10% wider container)
  tabContent: {
    minWidth: 78,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },

  tabLabel: {
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'Inter_500Medium',
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  tabLabelActive: {
    color: palette.primary, // AuraMusic Signature Violet
    fontWeight: '700',
  },

  tabLabelInactive: {
    color: 'rgba(240, 235, 250, 0.78)',
    fontWeight: '600',
  },

  // Active Capsule (sliding)
  activeCapsule: {
    position: 'absolute',
    top: PILL_VERTICAL_PADDING,
    height: ACTIVE_CAPSULE_HEIGHT,
    borderRadius: 999,
    overflow: 'hidden',
  },

  activeCapsuleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(191, 90, 242, 0.45)',
  },

  // Search Button
  searchButtonOuter: {
    width: SEARCH_BUTTON_SIZE,
    height: SEARCH_BUTTON_SIZE,
  },

  searchButtonScaleWrapper: {
    width: SEARCH_BUTTON_SIZE,
    height: SEARCH_BUTTON_SIZE,
    borderRadius: SEARCH_BUTTON_SIZE / 2,
  },

  searchButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchActiveOverlay: {
    borderRadius: SEARCH_BUTTON_SIZE / 2,
    borderWidth: 1.2,
    borderColor: 'rgba(191, 90, 242, 0.55)',
  },
});

export default memo(FloatingNavBar);
