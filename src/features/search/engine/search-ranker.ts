/**
 * Multi-Signal Ranking Engine
 * Computes deterministic scores for all candidates across:
 * - Text Relevance (Exact, Token, Fuzzy similarity)
 * - Intent Matching (Boosts entity type that satisfies detected user intent)
 * - Version / Modifier Relevance (Boosts requested modifier, penalizes mismatch)
 * - Music Quality Signals (Official Audio > Music Video > UGC)
 * - Local Personalization (Room DB plays, Likes, Downloads)
 */

import { SearchEntity, SearchIntent, RankedSearchResult, SectionOrdering } from '../types/search-engine.types';
import { normalizeQuery } from './query-normalizer';

export interface PersonalizationContext {
  likedTrackIds: Set<string>;
  downloadedTrackIds: Set<string>;
  playedTrackCounts: Map<string, number>; // trackId -> playCount
  topArtists: Set<string>; // normalized artist names with frequent plays
}

function calculateJaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const maxDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const match1 = new Array(s1.length).fill(false);
  const match2 = new Array(s2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (match2[j] || s1[i] !== s2[j]) continue;
      match1[i] = true;
      match2[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!match1[i]) continue;
    while (!match2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const sim = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3.0;
  
  // Winkler prefix boost (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return sim + prefix * 0.1 * (1.0 - sim);
}

export function rankSearchResults(
  entities: SearchEntity[],
  query: string,
  intent: SearchIntent,
  personalization?: PersonalizationContext
): RankedSearchResult[] {
  const normQuery = normalizeQuery(query);
  const qClean = normQuery.clean;
  const qTokens = normQuery.tokens;

  const ranked: RankedSearchResult[] = entities.map((item, index) => {
    const normTitle = normalizeQuery(item.title).clean;
    const normArtist = normalizeQuery(item.artistName || '').clean;
    const normAlbum = normalizeQuery(item.albumName || '').clean;

    let textRelevance = 0;
    let intentMatch = 0;
    let modifierMatch = 0;
    let quality = 0;
    let personalScore = 0;
    let penalties = 0;

    // ── 1. Text Relevance (0 – 100) ─────────────────────────
    if (normTitle === qClean || normArtist === qClean || normAlbum === qClean) {
      textRelevance += 95; // Exact Match
    } else if (normTitle.startsWith(qClean) || normArtist.startsWith(qClean)) {
      textRelevance += 80; // Prefix Match
    } else {
      // Token overlap
      const itemTokens = `${normTitle} ${normArtist} ${normAlbum}`.split(' ').filter(t => t.length > 0);
      let matchedTokens = 0;
      qTokens.forEach(qt => {
        if (itemTokens.some(it => it.includes(qt) || calculateJaroWinkler(it, qt) > 0.85)) {
          matchedTokens++;
        }
      });
      const tokenRatio = qTokens.length > 0 ? matchedTokens / qTokens.length : 0;
      const jaro = calculateJaroWinkler(normTitle, qClean);
      textRelevance += tokenRatio * 50 + jaro * 35;
    }

    // ── 2. Intent Match Boost (0 – 50) ─────────────────────
    switch (intent.type) {
      case 'ARTIST':
        if (item.type === 'ARTIST') intentMatch += 50;
        else if (item.type === 'SONG') intentMatch += 15;
        else if (item.type === 'ALBUM') intentMatch += 12;
        break;
      case 'ALBUM':
        if (item.type === 'ALBUM') intentMatch += 50;
        else if (item.type === 'SONG') intentMatch += 15;
        else if (item.type === 'ARTIST') intentMatch += 10;
        break;
      case 'PLAYLIST':
      case 'GENRE_DISCOVERY':
      case 'MOOD_DISCOVERY':
      case 'ACTIVITY_DISCOVERY':
        if (item.type === 'PLAYLIST') intentMatch += 45;
        else if (item.type === 'SONG') intentMatch += 30;
        else if (item.type === 'ALBUM') intentMatch += 20;
        break;
      case 'ARTIST_SONG':
        if (item.type === 'SONG' && normArtist.length > 0) intentMatch += 45;
        else if (item.type === 'ALBUM') intentMatch += 20;
        else if (item.type === 'ARTIST') intentMatch += 15;
        break;
      case 'SONG_MODIFIER':
      case 'SONG':
      default:
        if (item.type === 'SONG') intentMatch += 45;
        else if (item.type === 'ARTIST') intentMatch += 15;
        else if (item.type === 'ALBUM') intentMatch += 12;
        else if (item.type === 'PLAYLIST') intentMatch += 8;
        break;
    }

    // ── 3. Modifier Matching & Penalties ────────────────────
    if (intent.modifiers.length > 0) {
      const vType = item.versionType || 'canonical';
      const hasMatchingModifier = intent.modifiers.some(m => m === vType);
      if (hasMatchingModifier) {
        modifierMatch += 40; // Strongly boost requested version
      } else if (vType === 'canonical') {
        penalties += 20; // Mild penalty for canonical if user specifically asked for remix/live
      } else {
        penalties += 35; // Strong penalty for wrong alternate version
      }
    } else {
      // Query had NO modifier: prefer canonical over live/remix/cover/video!
      if (item.versionType === 'canonical') {
        quality += 15;
      } else if (item.versionType === 'video') {
        penalties += 10;
      } else if (item.versionType === 'live' || item.versionType === 'remix') {
        penalties += 15;
      }
    }

    // ── 4. Quality Signals ──────────────────────────────────
    if (item.isOfficial) quality += 10;
    if (item.durationMs && item.durationMs > 30000 && item.durationMs < 900000) quality += 5; // Sanity duration 30s-15m
    if (item.subscribers && item.subscribers.includes('M')) quality += 8;

    // ── 5. Personalization Boost (Max +20, Secondary) ───────
    if (personalization) {
      if (personalization.likedTrackIds.has(item.id)) personalScore += 10;
      if (personalization.downloadedTrackIds.has(item.id)) personalScore += 8;
      const playCount = personalization.playedTrackCounts.get(item.id) || 0;
      if (playCount > 0) personalScore += Math.min(10, playCount * 2);
      if (normArtist && personalization.topArtists.has(normArtist)) personalScore += 6;
    }

    // Source order tie-breaker
    const sourceRankScore = Math.max(0, 15 - index);

    const finalScore = textRelevance + intentMatch + modifierMatch + quality + personalScore + sourceRankScore - penalties;

    return {
      ...item,
      score: Math.round(finalScore * 10) / 10,
      scoreBreakdown: {
        textRelevance,
        intentMatch,
        modifierMatch,
        quality,
        personalization: personalScore,
        penalties
      }
    };
  });

  // Sort descending by score
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

export function formatSearchSections(rankedItems: RankedSearchResult[], intent: SearchIntent): SectionOrdering {
  const songs: RankedSearchResult[] = [];
  const artists: RankedSearchResult[] = [];
  const albums: RankedSearchResult[] = [];
  const playlists: RankedSearchResult[] = [];
  const videos: RankedSearchResult[] = [];

  for (const item of rankedItems) {
    switch (item.type) {
      case 'SONG': songs.push(item); break;
      case 'ARTIST': artists.push(item); break;
      case 'ALBUM': albums.push(item); break;
      case 'PLAYLIST': playlists.push(item); break;
      case 'VIDEO': videos.push(item); break;
    }
  }

  // Determine top result dynamically!
  const topResult = rankedItems.length > 0 ? rankedItems[0] : null;

  // Determine dynamic section ordering based on intent
  let sectionOrder: Array<'topResult' | 'songs' | 'artists' | 'albums' | 'playlists' | 'videos'> = [
    'topResult', 'songs', 'artists', 'albums', 'playlists'
  ];

  switch (intent.type) {
    case 'ARTIST':
      sectionOrder = ['topResult', 'artists', 'songs', 'albums', 'playlists'];
      break;
    case 'ALBUM':
      sectionOrder = ['topResult', 'albums', 'songs', 'artists', 'playlists'];
      break;
    case 'PLAYLIST':
    case 'GENRE_DISCOVERY':
    case 'MOOD_DISCOVERY':
    case 'ACTIVITY_DISCOVERY':
      sectionOrder = ['topResult', 'playlists', 'songs', 'albums', 'artists'];
      break;
    case 'SONG':
    case 'ARTIST_SONG':
    case 'SONG_MODIFIER':
    default:
      sectionOrder = ['topResult', 'songs', 'artists', 'albums', 'playlists'];
      break;
  }

  return {
    topResult,
    songs: songs.slice(0, 15),
    artists: artists.slice(0, 8),
    albums: albums.slice(0, 8),
    playlists: playlists.slice(0, 6),
    videos: videos.slice(0, 6),
    sectionOrder
  };
}
