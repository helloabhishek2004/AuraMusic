/**
 * AuraMusic PlaylistArtwork Component
 *
 * Smart, production-grade dynamic artwork renderer for playlists and music collections.
 * Uses DynamicCollectionArtwork to generate 4-quadrant (2×2), 3-panel, 2-panel, or single-image
 * composite artwork directly from the actual tracks in the collection.
 */

import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Playlist } from '../types/playlist';
import { DynamicCollectionArtwork } from './DynamicCollectionArtwork';

export interface PlaylistArtworkProps {
  playlist?: Playlist | null;
  tracks?: { art?: string; artwork?: string; [key: string]: any }[] | null;
  artworkUrls?: string[];
  size: number;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  entityName?: string;
  entityType?: 'playlist' | 'song';
  isLikedCollection?: boolean;
  fallbackIcon?: keyof typeof Ionicons.prototype.props.name;
}

export const PlaylistArtwork = React.memo(
  ({
    playlist,
    tracks,
    artworkUrls,
    size,
    style,
    borderRadius = 14,
    cachePolicy = 'memory-disk',
    entityName,
    entityType = 'playlist',
    isLikedCollection,
    fallbackIcon,
  }: PlaylistArtworkProps) => {
    return (
      <DynamicCollectionArtwork
        playlist={playlist}
        tracks={tracks}
        artworkUrls={artworkUrls}
        size={size}
        style={style}
        borderRadius={borderRadius}
        cachePolicy={cachePolicy}
        entityName={entityName}
        entityType={entityType}
        isLikedCollection={isLikedCollection}
        fallbackIcon={fallbackIcon}
      />
    );
  }
);

PlaylistArtwork.displayName = 'PlaylistArtwork';

export default PlaylistArtwork;
