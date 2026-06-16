import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import { palette, radius } from '@/src/design/tokens';
import { PlayerTrack } from '@/src/features/player/types/player';
import { AuraText } from './aura-primitives';
import { LiquidGlass } from './liquid-glass';

interface DownloadAlbumButtonProps {
  tracks: PlayerTrack[];
  style?: ViewStyle;
}

export const DownloadAlbumButton = memo(({ tracks, style }: DownloadAlbumButtonProps) => {
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  const activeTasks = useDownloadStore(s => s.activeTasks);
  const addDownload = useDownloadStore(s => s.addDownload);

  const stats = useMemo(() => {
    let downloadedCount = 0;
    let inQueueCount = 0;
    let totalProgress = 0;
    let activeTrackTitle = '';

    tracks.forEach(track => {
      if (downloadedTracks[track.id]) {
        downloadedCount++;
        totalProgress += 1;
      } else if (activeTasks[track.id]) {
        inQueueCount++;
        totalProgress += activeTasks[track.id].progress;
        if (activeTasks[track.id].status === 'downloading') {
          activeTrackTitle = track.title;
        }
      }
    });

    const isDownloading = inQueueCount > 0;
    const isCompleted = downloadedCount === tracks.length && tracks.length > 0;
    const percentage = tracks.length > 0 ? (totalProgress / tracks.length) : 0;

    return {
      downloadedCount,
      totalCount: tracks.length,
      isDownloading,
      isCompleted,
      percentage,
      activeTrackTitle
    };
  }, [tracks, downloadedTracks, activeTasks]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!stats.isDownloading && !stats.isCompleted) {
      tracks.forEach(track => {
        if (!downloadedTracks[track.id] && !activeTasks[track.id]) {
          addDownload(track);
        }
      });
    }
  }, [tracks, stats, downloadedTracks, activeTasks, addDownload]);

  if (stats.isDownloading) {
    const { width, minWidth, flex, ...containerStyle } = StyleSheet.flatten(style || {});
    return (
      <View style={[styles.downloadingContainer, style]}>
        <View style={styles.info}>
          <AuraText variant="caption" style={styles.statsText}>
            {stats.downloadedCount}/{stats.totalCount}
          </AuraText>
          <AuraText variant="caption" numberOfLines={1} style={styles.activeText}>
            {Math.round(stats.percentage * 100)}%
          </AuraText>
        </View>
        <View style={styles.progressTrack}>
           <View style={[styles.progressBar, { width: `${stats.percentage * 100}%` }]} />
        </View>
      </View>
    );
  }

  const flattenedStyle = StyleSheet.flatten(style || {});
  const hasFlex = flattenedStyle.flex !== undefined && flattenedStyle.flex !== 0;
  const hasParentWidth = flattenedStyle.width !== undefined;

  return (
    <TouchableOpacity 
      onPress={handlePress}
      activeOpacity={0.8}
      style={[
        styles.iconButton,
        (hasFlex && !hasParentWidth) && { width: undefined },
        stats.isCompleted && styles.completedButton,
        style
      ]}
    >
      <Ionicons 
        name={stats.isCompleted ? "checkmark-circle" : "cloud-download-outline"} 
        size={22} 
        color={stats.isCompleted ? palette.primary : palette.ink} 
      />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  completedButton: {
    borderColor: "rgba(191,90,242,0.3)",
    backgroundColor: "rgba(191,90,242,0.1)",
  },
  downloadingContainer: {
    height: 54,
    minWidth: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    justifyContent: 'center',
    gap: 4,
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.ink,
  },
  activeText: {
    fontSize: 10,
    color: palette.primary,
    fontWeight: '900',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: palette.primary,
  }
});
