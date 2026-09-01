/**
 * Deterministic Intent Classifier
 * Accurately detects whether a query is aimed at:
 * SONG, ARTIST, ALBUM, PLAYLIST, ARTIST_SONG, ARTIST_ALBUM, SONG_MODIFIER, GENRE_DISCOVERY, MOOD_DISCOVERY, ACTIVITY_DISCOVERY, AMBIGUOUS.
 */

import { SearchIntent, SearchIntentType } from '../types/search-engine.types';
import { normalizeQuery, MODIFIER_PATTERNS } from './query-normalizer';

const GENRE_DISCOVERY_TERMS = new Set([
  'lofi', 'lo-fi', 'sad', 'sad songs', 'happy', 'workout', 'gym', 'party', 'chill',
  'relax', 'study', 'focus', 'sleep', 'romantic', 'bollywood', 'punjabi', 'malayalam',
  'tamil', 'hindi', 'kpop', 'hip hop', 'hiphop', 'rap', 'rock', 'pop', 'edm',
  'classical', 'jazz', 'blues', 'indie', 'acoustic songs', 'gaming', 'motivation',
  'meditation', 'ambient', 'instrumental music', 'retro', '90s', '80s', '2000s'
]);

const AMBIGUOUS_WORDS = new Set([
  'star', 'home', 'love', 'one', 'fire', 'sky', 'night', 'sun', 'you', 'me', 'us',
  'free', 'run', 'time', 'stay', 'hold', 'away', 'shine', 'rain', 'dream', 'world'
]);

export function classifySearchIntent(rawQuery: string): SearchIntent {
  const norm = normalizeQuery(rawQuery);
  const clean = norm.clean;
  const tokens = norm.tokens;

  const modifiers = norm.modifiers;
  const discoveryTerms: string[] = [];

  // Check discovery terms
  GENRE_DISCOVERY_TERMS.forEach(term => {
    if (clean === term || clean.includes(term)) {
      discoveryTerms.push(term);
    }
  });

  // 1. Discovery / Mood Intent
  if (discoveryTerms.length > 0) {
    let dType: SearchIntentType = 'GENRE_DISCOVERY';
    if (/workout|gym|party|study|focus|sleep|meditation/i.test(clean)) {
      dType = 'ACTIVITY_DISCOVERY';
    } else if (/sad|happy|chill|relax|romantic|motivation/i.test(clean)) {
      dType = 'MOOD_DISCOVERY';
    }
    return {
      type: dType,
      confidence: 0.92,
      normalizedQuery: clean,
      modifiers,
      discoveryTerms
    };
  }

  // 2. Modifiers present -> SONG_MODIFIER
  if (modifiers.length > 0) {
    return {
      type: 'SONG_MODIFIER',
      confidence: 0.90,
      normalizedQuery: clean,
      modifiers,
      discoveryTerms
    };
  }

  // 3. Ambiguous 1-word queries
  if (tokens.length === 1 && AMBIGUOUS_WORDS.has(tokens[0])) {
    return {
      type: 'AMBIGUOUS',
      confidence: 0.50,
      normalizedQuery: clean,
      modifiers: [],
      discoveryTerms: []
    };
  }

  // 4. Multi-token structure analysis (e.g. "The Weeknd After Hours", "Blinding Lights The Weeknd")
  // Notice: We don't guess blindly without candidate signals.
  // When tokens >= 3 and contains common separators or combinations:
  if (tokens.length >= 3) {
    return {
      type: 'ARTIST_SONG',
      confidence: 0.75,
      normalizedQuery: clean,
      modifiers,
      discoveryTerms
    };
  }

  // 5. Default Song/Artist general query
  return {
    type: 'SONG',
    confidence: 0.80,
    normalizedQuery: clean,
    modifiers,
    discoveryTerms
  };
}
