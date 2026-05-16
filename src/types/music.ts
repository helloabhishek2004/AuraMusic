/**
 * Represents a music track metadata in the Aura system.
 * This interface bridges backend (videoId, thumbnail) with frontend (id, art).
 */
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  art: string;
  url?: string;
  time?: string;
  duration?: string;
  durationSec?: number;
  album?: string;
  dominantColors?: string[];
  // Local Media Support
  isLocal?: boolean;
  localUri?: string;
  mimeType?: string;
  folderName?: string;
  source?: string;
  artistId?: string;
  albumId?: string;
}

export interface ArtistDetails {
  id: string;
  name: string;
  description?: string;
  tagline?: string;
  genres?: string[];
  thumbnail: string;
  subscribers?: string;
  songs: MusicTrack[];
  songs_params?: string;
  albums: AlbumDetails[];
  albums_params?: string;
  singles: AlbumDetails[];
  singles_params?: string;
  related: ArtistBasicInfo[];
}

export interface AlbumDetails {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  year?: string;
  thumbnail: string;
  type?: 'album' | 'single';
  description?: string;
  trackCount?: number;
  duration?: string;
  tracks?: MusicTrack[];
}

export interface ArtistBasicInfo {
  id: string;
  title: string;
  thumbnail: string;
  subscribers?: string;
}

/**
 * Common search response structure.
 */
export type SearchResponse = MusicTrack[];
