/**
 * AuraMusic DynamicCollectionArtwork Component
 *
 * Production-level composite artwork for playlists, Liked Songs, and music collections.
 * Composes cover artwork dynamically from the actual tracks in the collection:
 *  - 4+ valid track artworks → 2×2 square composite (Track 1 | Track 2 / Track 3 | Track 4)
 *  - 3 valid track artworks  → Balanced 3-panel layout (Track 1 | Track 2 on top, Track 3 full-width on bottom)
 *  - 2 valid track artworks  → Clean 2-panel vertical split (Track 1 | Track 2)
 *  - 1 valid track artwork   → Single full-bleed cover image
 *  - 0 valid track artworks  → AuraMusic deterministic gradient empty-state fallback
 *
 * Visual Rules:
 *  - Aspect ratio: 1:1 square surface
 *  - Outer container gets the major corner radius; internal quadrant edges remain clean
 *  - Extremely subtle dark glass seam between quadrants (no bright lines, no thick gaps)
 *  - Proper center-crop (contentFit="cover") on all panels — zero distortion
 *  - Deterministic track order (no random rotations)
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import { isGeneratedArtwork, resolveArtwork } from '@/src/features/player/utils/artwork-resolver';
import { getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import { useLikesStore } from '@/src/features/likes/store/likes.store';
import { getLikedTracks } from '@/src/features/likes/utils/get-liked-tracks';
import type { Playlist } from '../types/playlist';

export interface DynamicCollectionArtworkProps {
  /** Optional playlist data structure */
  playlist?: Playlist | null;
  /** Explicit track array (preferred when resolved in view) */
  tracks?: { art?: string; artwork?: string; [key: string]: any }[] | null;
  /** Explicit artwork URLs if pre-resolved */
  artworkUrls?: string[];
  /** Outer square dimension */
  size?: number;
  /** Optional outer style */
  style?: StyleProp<ViewStyle>;
  /** Corner radius for the whole composite object */
  borderRadius?: number;
  /** Image caching policy */
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  /** Entity name for fallback */
  entityName?: string;
  /** Entity type for fallback */
  entityType?: 'playlist' | 'song';
  /** Explicitly mark as Liked Songs collection */
  isLikedCollection?: boolean;
  /** Fallback icon name */
  fallbackIcon?: keyof typeof Ionicons.prototype.props.name;
}

/**
 * Validates whether an artwork URL is a usable image URI (not generated or empty).
 */
export function isValidArtworkUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (isGeneratedArtwork(trimmed)) return false;
  if (trimmed.includes('placeholder')) return false;
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:')
  );
}

/**
 * Deterministically extracts up to `limit` valid track artworks from a track list in order.
 */
export function extractValidArtworks(
  tracks: { art?: string; artwork?: string; [key: string]: any }[],
  limit = 4
): string[] {
  const result: string[] = [];
  for (const track of tracks) {
    if (result.length >= limit) break;
    const raw = track.art || track.artwork || (track as any).trackSnapshot?.art;
    if (isValidArtworkUrl(raw)) {
      result.push(raw);
    } else {
      const resolved = resolveArtwork(track, 'card');
      if (isValidArtworkUrl(resolved)) {
        result.push(resolved);
      }
    }
  }
  return result;
}

export const DynamicCollectionArtwork = memo(
  ({
    playlist,
    tracks,
    artworkUrls,
    size,
    style,
    borderRadius = 20,
    cachePolicy = 'memory-disk',
    entityName,
    entityType = 'playlist',
    isLikedCollection,
    fallbackIcon,
  }: DynamicCollectionArtworkProps) => {
    const isLiked = isLikedCollection || playlist?.id === 'liked-songs' || entityName === 'Liked Songs';
    const likedCount = useLikesStore((s) => Object.keys(s.likedTrackIds).length);
    const latestLikedId = useLikesStore((s) => s.latestLikedTrackId);

    // ── 1. Resolve candidate artwork URLs ────────────────────────────────────
    const resolvedUrls = useMemo(() => {
      // Priority A: Direct explicit artwork URLs
      if (artworkUrls && artworkUrls.length > 0) {
        return artworkUrls.filter(isValidArtworkUrl).slice(0, 4);
      }

      // Priority B: Direct explicit tracks array
      if (tracks && tracks.length > 0) {
        return extractValidArtworks(tracks, 4);
      }

      // Priority C: Liked Songs playlist
      if (isLiked) {
        if (likedCount < 0 && latestLikedId === '') return [];
        const likedTracks = getLikedTracks();
        return extractValidArtworks(likedTracks, 4);
      }

      // Priority D: Standard playlist object
      if (playlist) {
        // If playlist has embedded tracks array
        const embeddedTracks = (playlist as any).tracks;
        if (embeddedTracks && Array.isArray(embeddedTracks) && embeddedTracks.length > 0) {
          return extractValidArtworks(embeddedTracks, 4);
        }

        // If playlist has trackIds
        if (playlist.trackIds && Array.isArray(playlist.trackIds) && playlist.trackIds.length > 0) {
          const downloaded = useDownloadStore.getState().downloadedTracks || {};
          const likeMeta = useLikesStore.getState().trackMetadata || {};
          const trackList: any[] = [];

          for (const id of playlist.trackIds) {
            const candidate =
              downloaded[id] ||
              playlist.trackSnapshots?.[id] ||
              likeMeta[id];
            if (candidate) {
              trackList.push(candidate);
            }
          }

          const extracted = extractValidArtworks(trackList, 4);
          if (extracted.length > 0) return extracted;
        }

        // Single custom coverArt fallback if specified
        if (playlist.coverArt && isValidArtworkUrl(playlist.coverArt)) {
          return [playlist.coverArt];
        }
      }

      return [];
    }, [artworkUrls, tracks, playlist, isLiked, likedCount, latestLikedId]);

    const containerStyle: ViewStyle = useMemo(
      () => ({
        ...(size !== undefined ? { width: size, height: size } : {}),
        borderRadius,
        overflow: 'hidden',
        backgroundColor: '#100f16',
        ...(StyleSheet.flatten(style) || {}),
      }),
      [size, borderRadius, style]
    );

    const displayName = entityName || playlist?.name || (isLiked ? 'Liked Songs' : 'Collection');
    const resolvedFallbackIcon = fallbackIcon || (isLiked ? 'heart' : 'musical-notes');

    // ── Layout Renderers ─────────────────────────────────────────────────────

    // ── CASE 0: No valid artworks (Empty state) ──────────────────────────────
    if (resolvedUrls.length === 0) {
      return (
        <View style={containerStyle}>
          <AuraArtwork
            source={null}
            entityName={displayName}
            entityType={entityType}
            fallbackIcon={resolvedFallbackIcon}
            borderRadius={borderRadius}
            style={StyleSheet.absoluteFill}
          />
          {/* Subtle top specular sheen */}
          <View pointerEvents="none" style={styles.topSpecular} />
          <View pointerEvents="none" style={[styles.outerBorder, { borderRadius }]} />
        </View>
      );
    }

    // ── CASE 1: Exactly 1 valid artwork ──────────────────────────────────────
    if (resolvedUrls.length === 1) {
      return (
        <View style={containerStyle}>
          <Image
            source={{ uri: getArtworkUrl({ art: resolvedUrls[0] }, 'album') }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            cachePolicy={cachePolicy}
          />
          <View pointerEvents="none" style={styles.topSpecular} />
          <View pointerEvents="none" style={[styles.outerBorder, { borderRadius }]} />
        </View>
      );
    }

    // ── CASE 2: Exactly 2 valid artworks (Balanced vertical split) ───────────
    if (resolvedUrls.length === 2) {
      return (
        <View style={containerStyle}>
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
            {/* Left panel: Track 1 */}
            <View style={styles.panel}>
              <Image
                source={{ uri: getArtworkUrl({ art: resolvedUrls[0] }, 'album') }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
                cachePolicy={cachePolicy}
              />
            </View>

            {/* Subtle dark seam */}
            <View style={styles.verticalSeam} />

            {/* Right panel: Track 2 */}
            <View style={styles.panel}>
              <Image
                source={{ uri: getArtworkUrl({ art: resolvedUrls[1] }, 'album') }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
                cachePolicy={cachePolicy}
              />
            </View>
          </View>

          <View pointerEvents="none" style={styles.topSpecular} />
          <View pointerEvents="none" style={[styles.outerBorder, { borderRadius }]} />
        </View>
      );
    }

    // ── CASE 3: Exactly 3 valid artworks (Balanced 3-panel layout) ───────────
    if (resolvedUrls.length === 3) {
      return (
        <View style={containerStyle}>
          <View style={StyleSheet.absoluteFill}>
            {/* Top row: Track 1 & Track 2 */}
            <View style={styles.row}>
              <View style={styles.panel}>
                <Image
                  source={{ uri: getArtworkUrl({ art: resolvedUrls[0] }, 'album') }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                  cachePolicy={cachePolicy}
                />
              </View>
              <View style={styles.verticalSeam} />
              <View style={styles.panel}>
                <Image
                  source={{ uri: getArtworkUrl({ art: resolvedUrls[1] }, 'album') }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                  cachePolicy={cachePolicy}
                />
              </View>
            </View>

            {/* Horizontal seam */}
            <View style={styles.horizontalSeam} />

            {/* Bottom row: Track 3 (Full width) */}
            <View style={styles.row}>
              <View style={styles.panel}>
                <Image
                  source={{ uri: getArtworkUrl({ art: resolvedUrls[2] }, 'album') }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                  cachePolicy={cachePolicy}
                />
              </View>
            </View>
          </View>

          <View pointerEvents="none" style={styles.topSpecular} />
          <View pointerEvents="none" style={[styles.outerBorder, { borderRadius }]} />
        </View>
      );
    }

    // ── CASE 4: 4 or more valid artworks (2×2 Square Collage) ────────────────
    return (
      <View style={containerStyle}>
        <View style={StyleSheet.absoluteFill}>
          {/* Top row: Track 1 & Track 2 */}
          <View style={styles.row}>
            <View style={styles.panel}>
              <Image
                source={{ uri: getArtworkUrl({ art: resolvedUrls[0] }, 'album') }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
                cachePolicy={cachePolicy}
              />
            </View>
            <View style={styles.verticalSeam} />
            <View style={styles.panel}>
              <Image
                source={{ uri: getArtworkUrl({ art: resolvedUrls[1] }, 'album') }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
                cachePolicy={cachePolicy}
              />
            </View>
          </View>

          {/* Horizontal seam */}
          <View style={styles.horizontalSeam} />

          {/* Bottom row: Track 3 & Track 4 */}
          <View style={styles.row}>
            <View style={styles.panel}>
              <Image
                source={{ uri: getArtworkUrl({ art: resolvedUrls[2] }, 'album') }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
                cachePolicy={cachePolicy}
              />
            </View>
            <View style={styles.verticalSeam} />
            <View style={styles.panel}>
              <Image
                source={{ uri: getArtworkUrl({ art: resolvedUrls[3] }, 'album') }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
                cachePolicy={cachePolicy}
              />
            </View>
          </View>
        </View>

        <View pointerEvents="none" style={styles.topSpecular} />
        <View pointerEvents="none" style={[styles.outerBorder, { borderRadius }]} />
      </View>
    );
  }
);

DynamicCollectionArtwork.displayName = 'DynamicCollectionArtwork';

const styles = StyleSheet.create({
  row: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
  },
  panel: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  verticalSeam: {
    width: StyleSheet.hairlineWidth || 1,
    height: '100%',
    backgroundColor: 'rgba(5, 5, 8, 0.55)',
    zIndex: 2,
  },
  horizontalSeam: {
    height: StyleSheet.hairlineWidth || 1,
    width: '100%',
    backgroundColor: 'rgba(5, 5, 8, 0.55)',
    zIndex: 2,
  },
  topSpecular: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    zIndex: 4,
  },
  outerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 3,
  },
});

export default DynamicCollectionArtwork;
