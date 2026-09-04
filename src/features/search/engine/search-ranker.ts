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
import { normalizeQuery, calculateJaroWinkler } from './query-normalizer';

export interface PersonalizationContext {
  likedTrackIds: Set<string>;
  downloadedTrackIds: Set<string>;
  playedTrackCounts: Map<string, number>; // trackId -> playCount
  topArtists: Set<string>; // normalized artist names with frequent plays
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

    // ── 4. Quality Signals & Non-Music Suppression ─────────
    const isAtv = item.musicVideoType === 'MUSIC_VIDEO_TYPE_ATV';
    const isOmv = item.musicVideoType === 'MUSIC_VIDEO_TYPE_OMV' || item.musicVideoType === 'MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC_VIDEO';
    const isUgc = item.musicVideoType === 'MUSIC_VIDEO_TYPE_UGC';
    const isPodcast = item.musicVideoType === 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE';
    const isTopic = (item.artistName || '').trim().endsWith('- Topic') || (item.subtitle || '').includes('- Topic');

    if (isAtv) quality += 35; // Studio Audio (Gold standard)
    if (isTopic) quality += 25; // Official Artist Channel Topic
    if (isOmv) quality += 15; // Official Music Video
    if (item.isOfficial && !isAtv && !isOmv && !isTopic) quality += 10;
    if (item.subscribers && item.subscribers.includes('M')) quality += 8;

    // Sanity duration 45s - 10m
    if (item.durationMs && item.durationMs >= 45000 && item.durationMs <= 600000) {
      quality += 5;
    } else if (item.durationMs && item.durationMs > 1200000 && item.type === 'SONG') {
      // > 20 mins for a song is usually an unseparated podcast, livestream, or full album upload
      penalties += 40;
    }

    // UGC penalty
    if (isUgc) penalties += 30;

    // Hard non-music suppression
    if (isPodcast) penalties += 100;
    if (/\b(podcast|gameplay|playthrough|reaction|vlog|highlights|news broadcast|unboxing)\b/i.test(`${item.title} ${item.subtitle || ''}`)) {
      penalties += 80;
    }

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

  // Filter out heavily penalized items (non-music, podcast episodes, gaming)
  const validRanked = rankedItems.filter(item => {
    if (item.musicVideoType === 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE') return false;
    if (item.score < -20) return false;
    return true;
  });

  for (const item of validRanked) {
    switch (item.type) {
      case 'SONG': songs.push(item); break;
      case 'ARTIST': artists.push(item); break;
      case 'ALBUM': albums.push(item); break;
      case 'PLAYLIST': playlists.push(item); break;
      case 'VIDEO': videos.push(item); break;
    }
  }

  // Determine top result dynamically from valid ranked items
  const topResult = validRanked.length > 0 ? validRanked[0] : null;

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
