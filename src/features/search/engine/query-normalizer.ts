/**
 * Query & Title Normalizer
 * Normalizes text for matching while carefully preserving meaningful version modifiers.
 */

const NOISE_WORDS = new Set([
  'official', 'video', 'audio', 'music', 'hd', 'hq', '4k', 'lyrics', 'lyric', 'full',
  'song', 'tracks', 'track', 'album', 'visualizer', 'topic', 'vevo'
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

  // Strip punctuation & brackets but keep words
  let clean = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
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
