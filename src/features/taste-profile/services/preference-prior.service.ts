/**
 * AuraMusic — Preference Prior & Dynamic Candidate Generator
 *
 * Mathematical bridge between declarative user preferences (MusicTasteProfile)
 * and the local recommendation engine.
 *
 * Principles:
 * 1. Zero synthetic telemetry: does not create fake playCounts or skip metrics.
 * 2. Natural decay: preference prior dominates at H=0 and decays gracefully as real listening accumulates.
 * 3. Dynamic candidate pool: builds Home carousels from the active profile.
 */

import { useTasteProfileStore } from '../store/taste-profile.store';
import { useAnalyticsStore } from '../../analytics/store/analytics.store';
import { useRecommendationsStore, TrendingSeed } from '../../recommendations/store/recommendations.store';
import { MUSIC_LANGUAGES, MUSIC_GENRES } from '../../../data/music-taxonomy';
import { PreferencePriorResult } from '../types/taste-profile';

/**
 * Calculates current preference prior scores with history-based decay
 */
export function calculatePreferencePriors(historyLength: number): PreferencePriorResult {
  const profile = useTasteProfileStore.getState();
  const { favoriteArtists, songLanguages, genres } = profile;

  // Decay formulation: 1.0 at 0 plays, down to 0.1 at 40+ plays
  const decayFactor = Math.max(0.1, 1.0 - (historyLength / 40));

  const artistPriorScores: Record<string, number> = {};
  const baseScore = 12.0;

  for (let i = 0; i < favoriteArtists.length; i++) {
    const artist = favoriteArtists[i];
    // Slightly weight higher-positioned selections
    const rankMultiplier = Math.max(0.7, 1.0 - (i * 0.05));
    const effectivePrior = baseScore * rankMultiplier * decayFactor;
    artistPriorScores[artist.name.toLowerCase().trim()] = Number(effectivePrior.toFixed(2));
  }

  // Generate dynamic seed queries
  const seedQueries: string[] = [];

  // 1. Language queries
  for (const langId of songLanguages) {
    const match = MUSIC_LANGUAGES.find(l => l.id.toLowerCase() === langId.toLowerCase());
    if (match) {
      seedQueries.push(match.searchTag);
    }
  }

  // 2. Genre queries
  for (const genreId of genres) {
    const match = MUSIC_GENRES.find(g => g.id.toLowerCase() === genreId.toLowerCase());
    if (match) {
      seedQueries.push(match.searchQuery);
    }
  }

  // 3. Artist queries
  for (const artist of favoriteArtists.slice(0, 5)) {
    seedQueries.push(`${artist.name} Hits`);
  }

  return {
    artistPriorScores,
    preferredLanguages: songLanguages,
    preferredGenres: genres,
    seedQueries,
    decayFactor,
  };
}

/**
 * Builds personalized TrendingSeed carousels directly from the user's taste profile
 */
export function buildDynamicDiscoverySeeds(): TrendingSeed[] {
  const profile = useTasteProfileStore.getState();
  const { songLanguages, genres, favoriteArtists } = profile;
  const seeds: TrendingSeed[] = [];
  const now = Date.now();

  // 1. Top Favorite Artist Mixes (First 2 artists)
  for (let i = 0; i < Math.min(2, favoriteArtists.length); i++) {
    const artist = favoriteArtists[i];
    seeds.push({
      type: 'playlist',
      id: `seed-artist-${artist.id || i}`,
      title: `${artist.name} Radio`,
      image: artist.artworkUrl || 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
      source: 'global',
      fetchedAt: now,
      query: `${artist.name} Best Songs`,
      reason: `Inspired by your love for ${artist.name}`,
    });
  }

  // Fallback high-res cover art by genre
  const GENRE_ARTWORKS: Record<string, string> = {
    pop: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    hiphop: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
    indie: 'https://i.ytimg.com/vi/YVkUvmDQ3HY/hqdefault.jpg',
    synthwave: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
    lofi: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
    edm: 'https://i.ytimg.com/vi/fB8TyLTD7EE/hqdefault.jpg',
    acoustic: 'https://i.ytimg.com/vi/kOCkne-Bku4/hqdefault.jpg',
    classical: 'https://i.ytimg.com/vi/21X5lGlDOfg/hqdefault.jpg',
    rnb: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
    rock: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
  };

  // 2. Language Mixes
  for (const langId of songLanguages.slice(0, 3)) {
    const lang = MUSIC_LANGUAGES.find(l => l.id.toLowerCase() === langId.toLowerCase());
    if (lang) {
      seeds.push({
        type: 'playlist',
        id: `seed-lang-${lang.id}`,
        title: `${lang.name} Top Hits`,
        image: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        source: 'india',
        fetchedAt: now,
        query: lang.searchTag,
        reason: `Trending ${lang.name} tracks matching your language taste`,
      });
    }
  }

  // 3. Genre Mixes
  for (const genreId of genres.slice(0, 3)) {
    const genre = MUSIC_GENRES.find(g => g.id.toLowerCase() === genreId.toLowerCase());
    if (genre) {
      seeds.push({
        type: 'playlist',
        id: `seed-genre-${genre.id}`,
        title: genre.name,
        image: GENRE_ARTWORKS[genre.id.toLowerCase()] || 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        source: 'global',
        fetchedAt: now,
        query: genre.searchQuery,
        reason: genre.description,
      });
    }
  }

  // Fallback if user selected nothing
  if (seeds.length === 0) {
    seeds.push(
      {
        type: 'playlist',
        id: 'seed-fallback-global',
        title: 'Global Top Hits',
        image: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        source: 'global',
        fetchedAt: now,
        query: 'Top Global Hits',
        reason: 'The hottest tracks worldwide',
      },
      {
        type: 'playlist',
        id: 'seed-fallback-synthwave',
        title: 'Synthwave & Chill',
        image: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
        source: 'global',
        fetchedAt: now,
        query: 'Synthwave Retrowave Chill Electro',
        reason: 'Neon retro synth vibes',
      }
    );
  }

  return seeds;
}

/**
 * Synchronizes the current taste profile into analytics and recommendation engine
 */
export async function syncPreferencePriorsToEngine(): Promise<void> {
  const profile = useTasteProfileStore.getState();
  const analyticsStore = useAnalyticsStore.getState();
  const recommendationsStore = useRecommendationsStore.getState();

  const historyLength = analyticsStore.history?.length || 0;
  const priors = calculatePreferencePriors(historyLength);

  // 1. Sync artist cache & profile list into Analytics store
  const artistCacheUpdates: Record<string, { id: string; image: string }> = {};
  const favoriteArtistNames: string[] = [];

  for (const a of profile.favoriteArtists) {
    favoriteArtistNames.push(a.name);
    if (a.artworkUrl) {
      artistCacheUpdates[a.name] = {
        id: a.id,
        image: a.artworkUrl,
      };
      // Call existing caching action if present
      if (typeof analyticsStore.cacheArtistDetails === 'function') {
        analyticsStore.cacheArtistDetails(a.name, { id: a.id, image: a.artworkUrl });
      }
    }
  }

  // 2. Update userTasteProfile in analytics without modifying behavioral play metrics
  const currentTaste = analyticsStore.userTasteProfile || {
    favoriteArtists: [],
    favoriteAlbums: [],
    activeHours: [],
    completionRate: 1.0,
    skipRate: 0.0,
    explorationScore: 50,
  };

  useAnalyticsStore.setState({
    userTasteProfile: {
      ...currentTaste,
      favoriteArtists: favoriteArtistNames.length > 0 ? favoriteArtistNames : currentTaste.favoriteArtists,
      favoriteAlbums: (currentTaste.favoriteAlbums && currentTaste.favoriteAlbums.length > 0)
        ? currentTaste.favoriteAlbums
        : favoriteArtistNames.slice(0, 3).map(name => `${name} Essentials`),
    },
    artistCache: {
      ...analyticsStore.artistCache,
      ...artistCacheUpdates,
    },
  });

  // 3. Generate dynamic discovery carousels for Home screen
  const dynamicSeeds = buildDynamicDiscoverySeeds();

  // 4. Update recommendations store
  useRecommendationsStore.setState({
    trendingSeeds: dynamicSeeds,
    // On cold start (historyLength < 5), use the first dynamic seed as the featured hero mix
    featuredHeroMix: (historyLength < 5 && dynamicSeeds.length > 0)
      ? {
          type: 'playlist',
          id: dynamicSeeds[0].id,
          title: dynamicSeeds[0].title,
          image: dynamicSeeds[0].image,
          score: 10.0,
          reason: dynamicSeeds[0].reason,
          query: dynamicSeeds[0].query,
        }
      : recommendationsStore.featuredHeroMix,
  });

  console.info('[PreferencePriorService] Synced taste profile to recommendation engine:', {
    seedsCount: dynamicSeeds.length,
    favoriteArtistsCount: favoriteArtistNames.length,
    decayFactor: priors.decayFactor,
  });
}

/**
 * Clears preference-derived state on profile reset
 */
export async function clearPreferencePriorsFromEngine(): Promise<void> {
  const analyticsStore = useAnalyticsStore.getState();

  // Clear favorite artists from taste profile
  if (analyticsStore.userTasteProfile) {
    useAnalyticsStore.setState({
      userTasteProfile: {
        ...analyticsStore.userTasteProfile,
        favoriteArtists: [],
      },
    });
  }

  // Reset trending seeds to neutral discovery slice
  const { getDiscoverySlice } = await import('../../recommendations/store/recommendations.store');
  const defaultSeeds = getDiscoverySlice(0, 4).map(item => ({
    type: 'playlist' as const,
    id: item.id,
    title: item.title,
    image: item.defaultArtwork,
    source: item.source,
    fetchedAt: Date.now(),
    query: item.query,
    reason: item.reason,
  }));

  useRecommendationsStore.setState({
    trendingSeeds: defaultSeeds,
    featuredHeroMix: null,
  });

  console.info('[PreferencePriorService] Cleared preference priors from engine.');
}
