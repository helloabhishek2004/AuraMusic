/**
 * AuraMusic AddToPlaylistSheet
 *
 * Bottom sheet for adding a track to a playlist.
 * Design: matches QueueActionSheet — SlideInDown.springify() pattern.
 * Handles: duplicate detection, haptic feedback, Quick Add shortcut.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { PlayerTrack } from '@/src/features/player/types/player';
import { usePlaylistStore } from '../store/playlist.store';
import { getShortStats } from '../utils/playlist-metrics';
import PlaylistArtwork from './PlaylistArtwork';
import type { Playlist } from '../types/playlist';

interface AddToPlaylistSheetProps {
  visible: boolean;
  track: PlayerTrack | null;
  onClose: () => void;
}

interface FeedbackState {
  playlistId: string;
  type: 'added' | 'duplicate';
}

const AddToPlaylistSheet = React.memo(
  ({ visible, track, onClose }: AddToPlaylistSheetProps) => {
    const router = useRouter();

    const playlistsMap = usePlaylistStore(s => s.playlists);
    const sortBy = usePlaylistStore(s => s.sortBy);
    const playlistOrder = usePlaylistStore(s => s.playlistOrder);
    
    const playlists = useMemo(
      () => usePlaylistStore.getState().getSortedPlaylists(),
      [playlistsMap, sortBy, playlistOrder]
    );
    const lastUsedPlaylistId = usePlaylistStore((s) => s.lastUsedPlaylistId);
    const lastUsedPlaylist = usePlaylistStore((s) =>
      s.lastUsedPlaylistId ? s.playlists[s.lastUsedPlaylistId] : null
    );

    const [feedback, setFeedback] = useState<FeedbackState | null>(null);

    // Which playlists already contain this track
    const containingPlaylistIds = useMemo(() => {
      if (!track) return new Set<string>();
      return new Set(
        playlists
          .filter((p) => p.trackIds.includes(track.id))
          .map((p) => p.id)
      );
    }, [playlists, track]);

    const handleAdd = useCallback(
      (playlist: Playlist) => {
        if (!track) return;

        const result = usePlaylistStore.getState().addTrack(playlist.id, track);

        if (result === 'duplicate') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setFeedback({ playlistId: playlist.id, type: 'duplicate' });
          setTimeout(() => setFeedback(null), 1800);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          usePlaylistStore.getState().setLastUsedPlaylist(playlist.id);
          setFeedback({ playlistId: playlist.id, type: 'added' });
          setTimeout(() => {
            setFeedback(null);
            onClose();
          }, 600);
        }
      },
      [track, onClose]
    );

    const handleQuickAdd = useCallback(() => {
      if (!lastUsedPlaylist) return;
      handleAdd(lastUsedPlaylist);
    }, [lastUsedPlaylist, handleAdd]);

    const handleCreateNew = useCallback(() => {
      onClose();
      setTimeout(() => router.push('/create_playlist'), 200);
    }, [onClose, router]);

    if (!visible) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            />
          </Pressable>
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(200).mass(0.8)}
          exiting={SlideOutDown.springify().damping(22).stiffness(200).mass(0.8)}
          style={styles.sheet}
          pointerEvents="box-none"
        >
          <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.sheetBg]} />

          {/* Handle */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add to Playlist</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Track Preview */}
          {track && (
            <View style={styles.trackPreview}>
              <View style={styles.trackArtWrap}>
                {track.art ? (
                  <Animated.Image
                    source={{ uri: track.art }}
                    style={styles.trackArt}
                  />
                ) : (
                  <View style={[styles.trackArt, styles.trackArtPlaceholder]}>
                    <Ionicons name="musical-note" size={16} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
              </View>
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
              </View>
            </View>
          )}

          {/* Quick Add */}
          {lastUsedPlaylist &&
            lastUsedPlaylistId !== null &&
            track &&
            !containingPlaylistIds.has(lastUsedPlaylistId) && (
              <TouchableOpacity
                style={styles.quickAddRow}
                onPress={handleQuickAdd}
                activeOpacity={0.7}
              >
                <View style={styles.quickAddLeft}>
                  <Ionicons name="flash" size={14} color="#bf5af2" />
                  <Text style={styles.quickAddLabel}>Quick Add</Text>
                </View>
                <Text style={styles.quickAddName} numberOfLines={1}>
                  {lastUsedPlaylist.name}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}

          {/* Playlist List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Create New */}
            <TouchableOpacity
              style={styles.createRow}
              onPress={handleCreateNew}
              activeOpacity={0.7}
            >
              <View style={styles.createIconWrap}>
                <Ionicons name="add" size={22} color="#bf5af2" />
              </View>
              <Text style={styles.createLabel}>New Playlist</Text>
            </TouchableOpacity>

            {/* Existing Playlists */}
            {playlists.map((playlist) => {
              const isContaining = containingPlaylistIds.has(playlist.id);
              const fb = feedback?.playlistId === playlist.id ? feedback : null;
              const isDuplicate = fb?.type === 'duplicate';
              const isAdded = fb?.type === 'added';

              return (
                <TouchableOpacity
                  key={playlist.id}
                  style={[
                    styles.playlistRow,
                    isAdded && styles.playlistRowAdded,
                  ]}
                  onPress={() => handleAdd(playlist)}
                  activeOpacity={isContaining ? 0.5 : 0.7}
                  disabled={isAdded}
                >
                  <PlaylistArtwork
                    playlist={playlist}
                    size={44}
                    borderRadius={10}
                  />
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName} numberOfLines={1}>
                      {playlist.name}
                    </Text>
                    <Text style={styles.playlistCount}>
                      {getShortStats(playlist)}
                    </Text>
                  </View>
                  <View style={styles.playlistRight}>
                    {isDuplicate ? (
                      <Text style={styles.duplicateText}>Already added</Text>
                    ) : isAdded ? (
                      <Ionicons name="checkmark-circle" size={22} color="#47e39a" />
                    ) : isContaining ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color="rgba(191,90,242,0.7)"
                      />
                    ) : (
                      <Ionicons
                        name="add-circle-outline"
                        size={20}
                        color="rgba(255,255,255,0.25)"
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {playlists.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No playlists yet</Text>
                <Text style={styles.emptySubText}>
                  Create one to start organizing your music.
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    );
  }
);

AddToPlaylistSheet.displayName = 'AddToPlaylistSheet';

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    maxHeight: '78%',
    borderRadius: 32,
    overflow: 'hidden',
  },
  sheetBg: {
    backgroundColor: 'rgba(12,12,18,0.88)',
    borderRadius: 32,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  trackArtWrap: { flexShrink: 0 },
  trackArt: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  trackArtPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.1,
  },
  trackArtist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(191,90,242,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(191,90,242,0.2)',
    gap: 8,
  },
  quickAddLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickAddLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#bf5af2',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickAddName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 4,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  createIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(191,90,242,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#bf5af2',
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 12,
    borderRadius: 12,
  },
  playlistRowAdded: {
    backgroundColor: 'rgba(71,227,154,0.06)',
  },
  playlistInfo: { flex: 1 },
  playlistName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.1,
  },
  playlistCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  playlistRight: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  duplicateText: {
    fontSize: 11,
    color: 'rgba(255,200,0,0.8)',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  emptySubText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
  },
});

export default AddToPlaylistSheet;
