import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RestoreValidatorService, RestoreNotice } from '../services/restore-validator.service';
import { LiquidGlass } from './ui/liquid-glass';

export function RestoreBanner() {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<RestoreNotice>({
    isRestored: false,
    missingDownloadsCount: 0,
    message: null,
  });

  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const unsubscribe = RestoreValidatorService.subscribe((n) => {
      setNotice(n);
      if (n.message) {
        translateY.value = withSpring(0, { damping: 16, stiffness: 150 });
        opacity.value = withTiming(1, { duration: 250 });
      } else {
        translateY.value = withTiming(-100, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
      }
    });

    return unsubscribe;
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!notice.message) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: Math.max(insets.top, 12) + 8 },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <LiquidGlass style={styles.glass} intensity={30}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-done-outline" size={20} color="#0A84FF" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Library Restored</Text>
            <Text style={styles.message}>{notice.message}</Text>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => RestoreValidatorService.dismissNotice()}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissText}>OK</Text>
          </TouchableOpacity>
        </View>
      </LiquidGlass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  glass: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(20, 20, 25, 0.85)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 15,
  },
  dismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  dismissText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
