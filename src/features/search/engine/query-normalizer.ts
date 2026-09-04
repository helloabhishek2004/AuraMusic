/**
 * Query & Title Normalizer
 * Normalizes text for matching while carefully preserving meaningful version modifiers.
 */

const NOISE_WORDS = new Set([
  'official', 'video', 'audio', 'music', 'hd', 'hq', '4k', 'lyrics', 'lyric', 'full',
  'song', 'tracks', 'track', 'album', 'visualizer', 'topic', 'vevo',
  'feat', 'ft', 'featuring', 'remaster', 'remastered', 'deluxe'
]);

export interface NormalizedResult {
  raw: string;
  clean: string;
  tokens: string[];
  modifiers: string[];
  isExplicitModifier: boolean;
}

export const MODIFIER_PATTERNS = [
  { key: 'remix', regex: /\b(remix|vip|club mix|extended mix|dub mix)\b/i },
  { key: 'live', regex: /\b(live|concert|tour|unplugged|sofi|wembley|acoustic live)\b/i },
  { key: 'acoustic', regex: /\b(acoustic|unplugged|stripped|piano version)\b/i },
  { key: 'instrumental', regex: /\b(instrumental|karaoke|backing track|minus one)\b/i },
  { key: 'slowed', regex: /\b(slowed|reverb|slowed\s*\+\s*reverb|chopped)\b/i },
  { key: 'sped_up', regex: /\b(sped\s*up|speed\s*up|nightcore|fast)\b/i },
  { key: 'cover', regex: /\b(cover|tribute|rendition)\b/i },
];

export function normalizeQuery(text: string): NormalizedResult {
  if (!text) {
    return { raw: '', clean: '', tokens: [], modifiers: [], isExplicitModifier: false };
  }

  const raw = text.trim();
  
  // Detect version modifiers
  const modifiers: string[] = [];
  MODIFIER_PATTERNS.forEach(m => {
    if (m.regex.test(raw)) {
      modifiers.push(m.key);
    }
  });

  // Strip punctuation & brackets but keep words, and strip noise words
  let clean = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/\b(feat\.|featuring|ft\.)\b/gi, ' ')
    .replace(/\b(remaster(ed)?|deluxe(\s+edition)?)\b/gi, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[-_–—]/g, ' ')
    .replace(/['"’`]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract tokens
  const allTokens = clean.split(' ').filter(t => t.length > 0);
  
  // Filter out pure noise words unless query is very short
  const tokens = allTokens.length > 1
    ? allTokens.filter(t => !NOISE_WORDS.has(t))
    : allTokens;

  return {
    raw,
    clean,
    tokens: tokens.length > 0 ? tokens : allTokens,
    modifiers,
    isExplicitModifier: modifiers.length > 0
  };
}

export function detectVersionType(title: string, subtitle?: string): 'canonical' | 'live' | 'remix' | 'acoustic' | 'instrumental' | 'cover' | 'slowed' | 'sped_up' | 'video' {
  const combined = `${title} ${subtitle || ''}`.toLowerCase();
  
  if (/\b(remix|vip|club mix)\b/i.test(combined)) return 'remix';
  if (/\b(live|concert|tour)\b/i.test(combined)) return 'live';
  if (/\b(acoustic|stripped)\b/i.test(combined)) return 'acoustic';
  if (/\b(instrumental|karaoke)\b/i.test(combined)) return 'instrumental';
  if (/\b(slowed|reverb)\b/i.test(combined)) return 'slowed';
  if (/\b(sped\s*up|nightcore)\b/i.test(combined)) return 'sped_up';
  if (/\b(cover)\b/i.test(combined)) return 'cover';
  if (/\b(official\s*video|music\s*video)\b/i.test(combined)) return 'video';
  
  return 'canonical';
}

export function calculateJaroWinkler(s1: string, s2: string): number {
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
