import { PlayerTrack } from "../types/player";

/**
 * Normalizes a string by lowercasing and removing non-alphanumeric characters.
 */
function normalizeString(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Generates a canonical identity for a track.
 * This ensures that identical songs (streamed vs downloaded) map to the same cache entry.
 */
export function getCanonicalTrackId(track: Partial<PlayerTrack>): string {
    // 1. Explicit videoId (if available via id or metadata)
    // If the track is from ytmusic, the ID is exactly the 11-character videoId.
    // If the track is downloaded, we might have the original ID stored in `source` or `id`.
    if (track.source === 'ytmusic' && track.id && track.id.length === 11) {
        return track.id;
    }
    
    // Some local tracks might preserve the YT ID in the artistId or other fields?
    // In AuraMusic, downloaded tracks often keep the original ID in `id` if they were downloaded via the app.
    if (track.id && track.id.length === 11 && !track.id.includes('/') && !track.id.includes('\\')) {
        return track.id;
    }

    // 2. ISRC
    // Currently PlayerTrack doesn't have an explicit ISRC field, but if it did we'd use it.
    
    // 3. Fallback: Normalized Title + Artist
    if (track.title && track.artist) {
        const normTitle = normalizeString(track.title);
        const normArtist = normalizeString(track.artist);
        
        // Strip common suffixes from title like "official video", "audio"
        let cleanTitle = normTitle
            .replace(/officialvideo/g, '')
            .replace(/officialaudio/g, '')
            .replace(/lyricvideo/g, '')
            .replace(/lyrics/g, '');
            
        return `norm:${cleanTitle}:${normArtist}`;
    }

    // 4. Absolute fallback
    return track.id || `unknown-${Date.now()}`;
}

export function verifyTrackIdentity(
  selectedId: string,
  resolvedId: string,
  nativeId: string
): boolean {
  return selectedId === resolvedId && resolvedId === nativeId;
}

export type ArtworkSize = 'card' | 'album' | 'player' | 'artist' | 'full';

const SIZE_MAP: Record<ArtworkSize, number> = {
  card: 160,
  album: 300,
  player: 600,
  artist: 800,
  full: 1024,
};

/**
 * Appends sizing parameters to YouTube/YTMusic image URLs to optimize texture memory.
 */
export function getArtworkUrl(track: any, size: ArtworkSize = 'album'): string {
  if (!track) return "";
  let url = track.art || track.artwork || track.artworkUrl || track.thumbnail || track.image || "";
  
  if (!url) return "";

  // YouTube / YTMusic sizing logic
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    const s = SIZE_MAP[size];
    const originalUrl = url;
    
    // Safely remove existing sizing parameters without destroying base64url hyphens
    url = url.split('=')[0];
    
    const finalUrl = `${url}=w${s}-h${s}-l90-rj`;
    
    if (__DEV__) {
      console.log("[ARTWORK INPUT]", originalUrl);
      console.log("[ARTWORK OUTPUT]", finalUrl);
    }
    
    return finalUrl;
  }

  return url;
}

export function getTrackArtwork(track: any): string {
  return getArtworkUrl(track, 'album');
}

