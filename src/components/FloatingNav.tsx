import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const BAR_MARGIN = 16;
const BAR_WIDTH = width - BAR_MARGIN * 2;
const BAR_HEIGHT = 76;
const PILL_VERTICAL_PADDING = 6;
const PILL_HEIGHT = BAR_HEIGHT - PILL_VERTICAL_PADDING * 2;

export default function FloatingNav({ state, descriptors, navigation }: any) {
  const tabCount = state.routes.length;
  const tabWidth = BAR_WIDTH / tabCount;

  const slideAnim = useRef(new Animated.Value(state.index * tabWidth)).current;
  const scaleAnims = useRef(
    state.routes.map(() => new Animated.Value(1))
  ).current;
  const glowOpacity = useRef(new Animated.Value(1)).current;

  // Glow X centre — tracks the active pill horizontally
  const glowX = useRef(
    new Animated.Value(state.index * tabWidth + tabWidth / 2)
  ).current;

  useEffect(() => {
    const targetX = state.index * tabWidth + tabWidth / 2;

    Animated.spring(slideAnim, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();

    // Glow centre follows the pill
    Animated.spring(glowX, {
      toValue: targetX,
      useNativeDriver: false, // layout prop — can't use native driver
      tension: 55,
      friction: 10,
    }).start();

    // Pulse in on tab change
    glowOpacity.setValue(0.25);
    Animated.timing(glowOpacity, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [state.index]);

  const handlePress = (route: any, index: number, isFocused: boolean) => {
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate({ name: route.name, merge: true });
    }
  };

  const getIcon = (name: string, focused: boolean): any => {
    switch (name.toLowerCase()) {
      case 'index':
      case 'home': return focused ? 'home' : 'home-outline';
      case 'browse': return focused ? 'compass' : 'compass-outline';
      case 'library': return focused ? 'musical-notes' : 'musical-notes-outline';
      case 'search': return focused ? 'search' : 'search-outline';
      case 'settings': return focused ? 'settings' : 'settings-outline';
      default: return focused ? 'ellipse' : 'ellipse-outline';
    }
  };

  const getLabel = (name: string, options: any): string => {
    if (options.title) return options.title.toUpperCase();
    return name.toUpperCase();
  };

  // Glow dimensions
  const GLOW_W_OUTER = tabWidth * 1.8;
  const GLOW_W_INNER = tabWidth * 1.0;
  const glowLeftOuter = Animated.subtract(glowX, GLOW_W_OUTER / 2);
  const glowLeftInner = Animated.subtract(glowX, GLOW_W_INNER / 2);

  return (
    // Wrapper must NOT clip so the glow can bleed below the bar
    <View style={styles.outerWrapper}>

      {/* ─────────────────────────────────────────────────────────────────────
          AMBIENT GLOW  — pure gradients, zero solid background colour.
          Two layers: a wide soft bloom + a tight bright core, both fading
          to 'transparent' on every edge so there is NO visible shape.
      ───────────────────────────────────────────────────────────────────── */}

      {/* Layer 1 — wide outer bloom */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowOuter,
          { width: GLOW_W_OUTER, opacity: glowOpacity, left: glowLeftOuter },
        ]}
      >
        {/* Horizontal fade: transparent → purple → transparent */}
        <LinearGradient
          colors={['transparent', 'rgba(155, 56, 218, 0.20)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Vertical fade: purple at top (touching bar), fully transparent at bottom */}
        <LinearGradient
          colors={['rgba(155, 56, 218, 0.15)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Layer 2 — tight bright core */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowInner,
          { width: GLOW_W_INNER, opacity: glowOpacity, left: glowLeftInner },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(191, 90, 242, 0.30)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(191, 90, 242, 0.22)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Main pill bar ── */}
      <View style={styles.barContainer}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.topEdgeHighlight} />

        {/* ── Sliding active pill ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePillWrapper,
            {
              width: tabWidth - 10,
              transform: [
                { translateX: Animated.add(slideAnim, new Animated.Value(5)) },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#BF5AF2', '#9B38DA', '#7B2FBE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            style={styles.activePillGradient}
          />
          <View style={styles.pillSpecularLeft} />
          <View style={styles.pillSpecularTop} />
          <View style={styles.pillRefractionOverlay} />
        </Animated.View>

        {/* ── Tab buttons ── */}
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = getLabel(route.name, options);
          const iconName = getIcon(route.name, isFocused);

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => handlePress(route, index, isFocused)}
              activeOpacity={1}
              style={[styles.tabItem, { width: tabWidth }]}
            >
              <Animated.View
                style={[
                  styles.tabContent,
                  { transform: [{ scale: scaleAnims[index] }] },
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={isFocused ? 24 : 21}
                  color={
                    isFocused
                      ? '#FFFFFF'
                      : 'rgba(180, 180, 195, 0.65)'
                  }
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isFocused
                      ? styles.activeTabLabel
                      : styles.inactiveTabLabel,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // outerWrapper must NOT use overflow:hidden — the glow needs to escape below
  outerWrapper: {
    position: 'absolute',
    bottom: 28,
    left: BAR_MARGIN,
    right: BAR_MARGIN,
  },

  // ── Glow layers ────────────────────────────────────────────────────────────
  // Positioned BELOW the bar (top = BAR_HEIGHT), so they bleed downward only.
  // No backgroundColor — colour comes entirely from LinearGradient.
  glowOuter: {
    position: 'absolute',
    top: BAR_HEIGHT - 4,   // slightly overlap the bar bottom for seamless bleed
    height: 32,
    // no backgroundColor — intentional
  },

  glowInner: {
    position: 'absolute',
    top: BAR_HEIGHT - 2,
    height: 20,
    // no backgroundColor — intentional
  },

  // ── Bar ───────────────────────────────────────────────────────────────────
  barContainer: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 18, 22, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
      },
      android: { elevation: 18 },
    }),
  },

  topEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: BAR_HEIGHT / 2,
    right: BAR_HEIGHT / 2,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    zIndex: 10,
  },

  // ── Active pill ───────────────────────────────────────────────────────────
  activePillWrapper: {
    position: 'absolute',
    top: PILL_VERTICAL_PADDING,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    zIndex: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#9B38DA',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
    }),
  },

  activePillGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_HEIGHT / 2,
  },

  pillSpecularLeft: {
    position: 'absolute',
    left: 10,
    top: 5,
    width: 32,
    height: PILL_HEIGHT - 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    transform: [{ skewX: '-8deg' }],
  },

  pillSpecularTop: {
    position: 'absolute',
    top: 3,
    left: 16,
    right: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
  },

  pillRefractionOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabItem: {
    height: BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },

  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },

  tabLabel: {
    fontSize: 9.5,
    letterSpacing: 0.6,
    fontWeight: '600',
  },

  activeTabLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },

  inactiveTabLabel: {
    color: 'rgba(170, 170, 185, 0.6)',
  },
});