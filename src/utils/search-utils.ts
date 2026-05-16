export interface SearchEntity {
  type: 'song' | 'artist' | 'album' | 'playlist';
  id: string;
  title: string;
  artist?: string;
  art?: string;
  thumbnail?: string;
  duration?: string;
  year?: string;
  subscribers?: string;
  trackCount?: number;
  itemCount?: number;
  source?: string;
}

export interface UnifiedSearchResult {
  songs: SearchEntity[];
  artists: SearchEntity[];
  albums: SearchEntity[];
  playlists: SearchEntity[];
  query: string;
}

// Normalize string for comparison
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '');
}

// Check exact match
export function isExactMatch(query: string, target: string): boolean {
  return normalizeString(query) === normalizeString(target);
}

// Check starts with match
export function isStartsWithMatch(query: string, target: string): boolean {
  const normalizedQuery = normalizeString(query);
  const normalizedTarget = normalizeString(target);
  return normalizedTarget.startsWith(normalizedQuery);
}

// Calculate relevance score
export function calculateRelevanceScore(query: string, entity: SearchEntity): number {
  const normalizedQuery = normalizeString(query);
  let score = 0;

  // Exact title match - highest priority
  if (isExactMatch(query, entity.title)) {
    score += 1000;
  }
  // Starts with match
  else if (isStartsWithMatch(query, entity.title)) {
    score += 500;
  }
  // Contains match
  else if (normalizeString(entity.title).includes(normalizedQuery)) {
    score += 200;
  }

  // Artist name match
  if (entity.artist) {
    if (isExactMatch(query, entity.artist)) {
      score += 400;
    } else if (isStartsWithMatch(query, entity.artist)) {
      score += 300;
    } else if (normalizeString(entity.artist).includes(normalizedQuery)) {
      score += 150;
    }
  }

  // Type-specific bonuses
  if (entity.type === 'artist') {
    score += 50; // Artists slightly prioritized
  }

  return score;
}

// Sort entities by relevance
export function sortByRelevance<T extends SearchEntity>(query: string, entities: T[]): T[] {
  return [...entities].sort((a, b) => {
    const scoreA = calculateRelevanceScore(query, a);
    const scoreB = calculateRelevanceScore(query, b);
    return scoreB - scoreA;
  });
}

// Get best match for top result - ONLY SONGS
export function getTopResult(query: string, results: UnifiedSearchResult): SearchEntity | null {
  // TOP RESULT IS ONLY ALLOWED TO BE A SONG
  // Artists, albums, playlists are shown in their respective sections only
  const songsOnly = results.songs;

  if (songsOnly.length === 0) {
    return null;
  }

  const sorted = sortByRelevance(query, songsOnly);
  return sorted.length > 0 ? sorted[0] : null;
}

// Extract highest quality thumbnail
export function getBestThumbnail(thumbnails?: { url: string; width?: number; height?: number }[]): string | undefined {
  if (!thumbnails || thumbnails.length === 0) return undefined;
  
  // Sort by width/height and get largest
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url;
}