import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dimensions } from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
const isTablet = SCREEN_W >= 768;
const BASE_PAD = isTablet ? 32 : 20;

const MOTION = {
  SLIDE: { tension: 60, friction: 9 },
  POP: { tension: 200, friction: 8 },
};

const C = {
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
  text: "#FFFFFF",
  textMuted: "rgba(170,170,185,0.60)",
};

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const tabSlide = useRef(new Animated.Value(BASE_PAD - 6 + 6)).current;
  const tabWidth = useRef(new Animated.Value(60)).current;
  const tabPillScale = useRef(new Animated.Value(1)).current;
  const initialSet = useRef(false);

  useEffect(() => {
    const activeIndex = categories.indexOf(activeCategory);
    const layout = layouts[activeIndex];
    if (layout) {
      Animated.spring(tabSlide, {
        toValue: layout.x + 6,
        ...MOTION.SLIDE,
        useNativeDriver: false,
      }).start();
      Animated.spring(tabWidth, {
        toValue: layout.width - 12,
        ...MOTION.SLIDE,
        useNativeDriver: false,
      }).start();
    }
  }, [activeCategory, categories, layouts]);

  const handleTabLayout = (idx: number, e: any) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev: any) => ({ ...prev, [idx]: { x, width } }));

    if (idx === 0 && !initialSet.current) {
      tabSlide.setValue(x + 6);
      tabWidth.setValue(width - 12);
      initialSet.current = true;
    }
  };

  const selectTab = useCallback(
    (tab: string, idx: number) => {
      const layout = layouts[idx];
      if (!layout) return;

      onCategoryChange(tab);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(tabPillScale, {
            toValue: 0.88,
            duration: 80,
            useNativeDriver: false,
          }),
          Animated.spring(tabPillScale, {
            toValue: 1,
            ...MOTION.POP,
            useNativeDriver: false,
          }),
        ]),
        Animated.spring(tabSlide, {
          toValue: layout.x + 6,
          ...MOTION.SLIDE,
          useNativeDriver: false,
        }),
        Animated.spring(tabWidth, {
          toValue: layout.width - 12,
          ...MOTION.SLIDE,
          useNativeDriver: false,
        }),
      ]).start();
    },
    [layouts, onCategoryChange]
  );

  return (
    <View style={styles.tabBarOuter}>
      <View style={styles.tabBarTopEdge} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScroll}
      >
        <Animated.View
          style={[
            styles.tabActivePill,
            {
              width: tabWidth,
              transform: [
                { translateX: tabSlide },
                { scale: tabPillScale },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[C.primary, C.primaryMid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.pillSpecTop} />
          <View style={styles.pillSpecLeft} />
        </Animated.View>

        {categories.map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            onLayout={(e) => handleTabLayout(idx, e)}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              selectTab(tab, idx);
            }}
            style={[
              styles.tabItem,
              { paddingHorizontal: isTablet ? 28 : 20 },
            ]}
            activeOpacity={1}
          >
            <Text
              style={[
                styles.tabText,
                activeCategory === tab && styles.tabTextActive,
              ]}
            >
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.tabBarBottomEdge} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    height: 54,
    overflow: "hidden",
    backgroundColor: "rgba(14,14,18,0.5)",
    marginBottom: 16,
    borderRadius: 14,
  },
  tabBarTopEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.10)",
    zIndex: 10,
  },
  tabBarBottomEdge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.07)",
    zIndex: 10,
  },
  tabScroll: {
    paddingHorizontal: BASE_PAD - 6,
    alignItems: "center",
    flexDirection: "row",
    height: 54,
    position: "relative",
  },
  tabActivePill: {
    position: "absolute",
    height: 36,
    borderRadius: 18,
    top: 9,
    left: 0,
    overflow: "hidden",
    zIndex: 0,
  },
  pillSpecTop: {
    position: "absolute",
    top: 2,
    left: 12,
    right: 12,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  pillSpecLeft: {
    position: "absolute",
    left: 8,
    top: 5,
    bottom: 5,
    width: 20,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    transform: [{ skewX: "-8deg" }],
  },
  tabItem: {
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  tabText: {
    fontSize: isTablet ? 13 : 12,
    fontWeight: "600",
    color: C.textMuted,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  tabTextActive: { color: C.text, fontWeight: "700" },
});