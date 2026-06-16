/**
 * AuraMusic PlaylistArtwork Component
 *
 * Smart artwork renderer for playlists.
 * Memoized to prevent re-renders on unrelated store updates.
 *
 * Render priority:
 * 1. Custom coverArt URI
 * 2. 2×2 collage of first 4 track arts (if ≥4 available)
 * 3. Single track art with gradient overlay
 * 4. Pure gradient placeholder
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { resolveArtwork, isGeneratedArtwork } from '@/src/features/player/utils/artwork-resolver';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import type { Playlist } from '../types/playlist';
import { getCollageArtUrls } from '../utils/playlist-metrics';

interface PlaylistArtworkProps {
  playlist: Playlist;
  size: number;
  style?: ViewStyle;
  borderRadius?: number;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
}

const PlaylistArtwork = React.memo(
  ({ playlist, size, style, borderRadius = 14, cachePolicy = 'memory-disk' }: PlaylistArtworkProps) => {
    const containerStyle: ViewStyle = {
      width: size,
      height: size,
      borderRadius,
      overflow: 'hidden',
      ...(style as object),
    };

    const gradientColors = useMemo(() => {
      if (!playlist) return ['#bf5af2', '#6f2bbe'] as [string, string];
      const raw = playlist.gradientColors || ['#bf5af2', '#6f2bbe'];
      const hasYellow = raw.some(c => {
        const lower = c.toLowerCase();
        return lower === '#ffd166' || lower === '#cc8c00' || lower === '#ffd700';
      });
      if (hasYellow) {
        return ['#d946ef', '#701a75'] as [string, string];
      }
      return raw;
    }, [playlist?.gradientColors]);

    // Memoize with stable primitive deps — no object identity churn
    const artUrls = useMemo(
      () => {
        if (!playlist) return [];
        return getCollageArtUrls(playlist, 4);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        playlist?.coverArt,
        // Join trackIds for stable primitive comparison
        playlist?.trackIds?.join(','),
        // Snapshot keys (only changes when tracks are added/removed)
        playlist?.trackSnapshots ? Object.keys(playlist?.trackSnapshots).join(',') : '',
      ]
    );

    if (!playlist) {
      return (
        <View style={containerStyle}>
          <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
        </View>
      );
    }

    // ── Case 1: Custom cover art ───────────────────────────────────────────
    if (playlist.coverArt && !isGeneratedArtwork(playlist.coverArt)) {
      return (
        <View style={containerStyle}>
          <AuraArtwork
            source={getArtworkUrl({ art: playlist.coverArt }, 'album')}
            entityName={playlist.name}
            entityType="playlist"
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy={cachePolicy}
          />
        </View>
      );
    }

    // ── Case 2: 2×2 collage ────────────────────────────────────────────────
    if (artUrls.length >= 4) {
      const half = size / 2;
      return (
        <View style={[containerStyle, styles.collage]}>
          {artUrls.slice(0, 4).map((uri: string, i: number) => (
            <AuraArtwork
              key={i}
              source={resolveArtwork({ art: uri }, 'card')}
              entityName={playlist.name}
              entityType="song"
              style={{ width: half, height: half }}
              contentFit="cover"
              transition={200}
              cachePolicy={cachePolicy}
            />
          ))}
        </View>
      );
    }

    // ── Case 3: Single art (no overlay) ───────────────────────────────────
    if (artUrls.length > 0) {
      return (
        <View style={containerStyle}>
          <AuraArtwork
            source={resolveArtwork({ art: artUrls[0] }, 'card')}
            entityName={playlist.name}
            entityType="song"
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy={cachePolicy}
          />
        </View>
      );
    }

    // ── Case 4: Generated fallback ──────────────────────────────────────
    return (
      <View style={containerStyle}>
        <AuraArtwork
          source={resolveArtwork(playlist, 'album')}
          entityName={playlist.name}
          entityType="playlist"
          style={StyleSheet.absoluteFill}
          fallbackIcon="musical-notes"
        />
      </View>
    );
  }
);

PlaylistArtwork.displayName = 'PlaylistArtwork';

const styles = StyleSheet.create({
  collage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gradientCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PlaylistArtwork;
