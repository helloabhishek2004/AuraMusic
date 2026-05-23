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
import type { Playlist } from '../types/playlist';
import { getCollageArtUrls } from '../utils/playlist-metrics';

interface PlaylistArtworkProps {
  playlist: Playlist;
  size: number;
  style?: ViewStyle;
  borderRadius?: number;
}

const PlaylistArtwork = React.memo(
  ({ playlist, size, style, borderRadius = 14 }: PlaylistArtworkProps) => {
    const gradientColors = useMemo(() => {
      const raw = playlist.gradientColors || ['#bf5af2', '#6f2bbe'];
      const hasYellow = raw.some(c => {
        const lower = c.toLowerCase();
        return lower === '#ffd166' || lower === '#cc8c00' || lower === '#ffd700';
      });
      if (hasYellow) {
        return ['#d946ef', '#701a75'] as [string, string];
      }
      return raw;
    }, [playlist.gradientColors]);

    // Memoize with stable primitive deps — no object identity churn
    const artUrls = useMemo(
      () => getCollageArtUrls(playlist, 4),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        playlist.coverArt,
        // Join trackIds for stable primitive comparison
        playlist.trackIds.join(','),
        // Snapshot keys (only changes when tracks are added/removed)
        playlist.trackSnapshots ? Object.keys(playlist.trackSnapshots).join(',') : '',
      ]
    );

    const containerStyle: ViewStyle = {
      width: size,
      height: size,
      borderRadius,
      overflow: 'hidden',
      ...(style as object),
    };

    // ── Case 1: Custom cover art ───────────────────────────────────────────
    if (playlist.coverArt) {
      return (
        <View style={containerStyle}>
          <Image
            source={{ uri: playlist.coverArt }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        </View>
      );
    }

    // ── Case 2: 2×2 collage ────────────────────────────────────────────────
    if (artUrls.length >= 4) {
      const half = size / 2;
      return (
        <View style={[containerStyle, styles.collage]}>
          {artUrls.slice(0, 4).map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={{ width: half, height: half }}
              contentFit="cover"
              transition={200}
            />
          ))}
        </View>
      );
    }

    // ── Case 3: Single art (no overlay) ───────────────────────────────────
    if (artUrls.length > 0) {
      return (
        <View style={containerStyle}>
          <Image
            source={{ uri: artUrls[0] }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        </View>
      );
    }

    // ── Case 4: Gradient placeholder ──────────────────────────────────────
    return (
      <View style={containerStyle}>
        <LinearGradient
          colors={gradientColors}
          style={[StyleSheet.absoluteFill, styles.gradientCenter]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons
            name="musical-notes"
            size={size * 0.35}
            color="rgba(255,255,255,0.6)"
          />
        </LinearGradient>
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
