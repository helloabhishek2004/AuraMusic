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
