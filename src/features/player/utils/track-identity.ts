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
 * Extracts a raw artwork URL from any track/entity object structure.
 * Handles nested albums, trackSnapshots, thumbnail arrays, and various naming conventions.
 */
export function extractRawArtworkUrl(track: any): string {
  if (!track) return "";

  if (typeof track === 'string') {
    const trimmed = track.trim();
    if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && !trimmed.includes('placeholder')) {
      return trimmed;
    }
    return "";
  }

  // 1. Direct property check
  let url =
    track.art ||
    track.artwork ||
    track.artworkUrl ||
    track.thumbnail ||
    track.thumbnailUrl ||
    track.coverArt ||
    track.albumArt ||
    track.image ||
    track.picture;

  // Handle object source like { uri: "..." }
  if (url && typeof url === 'object' && typeof url.uri === 'string') {
    url = url.uri;
  }

  // 2. Nested album metadata
  if (!url && track.album && typeof track.album === 'object') {
    url =
      track.album.thumbnail ||
      track.album.thumbnailUrl ||
      track.album.art ||
      track.album.artwork ||
      track.album.coverArt ||
      track.album.image;
    if (url && typeof url === 'object' && typeof url.uri === 'string') {
      url = url.uri;
    }
  }

  // 3. Nested trackSnapshot
  if (!url && track.trackSnapshot) {
    url = extractRawArtworkUrl(track.trackSnapshot);
  }

  // 4. Thumbnails array (e.g. YouTube API format)
  if (!url && Array.isArray(track.thumbnails) && track.thumbnails.length > 0) {
    const sorted = [...track.thumbnails].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    url = sorted[0]?.url;
  }

  // 5. Thumbnails inside trackSnapshot
  if (!url && track.trackSnapshot && Array.isArray(track.trackSnapshot.thumbnails) && track.trackSnapshot.thumbnails.length > 0) {
    const sorted = [...track.trackSnapshot.thumbnails].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    url = sorted[0]?.url;
  }

  if (typeof url !== 'string') return "";
  url = url.trim();

  if (!url || url === 'undefined' || url === 'null') return "";

  // Protocol-relative URLs: //lh3.googleusercontent.com/... -> https://lh3.googleusercontent.com/...
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  // Upgrade insecure http to https for known CDN domains
  if (url.startsWith('http://') && (url.includes('googleusercontent.com') || url.includes('ggpht.com') || url.includes('ytimg.com'))) {
    url = url.replace('http://', 'https://');
  }

  return url;
}

/**
 * Appends sizing parameters to YouTube/YTMusic image URLs to optimize texture memory.
 */
export function getArtworkUrl(track: any, size: ArtworkSize = 'album'): string {
  if (!track) return "";
  let url = extractRawArtworkUrl(track);
  
  if (!url) return "";

  // YouTube / YTMusic sizing logic
  if ((url.includes('googleusercontent.com') || url.includes('ggpht.com')) && !url.includes('?') && !url.includes('aida-public')) {
    const s = SIZE_MAP[size];
    // Safely remove existing sizing parameters without destroying base64url hyphens
    const base = url.split('=')[0];
    return `${base}=w${s}-h${s}-l90-rj`;
  }

  return url;
}

export function getTrackArtwork(track: any): string {
  return getArtworkUrl(track, 'album');
}


