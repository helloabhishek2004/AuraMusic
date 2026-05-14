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
  // Local Media Support
  isLocal?: boolean;
  localUri?: string;
  mimeType?: string;
  folderName?: string;
}

/**
 * Common search response structure.
 */
export type SearchResponse = MusicTrack[];
