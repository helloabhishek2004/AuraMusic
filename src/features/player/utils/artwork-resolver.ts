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
 */
export function resolveArtwork(entity: any, size: ArtworkSize = 'album'): string {
  if (!entity) {
    return `aura://generated?name=Aura&type=song&size=${size}`;
  }

  const url = getArtworkUrl(entity, size);
  
  if (url && url.length > 0 && !url.includes('placeholder')) {
    return url;
  }

  // If no valid URL, return a protocol-based URI for our custom components to handle
  // format: aura://generated?name=NAME&type=TYPE
  const name = entity.title || entity.name || entity.artist || 'Aura';
  const type = entity.type || (entity.artist ? 'artist' : 'song');
  
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
