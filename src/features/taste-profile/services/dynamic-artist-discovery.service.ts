/**
 * AuraMusic — Dynamic Artist Discovery Service
 *
 * Discovers and curates artist suggestions dynamically from YouTube Music
 * based on the user's selected languages and music genres/vibes.
 * Uses the canonical music taxonomy as a rock-solid offline fallback and anchor.
 */

import { OnboardingArtist } from '../types/taste-profile';
import {
  MUSIC_LANGUAGES,
  MUSIC_GENRES,
  getCuratedArtistSuggestions,
} from '@/src/data/music-taxonomy';
import { musicService } from '@/src/services/api/music';

// In-memory cache for the session to prevent redundant network fetches
const discoveryCache = new Map<string, OnboardingArtist[]>();

export class DynamicArtistDiscoveryService {
  /**
   * Generates a stable cache key for language and genre selections
   */
  private static getCacheKey(languages: string[], genres: string[]): string {
    const sortedLangs = [...languages].sort().join(',');
    const sortedGenres = [...genres].sort().join(',');
    return `${sortedLangs}__${sortedGenres}`;
  }

  /**
   * Builds targeted YouTube Music artist search queries based on user preferences
   */
  private static buildDiscoveryQueries(languages: string[], genres: string[]): string[] {
    const queries: string[] = [];

    const langNames = languages
      .map(id => MUSIC_LANGUAGES.find(l => l.id.toLowerCase() === id.toLowerCase())?.name || id)
      .filter(Boolean);

    const genreObjects = genres
      .map(id => MUSIC_GENRES.find(g => g.id.toLowerCase() === id.toLowerCase()))
      .filter(Boolean);

    // 1. Language-focused artist queries (up to 3)
    for (const lang of langNames.slice(0, 3)) {
      if (lang.toLowerCase() === 'english') {
        queries.push('Top Pop Artists');
        queries.push('Global Top Artists');
      } else if (lang.toLowerCase() === 'hindi') {
        queries.push('Top Hindi Artists');
        queries.push('Bollywood Singers');
      } else if (lang.toLowerCase() === 'k-pop' || lang.toLowerCase() === 'korean') {
        queries.push('Top K-Pop Artists');
      } else {
        queries.push(`Top ${lang} Artists`);
      }
    }

    // 2. Genre-focused artist queries (up to 3)
    for (const g of genreObjects.slice(0, 3)) {
      if (g) {
        const cleanName = g.name.replace('&', '').replace('Hits', '').trim();
        if (cleanName.toLowerCase() === 'bollywood film') {
          queries.push('Bollywood Singers');
        } else if (cleanName.toLowerCase() === 'devotional ambient') {
          queries.push('Devotional Ambient Singers');
        } else {
          queries.push(`${cleanName} Artists`);
        }
      }
    }

    // 3. Cross-pollinated queries (e.g. Punjabi + Hip-Hop, Hindi + Pop)
    if (langNames.length > 0 && genreObjects.length > 0) {
      const topLang = langNames[0];
      const topGenre = genreObjects[0]!.name.replace('&', '').replace('Hits', '').trim();
      if (topLang.toLowerCase() !== 'english' || topGenre.toLowerCase() !== 'pop') {
        queries.push(`${topLang} ${topGenre} Artists`);
      }
    }

    // Deduplicate queries and cap to 5 parallel searches
    return Array.from(new Set(queries)).slice(0, 5);
  }

  /**
   * Sanitizes artist display names returned from YouTube Music
   */
  private static sanitizeArtistName(rawName: string): string {
    if (!rawName) return '';
    return rawName
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*\(Official\)$/i, '')
      .replace(/\s*\(VEVO\)$/i, '')
      .replace(/\s*VEVO$/i, '')
      .trim();
  }

  /**
   * Fetches dynamic artist suggestions based on user-selected languages and genres.
   * Blends dynamic YouTube Music results with curated anchors and ensures 3-column completeness.
   */
  public static async discoverArtists(
    languages: string[],
    genres: string[]
  ): Promise<OnboardingArtist[]> {
    const cacheKey = this.getCacheKey(languages, genres);
    const cached = discoveryCache.get(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    const curatedAnchor = getCuratedArtistSuggestions(languages, genres);

    try {
      const queries = this.buildDiscoveryQueries(languages, genres);
      if (queries.length === 0) {
        return curatedAnchor;
      }

      // Execute queries with individual timeouts so one slow request does not hang all
      const queryPromises = queries.map(query =>
        Promise.race([
          musicService.searchArtists(query),
          new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error('Search query timeout')), 5000)
          ),
        ]).catch(err => {
          console.warn(`[DynamicArtistDiscovery] Query "${query}" failed or timed out:`, err?.message || err);
          return [];
        })
      );

      const searchOutputs = await Promise.all(queryPromises);

      // Collect and normalize all dynamic artists
      const dynamicList: OnboardingArtist[] = [];
      const seenNames = new Set<string>();
      const seenIds = new Set<string>();

      // Pre-seed seen with curated names for canonical matching
      const curatedMap = new Map<string, OnboardingArtist>();
      for (const c of curatedAnchor) {
        curatedMap.set(c.name.toLowerCase().trim(), c);
      }

      for (const list of searchOutputs) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          if (!item || !item.title) continue;
          const cleanName = this.sanitizeArtistName(item.title);
          if (!cleanName || cleanName.length < 2) continue;

          const normKey = cleanName.toLowerCase().trim();
          if (seenNames.has(normKey) || (item.id && seenIds.has(item.id))) {
            continue;
          }

          seenNames.add(normKey);
          if (item.id) seenIds.add(item.id);

          // If this artist exists in curated list, leverage verified high-res artwork
          const curatedMatch = curatedMap.get(normKey);
          const artworkUrl = curatedMatch?.artworkUrl || item.art || undefined;

          dynamicList.push({
            id: item.id || curatedMatch?.id || `dynamic_${normKey}`,
            name: cleanName,
            artworkUrl,
            source: 'dynamic',
          });
        }
      }

      // Interleave dynamic discovered artists with high-scoring curated anchors
      const finalBlended: OnboardingArtist[] = [];
      const blendedSeen = new Set<string>();

      // 1. First add top curated anchors (up to 6) matching user taste for rock-solid quality
      for (const anchor of curatedAnchor.slice(0, 6)) {
        const k = anchor.name.toLowerCase().trim();
        if (!blendedSeen.has(k)) {
          blendedSeen.add(k);
          finalBlended.push(anchor);
        }
      }

      // 2. Add dynamically discovered artists
      for (const dynamic of dynamicList) {
        const k = dynamic.name.toLowerCase().trim();
        if (!blendedSeen.has(k)) {
          blendedSeen.add(k);
          finalBlended.push(dynamic);
        }
        if (finalBlended.length >= 24) break;
      }

      // 3. Backfill from curated pool if fewer than 18 artists (to keep 3-column grid filled)
      if (finalBlended.length < 18) {
        for (const fallback of curatedAnchor) {
          const k = fallback.name.toLowerCase().trim();
          if (!blendedSeen.has(k)) {
            blendedSeen.add(k);
            finalBlended.push(fallback);
            if (finalBlended.length >= 18) break;
          }
        }
      }

      // 4. Ensure total count is a multiple of 3 for the 3-column layout
      const remainder = finalBlended.length % 3;
      const finalCount = remainder === 0 ? finalBlended.length : finalBlended.length - remainder;
      const result = finalBlended.slice(0, finalCount);

      if (result.length > 0) {
        discoveryCache.set(cacheKey, result);
        return result;
      }

      return curatedAnchor;
    } catch (error) {
      console.warn('[DynamicArtistDiscovery] Error during discovery, using curated fallback:', error);
      return curatedAnchor;
    }
  }

  /**
   * Clears the in-memory cache
   */
  public static clearCache(): void {
    discoveryCache.clear();
  }
}
