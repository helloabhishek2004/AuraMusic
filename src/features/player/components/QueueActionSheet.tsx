/**
 * QueueActionSheet.tsx — iOS 26 Liquid Glass Edition
 *
 * ✓ Slides up with spring (SlideInDown.springify config tuned)
 * ✓ Backdrop: blur + dim fade-in
 * ✓ Track preview: art thumbnail + title + artist
 * ✓ Action grid: glass capsule per action, icon glow, spring press scale
 * ✓ Destructive action (Remove): red-tinted glass, coral icon
 * ✓ Cancel: standalone glass pill, bottom-anchored
 * ✓ Full accessibility: roles, labels, min 44pt
 * ✓ All interactive elements spring-animated on press
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { resolveArtwork } from '@/src/features/player/utils/artwork-resolver';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import { PlayerTrack } from '../types/player';
import { palette, radius, spacing } from '@/src/design/tokens';
import { useDownloadStore } from '../../download/store/download.store';
import { DownloadManager } from '../../download/services/download.manager';
import AddToPlaylistSheet from '@/src/features/playlist/components/AddToPlaylistSheet';
import { useBackHandler, BackPriority } from '@/src/navigation/back';

const { width: SW } = Dimensions.get('window');
const isTablet = SW >= 768;

// ─── Colour helpers ───────────────────────────────────────────────────────────
const h2r = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const SURFACE  = 'rgba(18,18,26,0.80)';
const SPEC_TOP = 'rgba(255,255,255,0.20)';
const CORAL    = '#FF6B80';

// Spring config
const SPR_PRESS = { tension: 240, friction: 10 };

// ─── Glass layer (inner, no BlurView — parent BlurView handles background) ───
const GlassInner = ({
  children,
  style,
  r = 18,
  tintColor,
}: {
  children?: React.ReactNode;
  style?: any;
  r?: number;
  tintColor?: string;
}) => (
  <View style={[{ borderRadius: r, overflow: 'hidden', backgroundColor: SURFACE }, style]}>
    {tintColor && (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: r, backgroundColor: tintColor }]}
      />
    )}
    {/* Top specular */}
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: r * 0.4, right: r * 0.4,
        height: 1, backgroundColor: SPEC_TOP, zIndex: 9,
      }}
    />
    {/* Border */}
    <View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFillObject, borderRadius: r, borderWidth: 0.7,
        borderTopColor: 'rgba(255,255,255,0.22)',
        borderLeftColor: 'rgba(255,255,255,0.07)',
        borderRightColor: 'rgba(255,255,255,0.07)',
        borderBottomColor: 'rgba(255,255,255,0.04)',
        backgroundColor: 'transparent',
      }}
    />
    {children}
  </View>
);

// ─── Spring press action button ────────────────────────────────────────────────
const ActionBtn = ({
  icon,
  label,
  onPress,
  isDestructive = false,
  disabled = false,
  comingSoon = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
}) => {
  const sc = useRef(new RNAnimated.Value(1)).current;

  const onIn  = () => RNAnimated.spring(sc, { toValue: 0.93, ...SPR_PRESS, useNativeDriver: true }).start();
  const onOut = () => RNAnimated.spring(sc, { toValue: 1.00, ...SPR_PRESS, useNativeDriver: true }).start();

  const iconColor   = isDestructive ? CORAL : '#FFF';
  const iconBgColor = isDestructive ? h2r(CORAL, 0.16) : h2r('#FFFFFF', 0.08);
  const textColor   = isDestructive ? CORAL : '#FFF';
  const tint        = isDestructive ? h2r(CORAL, 0.07) : undefined;

  return (
    <RNAnimated.View style={{ transform: [{ scale: sc }], flex: 1, minWidth: '45%' }}>
      <TouchableOpacity
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={() => {
          if (!disabled && !comingSoon) {
            Haptics.impactAsync(
              isDestructive
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Light
            );
            onPress();
          }
        }}
        activeOpacity={1}
        disabled={disabled}
        style={{ opacity: disabled ? 0.45 : 1 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      >
        <GlassInner r={18} tintColor={tint} style={s.actionCard}>
          {/* Icon circle */}
          <View style={[s.actionIconCircle, { backgroundColor: iconBgColor }]}>
            <Ionicons name={icon as any} size={20} color={iconColor} />
          </View>

          {/* Label */}
          <View style={s.actionLabelWrap}>
            <Text style={[s.actionLabel, { color: textColor }]} numberOfLines={1}>
              {label}
            </Text>
            {comingSoon && (
              <View style={s.soonBadge}>
                <Text style={s.soonText}>Soon</Text>
              </View>
            )}
          </View>
        </GlassInner>
      </TouchableOpacity>
    </RNAnimated.View>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface QueueActionSheetProps {
  visible: boolean;
  track: PlayerTrack | null;
  onClose: () => void;
  onPlayNext: (track: PlayerTrack) => void;
  onAddToQueue: (track: PlayerTrack) => void;
  onRemove: (index: number) => void;
  onAddToPlaylist: (track: PlayerTrack) => void;
  trackIndex: number;
}

export const QueueActionSheet = ({
  visible,
  track,
  onClose,
  onPlayNext,
  onAddToQueue,
  onRemove,
  onAddToPlaylist,
  trackIndex,
}: QueueActionSheetProps) => {
  const insets = useSafeAreaInsets();

  useBackHandler({
    id: 'queue-action-sheet',
    enabled: visible,
    priority: BackPriority.ACTION_SHEET,
    onBack: () => {
      onClose();
      return true;
    },
  });

  if (!visible || !track) return null;

  const handlePlayNext = () => {
    onPlayNext(track);
    onClose();
  };

  const handleAddToQueue = () => {
    onAddToQueue(track);
    onClose();
  };

  const handleRemove = () => {
    onRemove(trackIndex);
    onClose();
  };

  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  const activeTasks = useDownloadStore(s => s.activeTasks);
  const addDownload = useDownloadStore(s => s.addDownload);

  const isDownloaded = !!downloadedTracks[track.id];
  const task = activeTasks[track.id];
  const isDownloading = task?.status === 'downloading' || task?.status === 'queued';

  const handleDownload = () => {
    if (!isDownloaded && !isDownloading) {
      addDownload(track);
    } else if (isDownloaded) {
      DownloadManager.removeDownload(track.id);
    }
    onClose();
  };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 2000 }]} pointerEvents="auto">
      {/* Backdrop */}
      <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss menu"
          accessibilityRole="button"
        >
          {Platform.OS === 'ios' && <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.58)' }]} />
        </Pressable>
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(200).mass(0.8)}
        exiting={SlideOutDown.springify().damping(22).stiffness(200)}
        style={[
          s.sheet,
          { paddingBottom: Math.max(insets.bottom + 16, 24) },
        ]}
      >
        {/* Background */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={68} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 12, 24, 0.96)' }]} />
        )}
        <LinearGradient
          colors={['rgba(14,12,24,0.97)', 'rgba(8,8,14,0.99)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Top accent line */}
        <View style={s.sheetTopLine} />

        {/* Handle */}
        <View style={s.handleWrap}>
          <View style={s.handleBar} />
        </View>

        {/* Track preview */}
        <GlassInner r={20} style={s.trackPreview}>
          <View style={s.trackPreviewInner}>
            {/* Art */}
            <AuraArtwork
              source={resolveArtwork(track, 'card')}
              entityName={track.title}
              entityType="song"
              style={s.trackArt}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              borderRadius={13}
            />

            {/* Info */}
            <View style={s.trackMeta}>
              <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={s.trackArtist} numberOfLines={1}>{track.artist}</Text>
            </View>

            {/* More icon */}
            <View style={s.trackIndicator}>
              <View style={s.trackDot} />
            </View>
          </View>
        </GlassInner>

        {/* Divider */}
        <View style={s.divider} />

        {/* Action grid: 2 cols, wrapping */}
        <View style={s.actionGrid}>
          <ActionBtn
            icon="play-forward"
            label="Play Next"
            onPress={handlePlayNext}
          />
          <ActionBtn
            icon="add-circle-outline"
            label="Add to Queue"
            onPress={handleAddToQueue}
          />
          <ActionBtn
            icon="list"
            label="Add to Playlist"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
              setTimeout(() => onAddToPlaylist(track), 150);
            }}
          />
          <ActionBtn
            icon={isDownloaded ? "trash-outline" : "cloud-download-outline"}
            label={isDownloaded ? "Remove Download" : (isDownloading ? "Downloading..." : "Download")}
            onPress={handleDownload}
            disabled={isDownloading}
            isDestructive={isDownloaded}
          />
          <ActionBtn
            icon="heart-outline"
            label="Like"
            onPress={() => {}}
            comingSoon
          />
          <ActionBtn
            icon="trash-outline"
            label="Remove from Queue"
            onPress={handleRemove}
            isDestructive
          />
        </View>

        {/* Cancel */}
        <View style={s.cancelWrap}>
          <ActionBtn
            icon="close"
            label="Cancel"
            onPress={onClose}
          />
        </View>
        </Animated.View>
      </View>
    );
};


// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 14, right: 14, bottom: 14,
    borderRadius: 32,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.48,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetTopLine: {
    position: 'absolute',
    top: 0, left: 40, right: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 0.5,
  },

  // Handle
  handleWrap: {
    alignItems: 'center',
    paddingTop: 14, paddingBottom: 8,
  },
  handleBar: {
    width: 36, height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  // Track preview
  trackPreview: {
    marginHorizontal: 16,
    marginBottom: 0,
  },
  trackPreviewInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  trackArt: {
    width: 52, height: 52,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  trackMeta: { flex: 1 },
  trackTitle: {
    fontSize: 16, fontWeight: '700', color: '#FFF',
    letterSpacing: -0.2, marginBottom: 4,
  },
  trackArtist: {
    fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '500',
  },
  trackIndicator: {
    paddingRight: 4,
  },
  trackDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Action grid
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  actionCard: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
  },
  actionIconCircle: {
    width: 38, height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontSize: 15, fontWeight: '700',
    letterSpacing: -0.1,
    flexShrink: 1,
  },

  // Coming soon badge
  soonBadge: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  soonText: {
    fontSize: 9.5, fontWeight: '700',
    color: 'rgba(255,255,255,0.40)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Cancel
  cancelWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
});
