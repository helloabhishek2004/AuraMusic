import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import { DownloadManager } from '@/src/features/download/services/download.manager';
import { palette } from '@/src/design/tokens';
import { PlayerTrack } from '@/src/features/player/types/player';

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

  const cancelDownload = useDownloadStore(s => s.cancelDownload);

  const downloaded = !!downloadedTracks[track.id];
  const task = activeTasks[track.id];
  const downloading = task?.status === 'downloading' || task?.status === 'queued';
  const progress = task?.progress || 0;

  const rotation = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (downloading) {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotation.setValue(0);
    }
  }, [downloading]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    if (downloaded) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      DownloadManager.removeDownload(track.id);
    } else if (downloading) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      DownloadManager.cancelDownload(track.id);
    } else {
      addDownload(track);
    }
  }, [downloaded, downloading, track, addDownload]);

  const handleLongPress = useCallback(() => {
    if (downloaded) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      DownloadManager.removeDownload(track.id);
    }
  }, [downloaded, track.id]);

  const rotationValue = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderIcon = () => {
    if (downloaded) {
      return <Ionicons name="checkmark-circle" size={size} color={palette.primary} />;
    }
    
    if (downloading) {
      return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
          {/* Progress Ring */}
          <View style={[styles.ringBase, { width: size, height: size, borderRadius: size / 2 }]} />
          <Animated.View style={{ 
            position: 'absolute', 
            width: size, 
            height: size, 
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: 'transparent',
            borderTopColor: palette.primary,
            transform: [{ rotate: rotationValue }]
          }} />
          <Ionicons name="arrow-down" size={size * 0.6} color={palette.primary} />
        </View>
      );
    }

    return <Ionicons name="cloud-download-outline" size={size} color={color} />;
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={[style, { transform: [{ scale }] }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {renderIcon()}
      </Animated.View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  ringBase: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  }
});
