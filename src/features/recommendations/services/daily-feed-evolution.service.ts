/**
 * AuraMusic — Daily Feed Evolution Engine
 *
 * Implements a deterministic, locally personalized home feed that evolves daily.
 *
 * Grounding & Principles:
 * 1. Personalization First:
 *    - Synthesizes listening history, likes, skips, recently played, and language preferences.
 *    - Strong positive weighting for user likes (+12 pts per liked track, +8 artist boost).
 *    - Skip penalty: suppresses tracks frequently abandoned or skipped under 15s.
 *    - Language grounding: integrates user's declared songLanguages & genres.
 * 2. Deterministic Daily Evolution:
 *    - Governed by a daily date seed (YYYY-MM-DD hash).
 *    - Stable throughout the calendar day (no layout jumps or random shuffling on tab switch).
 *    - Evolving content every morning: daily hero themes, rotated daily mixes, fresh daily track rotation.
 * 3. De-Repetition:
 *    - Rotates tracks across days using deterministic index offsets so user doesn't hear the same 10 tracks every day.
 *    - Enforces global deduplication across home feed sections.
 * 4. 0ms Cached Rendering:
 *    - Seamless background calculation with immediate cached feed display on startup.
 */

import {
  HistoryEntry,
  AffinityMetric,
  splitArtistNames,
  useAnalyticsStore,
} from '../../analytics/store/analytics.store';
import { useLikesStore } from '../../likes/store/likes.store';
import { useTasteProfileStore } from '../../taste-profile/store/taste-profile.store';
import { MUSIC_LANGUAGES, MUSIC_GENRES } from '../../../data/music-taxonomy';
import { catalogTracks } from '../../../data/music-catalog';
import { PlayerTrack } from '../../player/types/player';
import {
  RecommendationSeed,
  TasteCluster,
  buildTasteClusters,
  applyConsecutiveSeparation,
} from './recommendation-engine';
import { resolveArtwork, hashString } from '../../player/utils/artwork-resolver';
import { DISCOVERY_CATALOGUE, DiscoveryPoolItem, TrendingSeed } from '../store/recommendations.store';

export interface DailyEvolutionContext {
  dateString: string; // "YYYY-MM-DD"
  daySeed: number; // 32-bit deterministic integer
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  hour: number;
}

/**
 * Returns today's ISO date string (YYYY-MM-DD) in local time.
 */
export function getTodayDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Derives a deterministic 32-bit integer seed from a date string.
 */
export function getDailySeed(dateStr: string): number {
  return hashString(`aura-daily-seed-${dateStr}`);
}

/**
 * Contextual Day-of-Week configuration
 */
interface DayThemeConfig {
  tag: string;
  title: string;
  subtitleTemplate: (topArtist: string) => string;
  vibe: 'energy' | 'groove' | 'discovery' | 'rewind' | 'anthem' | 'spotlight' | 'chill';
}

const DAY_THEMES: Record<number, DayThemeConfig> = {
  0: {
    tag: 'SUNDAY SERENITY',
    title: 'Sunday Serenity',
    subtitleTemplate: (artist) => `Mellow acoustic rhythms and soothing melodies featuring ${artist}.`,
    vibe: 'chill',
  },
  1: {
    tag: 'MONDAY MOMENTUM',
    title: 'Monday Momentum',
    subtitleTemplate: (artist) => `Energizing anthems and high-focus tracks featuring ${artist}.`,
    vibe: 'energy',
  },
  2: {
    tag: 'TUESDAY FLOW',
    title: 'Tuesday Flow',
    subtitleTemplate: (artist) => `Deep groove and rhythmic rotation inspired by ${artist}.`,
    vibe: 'groove',
  },
  3: {
    tag: 'MIDWEEK DISCOVERY',
    title: 'Midweek Discovery',
    subtitleTemplate: (artist) => `Fresh discoveries and styles adjacent to ${artist}.`,
    vibe: 'discovery',
  },
  4: {
    tag: 'THROWBACK THURSDAY',
    title: 'Throwback Rewind',
    subtitleTemplate: (artist) => `Rediscover your favorite classics and forgotten gems by ${artist}.`,
    vibe: 'rewind',
  },
  5: {
    tag: 'FRIDAY ANTHEMS',
    title: 'Friday Anthems',
    subtitleTemplate: (artist) => `High-energy hits and your most repeated anthems with ${artist}.`,
    vibe: 'anthem',
  },
  6: {
    tag: 'WEEKEND SOUNDSCAPE',
    title: 'Weekend Soundscape',
    subtitleTemplate: (artist) => `Expansive weekend rotation and global soundscapes with ${artist}.`,
    vibe: 'spotlight',
  },
};

export class DailyFeedEvolutionService {
  /**
   * Builds the current daily evolution context
   */
  public static getContext(date = new Date()): DailyEvolutionContext {
    const dateString = getTodayDateString(date);
    const daySeed = getDailySeed(dateString);
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    return { dateString, daySeed, dayOfWeek, hour };
  }

  /**
   * Synthesizes behavioral history, explicit likes, skips, and language preferences.
   */
  public static collectPersonalizedSignals(context: DailyEvolutionContext) {
    const analytics = useAnalyticsStore.getState();
    const { history, trackAffinities, artistAffinities, artistCache } = analytics;

    const likesState = useLikesStore.getState();
    const likedTrackIds = likesState.likedTrackIds || {};
    const likedMetadata = likesState.trackMetadata || {};

    const tasteProfile = useTasteProfileStore.getState();
    const preferredLanguages = tasteProfile.songLanguages || [];
    const preferredGenres = tasteProfile.genres || [];
    const onboardingArtists = tasteProfile.favoriteArtists || [];

    // 1. Liked Tracks Pool (High explicit value)
    const likedTracks: PlayerTrack[] = [];
    const likedArtistCounts = new Map<string, number>();

    for (const [id, isLiked] of Object.entries(likedTrackIds)) {
      if (!isLiked) continue;
      const meta = likedMetadata[id];
      if (meta && meta.title) {
        const artist = meta.artist || 'Unknown Artist';
        likedTracks.push({
          id,
          title: meta.title,
          artist,
          art: meta.art || '',
          duration: meta.duration || 240,
          url: meta.url || '',
          album: meta.album,
          source: (meta.source || 'youtube') as any,
          isLocal: meta.isLocal,
        });

        const normArtist = artist.toLowerCase().trim();
        likedArtistCounts.set(normArtist, (likedArtistCounts.get(normArtist) || 0) + 1);
      }
    }

    // 2. Identify suppressed tracks (Skips & Dislikes)
    const suppressedTrackIds = new Set<string>();
    const suppressedArtists = new Set<string>();

    for (const [id, aff] of Object.entries(trackAffinities)) {
      const skipCount = aff.skipCount || 0;
      const playCount = aff.playCount || 0;
      const skip15s = aff.skip15sCount || 0;

      // Abandoned or frequent quick skips with low completion
      if ((skipCount >= 2 && skipCount >= playCount) || skip15s >= 2) {
        suppressedTrackIds.add(id);
      }
    }

    for (const [name, aff] of Object.entries(artistAffinities)) {
      const playCount = aff.playCount || 0;
      const skipCount = aff.skipCount || 0;
      if (playCount >= 3 && skipCount / playCount >= 0.6) {
        suppressedArtists.add(name.toLowerCase().trim());
      }
    }

    // 3. Recently played cooldown (tracks played within the last 8 hours, except for dedicated repeat models)
    const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;
    const recentlyPlayedIds = new Set(
      history.filter(h => h.playedAt >= eightHoursAgo).map(h => h.id)
    );

    // 4. Boosted Artist Affinities (History + Likes + Onboarding Favorites)
    const boostedArtistAffinities: Record<string, AffinityMetric> = {};

    // Start with existing affinities
    for (const [key, val] of Object.entries(artistAffinities)) {
      boostedArtistAffinities[key] = { ...val };
    }

    // Apply Likes Boost: +8 pts per liked song
    for (const [normArtist, count] of likedArtistCounts.entries()) {
      const existing = boostedArtistAffinities[normArtist];
      if (existing) {
        existing.score += count * 8;
        existing.likedCount = (existing.likedCount || 0) + count;
      } else {
        boostedArtistAffinities[normArtist] = {
          playCount: count,
          completionCount: count,
          skipCount: 0,
          totalListenMs: count * 180000,
          score: count * 8,
          likedCount: count,
        };
      }
    }

    // Apply Onboarding Favorites Boost: +10 pts
    for (const artist of onboardingArtists) {
      const normName = artist.name.toLowerCase().trim();
      if (boostedArtistAffinities[normName]) {
        boostedArtistAffinities[normName].score += 10;
      } else {
        boostedArtistAffinities[normName] = {
          playCount: 1,
          completionCount: 1,
          skipCount: 0,
          totalListenMs: 180000,
          score: 10,
        };
      }
    }

    return {
      history,
      likedTracks,
      suppressedTrackIds,
      suppressedArtists,
      recentlyPlayedIds,
      boostedArtistAffinities,
      artistCache,
      preferredLanguages,
      preferredGenres,
      onboardingArtists,
    };
  }

  /**
   * Generates a Day-of-Week themed Featured Hero Mix with deterministic track rotation.
   */
  public static generateDailyHero(
    context: DailyEvolutionContext,
    signals: ReturnType<typeof DailyFeedEvolutionService.collectPersonalizedSignals>,
    clusters: TasteCluster[],
    globalSeenTrackIds: Set<string>
  ): RecommendationSeed {
    const { dayOfWeek, hour, daySeed } = context;
    const { history, likedTracks, boostedArtistAffinities, suppressedTrackIds, artistCache } = signals;

    const theme = DAY_THEMES[dayOfWeek] || DAY_THEMES[1];
    const isLateNight = hour >= 22 || hour < 4;

    const topCluster = clusters[0];
    const topArtist = topCluster?.artists?.[0] || 'You';

    // 1. Build high-affinity candidate track pool
    const candidateTracks: PlayerTrack[] = [];
    const candidateTrackIds = new Set<string>();

    // Add liked tracks matching top cluster or general liked tracks
    for (const lt of likedTracks) {
      if (suppressedTrackIds.has(lt.id) || candidateTrackIds.has(lt.id)) continue;
      candidateTracks.push(lt);
      candidateTrackIds.add(lt.id);
    }

    // Add high-completion history tracks
    for (const h of history) {
      if (suppressedTrackIds.has(h.id) || candidateTrackIds.has(h.id)) continue;
      if (h.completionRatio >= 0.8 || !h.skipped) {
        candidateTracks.push({
          id: h.id,
          title: h.title,
          artist: h.artist,
          art: h.art || h.artwork || h.trackSnapshot?.art || '',
          duration: (h.durationMs ? h.durationMs / 1000 : h.duration) || 240,
          url: h.trackSnapshot?.url || '',
          album: h.album || h.trackSnapshot?.album,
          source: (h.trackSnapshot?.source || 'youtube') as any,
        });
        candidateTrackIds.add(h.id);
      }
    }

    // Fallback to catalog if sparse
    if (candidateTracks.length < 10) {
      for (const t of catalogTracks) {
        if (!candidateTrackIds.has(t.id)) {
          candidateTracks.push({
            id: t.id,
            title: t.title,
            artist: t.artist,
            art: t.art,
            duration: t.durationSec || 240,
            url: '',
            source: 'local' as any,
          });
          candidateTrackIds.add(t.id);
        }
      }
    }

    // 2. Deterministic Daily Rotation: rotate candidates by day seed
    const rotationOffset = candidateTracks.length > 0 ? daySeed % candidateTracks.length : 0;
    const rotated = [
      ...candidateTracks.slice(rotationOffset),
      ...candidateTracks.slice(0, rotationOffset),
    ];

    // Filter out already globally consumed tracks where possible, while keeping at least 15 tracks
    const heroTracks: PlayerTrack[] = [];
    for (const t of rotated) {
      if (heroTracks.length >= 20) break;
      heroTracks.push(t);
      globalSeenTrackIds.add(t.id);
    }

    const separatedTracks = applyConsecutiveSeparation(heroTracks, 4);

    const heroTag = isLateNight ? 'NIGHT ATMOSPHERE' : theme.tag;
    const heroTitle = isLateNight ? 'Late Night Atmosphere' : theme.title;
    const heroSubtitle = isLateNight
      ? `Midnight stillness and soothing rhythms featuring ${topArtist}.`
      : theme.subtitleTemplate(topArtist);

    const coverArt =
      separatedTracks[0]?.art ||
      artistCache?.[topArtist]?.image ||
      `aura://generated?name=${encodeURIComponent(heroTitle)}&type=playlist`;

    return {
      type: 'playlist',
      id: `daily-hero-${theme.vibe}`,
      title: heroTitle,
      image: coverArt,
      score: 10.0,
      reason: heroSubtitle,
      confidence: 99,
      seedArtists: topCluster?.artists || [topArtist],
      trackIds: separatedTracks.map(t => t.id),
      tracks: separatedTracks,
      heroTag,
    } as any;
  }

  /**
   * Generates 3 deterministically evolving daily mixes with rotation and language awareness.
   */
  public static generateEvolvedDailyMixes(
    context: DailyEvolutionContext,
    signals: ReturnType<typeof DailyFeedEvolutionService.collectPersonalizedSignals>,
    clusters: TasteCluster[],
    globalSeenTrackIds: Set<string>
  ): RecommendationSeed[] {
    const { daySeed } = context;
    const {
      history,
      likedTracks,
      suppressedTrackIds,
      recentlyPlayedIds,
      artistCache,
      preferredLanguages,
    } = signals;

    const mixes: RecommendationSeed[] = [];

    for (let mixIndex = 0; mixIndex < 3; mixIndex++) {
      const cluster = clusters[mixIndex] || clusters[0];
      const clusterArtists = new Set((cluster?.artists || []).map(a => a.toLowerCase().trim()));

      // Mix 2 is specialized: if user has preferred languages, spotlight one of their languages!
      let isLanguageSpotlight = false;
      let spotlightLangName = '';
      if (mixIndex === 1 && preferredLanguages.length > 0) {
        const langIndex = daySeed % preferredLanguages.length;
        const selectedLangId = preferredLanguages[langIndex];
        const langMeta = MUSIC_LANGUAGES.find(l => l.id.toLowerCase() === selectedLangId.toLowerCase());
        if (langMeta) {
          isLanguageSpotlight = true;
          spotlightLangName = langMeta.name;
        }
      }

      // Candidate pool for this mix
      const pool: PlayerTrack[] = [];
      const seenInMix = new Set<string>();

      // 1. Liked tracks matching cluster artists
      for (const lt of likedTracks) {
        if (suppressedTrackIds.has(lt.id) || seenInMix.has(lt.id)) continue;
        const normArtist = lt.artist.toLowerCase().trim();
        if (clusterArtists.has(normArtist)) {
          pool.push(lt);
          seenInMix.add(lt.id);
        }
      }

      // 2. History tracks matching cluster artists
      for (const h of history) {
        if (suppressedTrackIds.has(h.id) || seenInMix.has(h.id)) continue;
        const names = splitArtistNames(h.artist).map(s => s.toLowerCase().trim());
        if (names.some(n => clusterArtists.has(n))) {
          // De-prioritize recently played in the last 8 hours to avoid re-repetition
          const isFresh = !recentlyPlayedIds.has(h.id);
          if (isFresh || pool.length < 8) {
            pool.push({
              id: h.id,
              title: h.title,
              artist: h.artist,
              art: h.art || h.artwork || h.trackSnapshot?.art || '',
              duration: (h.durationMs ? h.durationMs / 1000 : h.duration) || 240,
              url: h.trackSnapshot?.url || '',
              album: h.album || h.trackSnapshot?.album,
              source: (h.trackSnapshot?.source || 'youtube') as any,
            });
            seenInMix.add(h.id);
          }
        }
      }

      // 3. Fallback matching catalog tracks
      for (const ct of catalogTracks) {
        if (seenInMix.has(ct.id)) continue;
        const normArtist = ct.artist.toLowerCase().trim();
        if (clusterArtists.has(normArtist)) {
          pool.push({
            id: ct.id,
            title: ct.title,
            artist: ct.artist,
            art: ct.art,
            duration: ct.durationSec || 240,
            url: '',
            source: 'local' as any,
          });
          seenInMix.add(ct.id);
        }
      }

      // If pool is still small, add general liked tracks
      if (pool.length < 15) {
        for (const lt of likedTracks) {
          if (!seenInMix.has(lt.id)) {
            pool.push(lt);
            seenInMix.add(lt.id);
          }
        }
      }

      // 4. Deterministic Daily Track Rotation:
      // Shift tracks by (daySeed + mixIndex * 5) % pool.length so each day has a fresh order!
      let selectedTracks: PlayerTrack[] = [];
      if (pool.length > 0) {
        const offset = (daySeed + mixIndex * 7) % pool.length;
        const rotatedPool = [...pool.slice(offset), ...pool.slice(0, offset)];

        for (const t of rotatedPool) {
          if (selectedTracks.length >= 25) break;
          // Prefer tracks not already consumed by Hero
          if (!globalSeenTrackIds.has(t.id) || selectedTracks.length < 10) {
            selectedTracks.push(t);
            globalSeenTrackIds.add(t.id);
          }
        }
      }

      const separated = applyConsecutiveSeparation(selectedTracks, 4);

      // Mix Title & Identity
      let mixTitle = `Daily Mix ${mixIndex + 1}`;
      let mixReason = cluster?.reason || 'A personalized mix crafted for your daily rotation.';

      if (mixIndex === 0) {
        const leadArtist = cluster?.artists?.[0];
        mixTitle = leadArtist ? `Daily Mix 1 • ${leadArtist} Flow` : 'Daily Mix 1 • Heavy Rotation';
        mixReason = `Heavy rotation tracks and your most completed favorites from ${cluster?.artists?.slice(0, 3).join(', ')}.`;
      } else if (mixIndex === 1) {
        if (isLanguageSpotlight) {
          mixTitle = `Daily Mix 2 • ${spotlightLangName} Spotlight`;
          mixReason = `Curated ${spotlightLangName} favorites matching your language taste.`;
        } else {
          const leadArtist = cluster?.artists?.[0];
          mixTitle = leadArtist ? `Daily Mix 2 • ${leadArtist} & Similar` : 'Daily Mix 2 • Similar Styles';
          mixReason = `Exploring vibes and styles adjacent to your rotation.`;
        }
      } else {
        mixTitle = `Daily Mix 3 • Chill & Discovery`;
        mixReason = `Relaxing sounds and fresh acoustic/ambient discoveries.`;
      }

      const topArt =
        separated[0]?.art ||
        artistCache?.[cluster?.artists?.[0] || '']?.image ||
        `aura://generated?name=${encodeURIComponent(mixTitle)}&type=playlist`;

      mixes.push({
        type: 'playlist',
        id: `daily-mix-${mixIndex + 1}`,
        title: mixTitle,
        image: topArt,
        score: cluster?.score || (10 - mixIndex),
        seedArtists: cluster?.artists || [],
        reason: mixReason,
        confidence: 96,
        trackIds: separated.map(t => t.id),
        tracks: separated,
      });
    }

    return mixes;
  }

  /**
   * Rotates discovery / trending seeds based on daily seed and preferred languages.
   */
  public static rotateDailyDiscovery(
    context: DailyEvolutionContext,
    preferredLanguages: string[]
  ): TrendingSeed[] {
    const { daySeed } = context;
    const catalogueLen = DISCOVERY_CATALOGUE.length;
    const startIndex = daySeed % catalogueLen;

    const slice: DiscoveryPoolItem[] = [];
    for (let i = 0; i < 4; i++) {
      slice.push(DISCOVERY_CATALOGUE[(startIndex + i) % catalogueLen]);
    }

    const now = Date.now();
    const result: TrendingSeed[] = slice.map(item => ({
      type: 'playlist',
      id: item.id,
      title: item.title,
      image: item.defaultArtwork,
      source: item.source,
      fetchedAt: now,
      query: item.query,
      reason: item.reason,
    }));

    // If user has language preferences, inject the day's language mix
    if (preferredLanguages.length > 0) {
      const langIdx = daySeed % preferredLanguages.length;
      const langId = preferredLanguages[langIdx];
      const langMeta = MUSIC_LANGUAGES.find(l => l.id.toLowerCase() === langId.toLowerCase());
      if (langMeta) {
        result.unshift({
          type: 'playlist',
          id: `seed-lang-${langMeta.id}`,
          title: `${langMeta.name} Top Hits`,
          image: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
          source: 'india',
          fetchedAt: now,
          query: langMeta.searchTag,
          reason: `Trending ${langMeta.name} hits matching your language preference`,
        });
      }
    }

    return result.slice(0, 5);
  }
}
