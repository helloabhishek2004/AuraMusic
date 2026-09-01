import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStore } from '../store/network.store';
import { LiquidGlass } from '@/src/components/ui/liquid-glass';
import { palette, radius, typography } from '@/src/design/tokens';

export function OfflineStatusBar() {
  const insets = useSafeAreaInsets();
  const isOffline = useNetworkStore((s) => s.isOffline);
  const status = useNetworkStore((s) => s.status);
  
  const [showRestored, setShowRestored] = useState(false);
  const prevOfflineRef = useRef(false);
  const animProgress = useSharedValue(0);

  useEffect(() => {
    if (isOffline) {
      prevOfflineRef.current = true;
      setShowRestored(false);
      animProgress.value = withSpring(1, { damping: 18, stiffness: 180 });
    } else {
      if (prevOfflineRef.current && status === 'online') {
        // Just transitioned from offline to online
        prevOfflineRef.current = false;
        setShowRestored(true);
        animProgress.value = withSpring(1, { damping: 18, stiffness: 180 });

        const timer = setTimeout(() => {
          animProgress.value = withTiming(0, { duration: 300 }, () => {
            setShowRestored(false);
          });
        }, 3000);

        return () => clearTimeout(timer);
      } else {
        prevOfflineRef.current = false;
        animProgress.value = withTiming(0, { duration: 250 });
      }
    }
  }, [isOffline, status]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animProgress.value,
      transform: [
        {
          translateY: interpolate(animProgress.value, [0, 1], [-40, 0]),
        },
        {
          scale: interpolate(animProgress.value, [0, 1], [0.92, 1]),
        },
      ],
    };
  });

  const isVisible = isOffline || showRestored;
  if (!isVisible && animProgress.value === 0) {
    return null;
  }

  const isRestorationMessage = showRestored && !isOffline;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlayContainer,
        { top: insets.top + (Platform.OS === 'ios' ? 4 : 8) },
      ]}
    >
      <Animated.View style={[styles.animWrapper, animatedStyle]} pointerEvents="box-none">
        <LiquidGlass
          borderRadius={radius.pill}
          dense
          accentColor={isRestorationMessage ? '#30d158' : palette.primary}
          accentOpacity={0.15}
          style={styles.pillGlass}
        >
          <View style={styles.contentRow}>
            <Ionicons
              name={isRestorationMessage ? 'checkmark-circle' : 'cloud-offline'}
              size={15}
              color={isRestorationMessage ? '#30d158' : '#FFD60A'}
              style={styles.icon}
            />
            <Text style={styles.pillText} numberOfLines={1}>
              {isRestorationMessage
                ? 'Connected • Back online'
                : 'Offline Mode • Playing saved music'}
            </Text>
          </View>
        </LiquidGlass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillGlass: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  pillText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
