import { ArtworkSize, getArtworkUrl } from "./track-identity";

/**
 * AuraMusic Deterministic Artwork System
 * 
 * Provides consistent fallbacks for missing media metadata.
 */

// Curated palette for generated artwork
export const ARTWORK_GRADIENTS: Array<[string, string]> = [
  ['#BF5AF2', '#6F2BBE'],  // Purple (Brand)
  ['#2F8CFF', '#1A5CCC'],  // Blue
  ['#46F5E0', '#1A8C7D'],  // Cyan
  ['#FF7A8A', '#CC3355'],  // Coral
  ['#D946EF', '#701A75'],  // Fuchsia
  ['#47E39A', '#1A8C55'],  // Green
  ['#FF9F0A', '#CC7000'],  // Orange
  ['#5E5CE6', '#32319E'],  // Indigo
];

/**
 * Deterministic hash for color selection
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  const val = str || 'aura';
  for (let i = 0; i < val.length; i++) {
    hash ^= val.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

/**
 * Get deterministic gradient for any name
 */
export function getDeterministicGradient(name: string): [string, string] {
  const hash = hashString(name);
  return ARTWORK_GRADIENTS[hash % ARTWORK_GRADIENTS.length];
}

/**
 * Extract initials from a name (max 2 chars)
 */
export function getInitials(name: string): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Centralized Artwork Resolver
 * 
 * Implements Rule 1 & 4 from Sprint 16.0 audit:
 * 1. Never return empty strings/nulls.
 * 2. Prioritize high-quality remote assets.
 * 3. Fallback to deterministic placeholders.
 * 4. Transparently rehydrate from local cache and catalog when metadata is sparse.
 */
export function resolveArtwork(entity: any, size: ArtworkSize = 'album'): string {
  if (!entity) {
    return `aura://generated?name=Aura&type=song&size=${size}`;
  }

  // 1. Direct resolution from entity object
  let url = getArtworkUrl(entity, size);
  
  if (url && url.length > 0 && !url.includes('placeholder')) {
    return url;
  }

  // 2. Rehydrate from local cache / catalog if entity has an ID
  const candidateId = entity.id;
  if (candidateId) {
    // A. Check Media Cache Store
    try {
      const { useMediaCacheStore } = require("../../cache/store/media-cache.store");
      const cached = useMediaCacheStore.getState().getCachedTrack(candidateId);
      if (cached?.track) {
        url = getArtworkUrl(cached.track, size);
      }
    } catch (e) {}



    // C. Check active player store queue / current track
    if (!url || url.length === 0 || url.includes('placeholder')) {
      try {
        const { usePlayerStore } = require("../store/player.store");
        const playerState = usePlayerStore.getState();
        const activeTrack = playerState.currentTrack?.id === candidateId
          ? playerState.currentTrack
          : playerState.queue.find((t: any) => t.id === candidateId);
        if (activeTrack) {
          url = getArtworkUrl(activeTrack, size);
        }
      } catch (e) {}
    }
  }

  // 3. Name-based lookup for artists and albums
  if (!url || url.length === 0 || url.includes('placeholder')) {
    const artistName = entity.artist || (entity.type === 'artist' ? (entity.name || entity.title) : null);
    const albumTitle = entity.album || (entity.type === 'album' ? (entity.title || entity.name) : null);
    
    // Check artist & album cache
    if (artistName) {
      try {
        const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
        const analytics = useAnalyticsStore.getState();
        const cachedArtist = analytics.artistCache?.[artistName] || analytics.artistProfileCache?.[artistName];
        if (cachedArtist?.image) {
          url = getArtworkUrl(cachedArtist.image, size);
        }
      } catch (e) {}
    }

    if (!url && albumTitle) {
      try {
        const { useAnalyticsStore } = require("../../analytics/store/analytics.store");
        const analytics = useAnalyticsStore.getState();
        const cleanTitle = albumTitle.toLowerCase().trim();
        const cachedAlbum = analytics.albumCache?.[albumTitle];
        if (cachedAlbum?.image && !cachedAlbum.image.includes('placeholder')) {
          url = getArtworkUrl(cachedAlbum.image, size);
        }
        if (!url) {
          const histMatch = analytics.history?.find((h: any) => 
            (h.album && h.album.toLowerCase().trim() === cleanTitle) ||
            (h.trackSnapshot?.album && h.trackSnapshot.album.toLowerCase().trim() === cleanTitle) ||
            (h.title && h.title.toLowerCase().trim() === cleanTitle)
          );
          const histArt = histMatch?.art || histMatch?.artwork || histMatch?.trackSnapshot?.art;
          if (histArt && !histArt.includes('placeholder')) {
            url = getArtworkUrl(histArt, size);
          }
        }
      } catch (e) {}
    }

    // Check catalog artists & albums by name
    if (!url || url.length === 0 || url.includes('placeholder')) {
      try {
        const { catalogAlbums, catalogArtists, catalogTracks } = require("../../../data/music-catalog");
        if (artistName) {
          const catArtist = catalogArtists.find((a: any) => a.name.toLowerCase() === artistName.toLowerCase());
          if (catArtist?.image) url = getArtworkUrl(catArtist, size);
        }
        if (!url && albumTitle) {
          const catAlbum = catalogAlbums.find((a: any) => a.title.toLowerCase() === albumTitle.toLowerCase());
          if (catAlbum?.image) url = getArtworkUrl(catAlbum, size);
        }
        if (!url && (artistName || albumTitle)) {
          const catTrack = catalogTracks.find((t: any) => 
            (artistName && t.artist.toLowerCase() === artistName.toLowerCase()) ||
            (albumTitle && t.album?.toLowerCase() === albumTitle.toLowerCase())
          );
          if (catTrack?.art) url = getArtworkUrl(catTrack, size);
        }
      } catch (e) {}
    }
  }

  if (url && url.length > 0 && !url.includes('placeholder')) {
    return url;
  }

  // If no valid URL, return a protocol-based URI for our custom components to handle
  // format: aura://generated?name=NAME&type=TYPE
  const name = entity.title || entity.name || entity.artist || (typeof entity === 'string' ? entity : 'Aura');
  const type = entity.type || 'song';
  
  return `aura://generated?name=${encodeURIComponent(name)}&type=${type}&size=${size}`;
}


export function isGeneratedArtwork(url: string): boolean {
  return url?.startsWith('aura://generated');
}

export function parseGeneratedArtwork(url: string) {
  if (!isGeneratedArtwork(url)) return null;
  
  const params = new URLSearchParams(url.replace('aura://generated?', ''));
  return {
    name: params.get('name') || 'Aura',
    type: params.get('type') || 'song',
    size: params.get('size') || 'album',
  };
}

