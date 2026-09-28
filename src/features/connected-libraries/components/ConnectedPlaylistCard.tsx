import React, { memo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ConnectedPlaylist } from '../types/provider';
import { PROVIDER_METAS } from '../providers/base';
import { usePlayerStore } from '@/src/features/player/store/player.store';
import { useConnectedLibrariesStore } from '../store/connected-libraries.store';

interface ConnectedPlaylistCardProps {
  playlist: ConnectedPlaylist;
  onPress: (playlist: ConnectedPlaylist) => void;
  onPlay: (playlist: ConnectedPlaylist) => void;
}

const CARD_WIDTH = 144;
const CARD_HEIGHT = 144;

export const ConnectedPlaylistCard = memo(function ConnectedPlaylistCard({
  playlist,
  onPress,
  onPlay,
}: ConnectedPlaylistCardProps) {
  const meta = PROVIDER_METAS[playlist.providerId] || PROVIDER_METAS.spotify;

  // Single-click debounce to avoid multiple page openings
  const isNavigatingRef = useRef(false);

  const handleCardPress = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress(playlist);
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
  }, [playlist, onPress]);

  const handlePlayPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPlay(playlist);
  }, [playlist, onPlay]);

  // Check if this specific connected playlist is currently active & playing
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const activeContext = usePlayerStore((s) => s.activeContext);
  const isThisPlaylistPlaying =
    activeContext?.type === 'playlist' &&
    activeContext?.id === playlist.externalId &&
    isPlaying;

  // Read cached playlist to ensure accurate live track count even before parent sync
  const cachedPlaylist = useConnectedLibrariesStore(
    (s) => s.playlistCache?.[`${playlist.providerId}:${playlist.externalId}`]
  );

  const displayTrackCount =
    (cachedPlaylist?.trackCount && cachedPlaylist.trackCount > 0)
      ? cachedPlaylist.trackCount
      : (cachedPlaylist?.externalTracks?.length && cachedPlaylist.externalTracks.length > 0)
      ? cachedPlaylist.externalTracks.length
      : (playlist.trackCount || 0);

  const providerShortLabel =
    playlist.providerId === 'ytmusic'
      ? 'YT Music'
      : meta.name;

  const countUnit =
    playlist.providerId === 'ytmusic' || playlist.providerId === 'applemusic'
      ? (displayTrackCount === 1 ? 'track' : 'tracks')
      : (displayTrackCount === 1 ? 'song' : 'songs');

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handleCardPress}
      style={styles.container}
    >
      <View style={styles.artworkFrame}>
        {playlist.coverUrl ? (
          <Image
            source={{ uri: playlist.coverUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.placeholderBg]}>
            <Ionicons name="musical-notes" size={36} color="rgba(255,255,255,0.25)" />
          </View>
        )}

        {/* Dark gradient scrim */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Source Badge (top-left) */}
        <View style={styles.sourceBadge}>
          <View style={[styles.sourceDot, { backgroundColor: meta.brandColor }]} />
          <Text style={styles.sourceText}>{providerShortLabel}</Text>
        </View>

        {/* Play/Pause Button (bottom-right: Signature Purple & White) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePlayPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.playButton}
        >
          <LinearGradient
            colors={['#BF5AF2', '#9B38DA']}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons
            name={isThisPlaylistPlaying ? 'pause' : 'play'}
            size={16}
            color="#FFFFFF"
            style={{ marginLeft: isThisPlaylistPlaying ? 0 : 2 }}
          />
        </TouchableOpacity>
      </View>

      {/* Title & metadata */}
      <Text numberOfLines={1} style={styles.title}>
        {playlist.title}
      </Text>
      <Text numberOfLines={1} style={styles.subtitle}>
        {providerShortLabel} · {displayTrackCount} {countUnit}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: 14,
  },
  artworkFrame: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(32, 31, 41, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 8,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
        }
      : { elevation: 6 }),
  },
  placeholderBg: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1D27',
  },
  sourceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.92)',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
  },
  playButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F2EFF8',
    letterSpacing: -0.2,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#A49EB3',
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
