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
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { usePlayerUIStore } from '@/src/features/player/store/player-ui.store';
import type { PlayerTrack } from '@/src/features/player/types/player';
import { usePlaylistStore } from '../store/playlist.store';
import { getShortStats } from '../utils/playlist-metrics';
import PlaylistArtwork from './PlaylistArtwork';
import type { Playlist } from '../types/playlist';
import { getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { resolveArtwork } from '@/src/features/player/utils/artwork-resolver';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import { useBackHandler, BackPriority } from '@/src/navigation/back';

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

    useBackHandler({
      id: 'add-to-playlist-sheet',
      enabled: visible,
      priority: BackPriority.BOTTOM_SHEET,
      onBack: () => {
        onClose();
        return true;
      },
    });

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
      // Navigate to the create playlist screen immediately
      router.push('/create_playlist');

      // Safely close the sheet and collapse the player overlay in the background
      // after the transition to the new screen covers the viewport (500ms)
      setTimeout(() => {
        onClose();
        usePlayerUIStore.getState().collapse();
      }, 500);
    }, [onClose, router]);

    if (!visible) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            {Platform.OS === 'ios' && <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />}
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
          pointerEvents="auto"
        >
          {Platform.OS === 'ios' && <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />}
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
                <AuraArtwork
                  source={resolveArtwork(track, 'card')}
                  entityName={track.title}
                  entityType="song"
                  style={styles.trackArt}
                  contentFit="cover"
                  transition={250}
                  cachePolicy="memory-disk"
                  borderRadius={10}
                />
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
                    cachePolicy="memory-disk"
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
    maxHeight: '80%',
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(28,28,34,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetBg: {
    backgroundColor: 'rgba(15,15,20,0.4)',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 20,
    marginBottom: 20,
  },
  trackArtWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 14,
    overflow: 'hidden',
  },
  trackArt: {
    width: 48,
    height: 48,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  trackArtist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(191,90,242,0.1)',
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.15)',
  },
  quickAddLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  quickAddLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#bf5af2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  quickAddName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  list: {
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 24,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  createIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(191,90,242,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  createLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#bf5af2',
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
  },
  playlistRowAdded: {
    backgroundColor: 'rgba(71,227,154,0.05)',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 14,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  playlistCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  playlistRight: {
    width: 24,
    alignItems: 'flex-end',
  },
  duplicateText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    position: 'absolute',
    right: 0,
    width: 100,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  emptySubText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default AddToPlaylistSheet;
