/**
 * Search Result Deduplicator & Version Resolver
 * Deduplicates identical re-uploads while strictly preserving intentional variants
 * (Remix, Live, Acoustic, Instrumental, Cover).
 */

import { SearchEntity } from '../types/search-engine.types';
import { normalizeQuery, detectVersionType } from './query-normalizer';

export function deduplicateSearchResults(results: SearchEntity[]): SearchEntity[] {
  const seenIdentities = new Map<string, SearchEntity>();
  const output: SearchEntity[] = [];

  for (const item of results) {
    const vType = item.versionType || detectVersionType(item.title, item.subtitle);
    item.versionType = vType;

    const normTitle = normalizeQuery(item.title).clean;
    const normArtist = normalizeQuery(item.artistName || '').clean;

    // Distinct identity key
    // Canonical songs from the same artist with identical title are grouped.
    // Different versionTypes (remix, live, acoustic) get UNIQUE keys!
    let key = '';
    if (item.type === 'ARTIST') {
      key = `artist:${item.browseId || normTitle}`;
    } else if (item.type === 'ALBUM') {
      key = `album:${item.browseId || `${normTitle}:${normArtist}`}`;
    } else if (item.type === 'PLAYLIST') {
      key = `playlist:${item.browseId || item.id || normTitle}`;
    } else {
      // SONG / VIDEO
      key = `song:${normTitle}:${normArtist}:${vType}`;
    }

    const existing = seenIdentities.get(key);
    if (!existing) {
      seenIdentities.set(key, item);
      output.push(item);
    } else {
      // If new item is official SONG and existing was a generic VIDEO, replace with official SONG!
      if (existing.type === 'VIDEO' && item.type === 'SONG') {
        const idx = output.indexOf(existing);
        if (idx !== -1) {
          output[idx] = item;
          seenIdentities.set(key, item);
        }
      }
    }
  }

  return output;
}
