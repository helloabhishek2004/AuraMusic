import React, { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import { DownloadManager } from '@/src/features/download/services/download.manager';
import { palette } from '@/src/design/tokens';
import { PlayerTrack } from '@/src/features/player/types/player';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DownloadButtonProps {
  track: PlayerTrack;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const DownloadButton = memo(({ track, size = 24, color = palette.ink, style }: DownloadButtonProps) => {
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  const activeTasks = useDownloadStore(s => s.activeTasks);
  const addDownload = useDownloadStore(s => s.addDownload);

  const downloaded = !!downloadedTracks[track.id];
  const task = activeTasks[track.id];
  const downloading = task?.status === 'downloading' || task?.status === 'queued' || task?.status === 'preparing';

  // Normalize progress to [0, 1]
  const rawProgress = task?.progress || 0;
  const progressRatio = rawProgress > 1 ? Math.min(1, rawProgress / 100) : Math.max(0, Math.min(1, rawProgress));

  const progressSV = useSharedValue(progressRatio);
  const completionScale = useSharedValue(1);
  const pressScale = useSharedValue(1);

  const prevDownloadedRef = useRef(downloaded);
  const wasDownloadingRef = useRef(downloading);

  // Smoothly update progress with Reanimated timing
  useEffect(() => {
    if (downloading) {
      progressSV.value = withTiming(progressRatio, {
        duration: 250,
        easing: ReanimatedEasing.out(ReanimatedEasing.quad),
      });
    } else {
      progressSV.value = 0;
    }
  }, [downloading, progressRatio, progressSV]);

  // Handle completion animation: triggered ONLY when transitioning into completed state
  useEffect(() => {
    if (!prevDownloadedRef.current && downloaded && wasDownloadingRef.current) {
      completionScale.value = 0.55;
      completionScale.value = withSpring(1, { damping: 9, stiffness: 220 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevDownloadedRef.current = downloaded;
    wasDownloadingRef.current = downloading;
  }, [downloaded, downloading, completionScale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    pressScale.value = withSpring(0.85, { damping: 12, stiffness: 300 }, (finished) => {
      if (finished) {
        pressScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }
    });

    if (downloaded) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      DownloadManager.removeDownload(track.id);
    } else if (downloading) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      DownloadManager.cancelDownload(track.id);
    } else {
      addDownload(track);
    }
  }, [downloaded, downloading, track, addDownload, pressScale]);

  const handleLongPress = useCallback(() => {
    if (downloaded) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      DownloadManager.removeDownload(track.id);
    }
  }, [downloaded, track.id]);

  // SVG circular geometry
  const strokeWidth = Math.max(2, Math.round(size * 0.09));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const animatedCircleProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - progressSV.value);
    return {
      strokeDashoffset,
    };
  });

  const completionAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: completionScale.value }],
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const renderContent = () => {
    if (downloaded) {
      return (
        <Animated.View style={completionAnimatedStyle}>
          <Ionicons name="checkmark-circle" size={size} color={palette.primary} />
        </Animated.View>
      );
    }

    if (downloading) {
      return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
          <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            {/* Background Track Ring */}
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={strokeWidth}
            />
            {/* Dynamic Real Progress Ring */}
            <AnimatedCircle
              cx={cx}
              cy={cy}
              r={radius}
              fill="transparent"
              stroke={palette.primary}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              animatedProps={animatedCircleProps}
              strokeLinecap="round"
            />
          </Svg>
          {/* Subtle Center Icon */}
          <Ionicons name="arrow-down" size={Math.round(size * 0.45)} color={palette.primary} />
        </View>
      );
    }

    return <Ionicons name="cloud-download-outline" size={size} color={color} />;
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      activeOpacity={0.7}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={
        downloaded
          ? `Downloaded: ${track.title}`
          : downloading
          ? `Downloading ${track.title}: ${Math.round(progressRatio * 100)}%`
          : `Download ${track.title}`
      }
    >
      <Animated.View style={containerAnimatedStyle}>
        {renderContent()}
      </Animated.View>
    </TouchableOpacity>
  );
});
