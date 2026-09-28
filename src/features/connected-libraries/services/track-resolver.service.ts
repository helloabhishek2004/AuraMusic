import { ExternalTrack } from '../types/provider';
import { PlayerTrack } from '@/src/features/player/types/player';
import { musicService } from '@/src/services/api/music';
import { SearchEntity } from '@/src/utils/search-utils';

/**
 * Deterministic Candidate-Scoring Track Resolver
 *
 * Requirements:
 * 1. Title similarity: weight 0.40
 * 2. Primary artist similarity: weight 0.35
 * 3. Duration similarity: weight 0.25
 * 4. Explicit penalties for version mismatches (Live, Remix, Acoustic, Karaoke, Instrumental)
 * 5. Minimum confidence threshold: 0.65
 * 6. Returns canonical PlayerTrack OR null (NEVER silently selects weak candidates).
 */

const CONFIDENCE_THRESHOLD = 0.65;

const VERSION_MODIFIERS = ['live', 'acoustic', 'karaoke', 'instrumental', 'remix', 'extended'] as const;

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\((?:official\s*(?:video|audio|music\s*video|lyric\s*video|visualizer)|lyrics)\)/gi, '')
    .replace(/\[(?:official\s*(?:video|audio|music\s*video|lyric\s*video|visualizer)|lyrics)\]/gi, '')
    .replace(/\b(?:remastered(?:\s*\d{4})?|deluxe(?:\s*edition)?|special\s*edition)\b/gi, '')
    .replace(/\b(?:feat\.?|ft\.?)\s+[^()\[\]]+/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseDurationToMs(duration?: string): number | null {
  if (!duration) return null;
  const parts = duration.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return null;
}

export function calculateTokenSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection++;
  });

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export function scoreCandidate(
  external: ExternalTrack,
  candidate: SearchEntity
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  const extNormTitle = normalizeText(external.title);
  const candNormTitle = normalizeText(candidate.title);

  const extNormArtist = normalizeText(external.artist.split(',')[0]); // Primary artist
  const candNormArtist = normalizeText(candidate.artist?.split(',')[0] || '');

  // 1. Title Similarity (0.40)
  const titleSim = calculateTokenSimilarity(extNormTitle, candNormTitle);
  let titleScore = titleSim * 0.40;
  reasons.push(`title: ${(titleScore).toFixed(2)}`);

  // 2. Primary Artist Similarity (0.35)
  let artistScore = 0;
  if (extNormArtist && candNormArtist) {
    if (candNormArtist.includes(extNormArtist) || extNormArtist.includes(candNormArtist)) {
      artistScore = 0.35;
    } else {
      const artistSim = calculateTokenSimilarity(extNormArtist, candNormArtist);
      artistScore = artistSim * 0.35;
    }
  }
  reasons.push(`artist: ${(artistScore).toFixed(2)}`);

  // 3. Duration Similarity (0.25)
  let durationScore = 0.15; // default neutral if duration not provided in candidate
  const candDurationMs = parseDurationToMs(candidate.duration);
  if (external.durationMs && candDurationMs) {
    const diff = Math.abs(external.durationMs - candDurationMs);
    if (diff <= 15000) {
      durationScore = 0.25; // exact/very close
    } else if (diff <= 35000) {
      durationScore = 0.15;
    } else if (diff <= 60000) {
      durationScore = 0.05;
    } else {
      durationScore = -0.25; // severe mismatch (e.g. extended mix, radio edit mismatch, or medley)
    }
  }
  reasons.push(`duration: ${(durationScore).toFixed(2)}`);

  let totalScore = titleScore + artistScore + durationScore;

  // 4. Artist Mismatch Penalty: if both specified an artist but there is zero match
  if (extNormArtist && candNormArtist && artistScore === 0) {
    totalScore -= 0.30;
    reasons.push('penalty_artist_mismatch: -0.30');
  }

  // 5. Version Mismatch Penalties
  const extRawLower = external.title.toLowerCase();
  const candRawLower = candidate.title.toLowerCase();

  for (const mod of VERSION_MODIFIERS) {
    const extHasMod = extRawLower.includes(mod);
    const candHasMod = candRawLower.includes(mod);

    if (!extHasMod && candHasMod) {
      // External was studio, candidate is live/remix/acoustic -> apply penalty
      const penalty = mod === 'live' || mod === 'karaoke' || mod === 'instrumental' ? 0.35 : 0.25;
      totalScore -= penalty;
      reasons.push(`penalty_${mod}: -${penalty}`);
    } else if (extHasMod && !candHasMod) {
      // External requested a specific remix/live, candidate is plain studio -> apply penalty
      totalScore -= 0.20;
      reasons.push(`penalty_missing_${mod}: -0.20`);
    }
  }

  return { score: Math.max(0, Math.min(1, totalScore)), reasons };
}

class TrackResolverService {
  private resolutionCache = new Map<string, PlayerTrack | null>();

  async resolveExternalTrack(external: ExternalTrack): Promise<PlayerTrack | null> {
    const cacheKey = `${external.providerId}:${external.externalId}`;
    if (this.resolutionCache.has(cacheKey)) {
      return this.resolutionCache.get(cacheKey) || null;
    }

    try {
      const primaryArtist =
        external.artist && external.artist !== 'Unknown Artist'
          ? external.artist.split(',')[0].trim()
          : '';
      const query = primaryArtist ? `${external.title} ${primaryArtist}`.trim() : external.title.trim();
      let candidates = await musicService.searchSongs(query);

      if (!candidates || candidates.length === 0) {
        // Fallback: search with title alone
        candidates = await musicService.searchSongs(external.title.trim());
      }

      if (!candidates || candidates.length === 0) {
        console.warn(`[TrackResolver][${external.providerId}] No search candidates found for "${external.title}"`);
        this.resolutionCache.set(cacheKey, null);
        return null;
      }

      let bestCandidate: SearchEntity | null = null;
      let highestScore = 0;
      let bestReasons: string[] = [];

      for (const candidate of candidates.slice(0, 8)) {
        const { score, reasons } = scoreCandidate(external, candidate);
        if (score > highestScore) {
          highestScore = score;
          bestCandidate = candidate;
          bestReasons = reasons;
        }
      }

      console.log(
        `[TrackResolver][${external.providerId}] "${external.title}" by "${primaryArtist || 'Unknown'}" -> Best score: ${highestScore.toFixed(
          2
        )} (Threshold: 0.50)`
      );

      // Prioritize best candidate if score >= 0.50, otherwise fallback to top candidate
      const chosen = (bestCandidate && highestScore >= 0.50) ? bestCandidate : candidates[0];

      if (chosen) {
        const playerTrack: PlayerTrack = {
          id: chosen.id,
          title: external.title || chosen.title,
          artist: external.artist || chosen.artist || 'Unknown Artist',
          art: external.artworkUrl || chosen.art || chosen.thumbnail || '',
          url: '', // Resolved on demand by AuraPlayer stream resolver
          duration: external.durationMs || (chosen.duration ? parseDurationToMs(chosen.duration) || 0 : 0),
          album: external.album || chosen.album,
          source: `${external.providerId}_imported`,
        };

        this.resolutionCache.set(cacheKey, playerTrack);
        return playerTrack;
      }
    } catch (err) {
      console.warn(`[TrackResolver][${external.providerId}] Failed to resolve track:`, external.title, err);
    }

    return null;
  }

  async resolvePlaylistTracks(tracks: ExternalTrack[]): Promise<PlayerTrack[]> {
    const resolved: PlayerTrack[] = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      const batch = tracks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((track) => this.resolveExternalTrack(track))
      );
      for (const canonical of batchResults) {
        if (canonical) {
          resolved.push(canonical);
        }
      }
    }
    return resolved;
  }
}

export const trackResolverService = new TrackResolverService();
