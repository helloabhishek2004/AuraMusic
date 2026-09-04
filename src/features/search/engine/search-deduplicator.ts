/**
 * Search Result Deduplicator & Version Resolver
 * Deduplicates identical re-uploads while strictly preserving intentional variants
 * (Remix, Live, Acoustic, Instrumental, Cover).
 */

import { SearchEntity } from '../types/search-engine.types';
import { normalizeQuery, detectVersionType } from './query-normalizer';

function getPrimaryArtist(artistName: string): string {
  if (!artistName) return '';
  const primary = artistName.split(/[,&/xX]|\b(feat|featuring|ft|with)\b/i)[0];
  return normalizeQuery(primary).clean;
}

function getEntityPriority(item: SearchEntity): number {
  let p = 0;
  if (item.sourceRank === 1) p += 50; // Local download priority
  if (item.type === 'SONG') p += 20;
  if (item.musicVideoType === 'MUSIC_VIDEO_TYPE_ATV') p += 40;
  else if (item.musicVideoType === 'MUSIC_VIDEO_TYPE_OMV' || item.musicVideoType === 'MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC_VIDEO') p += 20;
  else if (item.musicVideoType === 'MUSIC_VIDEO_TYPE_UGC') p -= 15;
  if (item.isOfficial) p += 10;
  return p;
}

export function deduplicateSearchResults(results: SearchEntity[]): SearchEntity[] {
  const seenIdentities = new Map<string, SearchEntity>();
  const output: SearchEntity[] = [];

  for (const item of results) {
    const vType = item.versionType || detectVersionType(item.title, item.subtitle);
    item.versionType = vType;

    const normTitle = normalizeQuery(item.title).clean;
    const primaryArtist = getPrimaryArtist(item.artistName || '');

    // Distinct identity key
    // Canonical songs from the same artist with identical title are grouped.
    // Different versionTypes (remix, live, acoustic) get UNIQUE keys!
    let key = '';
    if (item.type === 'ARTIST') {
      key = `artist:${item.browseId || normTitle}`;
    } else if (item.type === 'ALBUM') {
      key = `album:${item.browseId || `${normTitle}:${primaryArtist}`}`;
    } else if (item.type === 'PLAYLIST') {
      key = `playlist:${item.browseId || item.id || normTitle}`;
    } else {
      // SONG / VIDEO
      key = `song:${normTitle}:${primaryArtist}:${vType}`;
    }

    const existing = seenIdentities.get(key);
    if (!existing) {
      seenIdentities.set(key, item);
      output.push(item);
    } else {
      // If new item has higher quality / official status, replace lower quality version
      if (getEntityPriority(item) > getEntityPriority(existing)) {
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
