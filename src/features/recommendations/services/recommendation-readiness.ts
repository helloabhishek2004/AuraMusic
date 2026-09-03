import { AnalyticsState, HistoryEntry, AffinityMetric } from '../../analytics/store/analytics.store';

export interface RecommendationReadinessResult {
  isReady: boolean;
  score: number; // 0 to 100
  metrics: {
    uniqueTracksPlayed: number;
    uniqueCompletedTracks: number;
    uniqueArtistsCount: number;
    totalListeningDurationMs: number;
    totalPlays: number;
    repeatListensCount: number;
    completionRate: number;
    skipRate: number;
  };
  reasons: string[];
}

/**
 * Authoritative recommendation readiness calculation.
 * Ensures the system has enough behavioral signals before exposing "Made for You".
 * 
 * Required minimums:
 * - At least 8 unique completed/near-completed tracks (or 10 unique tracks played with >= 6 completions)
 * - At least 3 distinct artists listened to
 * - At least 15 minutes (900,000 ms) of genuine listening duration
 * - At least 10 total listening events
 * - Skip rate below 75%
 */
export function calculateRecommendationReadiness(analytics: AnalyticsState | null | undefined): RecommendationReadinessResult {
  if (!analytics) {
    return {
      isReady: false,
      score: 0,
      metrics: {
        uniqueTracksPlayed: 0,
        uniqueCompletedTracks: 0,
        uniqueArtistsCount: 0,
        totalListeningDurationMs: 0,
        totalPlays: 0,
        repeatListensCount: 0,
        completionRate: 0,
        skipRate: 0,
      },
      reasons: ['No listening analytics available.'],
    };
  }

  const history: HistoryEntry[] = analytics.history || [];
  const trackAffinities = analytics.trackAffinities || {};
  const artistAffinities = analytics.artistAffinities || {};

  const totalPlays = history.length;
  const uniqueTrackIds = new Set<string>();
  const completedTrackIds = new Set<string>();
  let totalListeningDurationMs = 0;
  let repeatListensCount = 0;

  // 1. Analyze track affinities
  for (const trackId of Object.keys(trackAffinities)) {
    const aff = trackAffinities[trackId];
    if (!aff) continue;
    if (aff.playCount > 0) {
      uniqueTrackIds.add(trackId);
      totalListeningDurationMs += (aff.totalListenMs || 0);
      if (aff.playCount >= 2 || (aff.repeatCount || 0) >= 1) {
        repeatListensCount++;
      }
      if ((aff.completionCount || 0) >= 1 || (aff.likedCount || 0) >= 1) {
        completedTrackIds.add(trackId);
      }
    }
  }

  // 2. Cross-reference with history for additional signals
  for (const entry of history) {
    uniqueTrackIds.add(entry.id);
    if (entry.completionRatio >= 0.80 || (!entry.skipped && (entry.positionMs || entry.position || 0) >= 45000)) {
      completedTrackIds.add(entry.id);
    }
  }

  // 3. Count unique meaningful artists
  const uniqueArtists = new Set<string>();
  for (const artistName of Object.keys(artistAffinities)) {
    const aff = artistAffinities[artistName];
    if (aff && (aff.playCount > 0 || aff.score > 0)) {
      uniqueArtists.add(artistName.toLowerCase().trim());
    }
  }
  if (uniqueArtists.size === 0) {
    for (const entry of history) {
      if (entry.artist) {
        uniqueArtists.add(entry.artist.toLowerCase().trim());
      }
    }
  }

  const uniqueTracksPlayed = uniqueTrackIds.size;
  const uniqueCompletedTracks = completedTrackIds.size;
  const uniqueArtistsCount = uniqueArtists.size;

  const totalHistoryCount = analytics.totalHistoryCount || totalPlays;
  const totalCompletedCount = analytics.totalCompletedCount || uniqueCompletedTracks;
  const totalSkippedCount = analytics.totalSkippedCount || 0;

  const completionRate = totalHistoryCount > 0 ? totalCompletedCount / totalHistoryCount : 0;
  const skipRate = totalHistoryCount > 0 ? totalSkippedCount / totalHistoryCount : 0;

  const reasons: string[] = [];

  // Minimum Criteria Checks
  const hasMinPlays = totalPlays >= 10;
  if (!hasMinPlays) reasons.push(`Need at least 10 plays (current: ${totalPlays})`);

  const hasMinCompleted = uniqueCompletedTracks >= 8 || (uniqueTracksPlayed >= 10 && uniqueCompletedTracks >= 6);
  if (!hasMinCompleted) reasons.push(`Need at least 8 completed tracks (current: ${uniqueCompletedTracks})`);

  const hasMinArtists = uniqueArtistsCount >= 3;
  if (!hasMinArtists) reasons.push(`Need at least 3 distinct artists (current: ${uniqueArtistsCount})`);

  const minDurationMs = 15 * 60 * 1000; // 15 minutes
  const hasMinDuration = totalListeningDurationMs >= minDurationMs || totalPlays >= 15;
  if (!hasMinDuration) reasons.push(`Need at least 15m of listening time (current: ${Math.round(totalListeningDurationMs / 60000)}m)`);

  const hasAcceptableSkipRate = skipRate < 0.75 || totalPlays < 15;
  if (!hasAcceptableSkipRate) reasons.push(`Skip rate is too high (${Math.round(skipRate * 100)}%)`);

  const isReady = hasMinPlays && hasMinCompleted && hasMinArtists && hasMinDuration && hasAcceptableSkipRate;

  // Readiness Score 0-100
  const playsScore = Math.min(25, (totalPlays / 15) * 25);
  const completionsScore = Math.min(30, (uniqueCompletedTracks / 10) * 30);
  const artistsScore = Math.min(25, (uniqueArtistsCount / 5) * 25);
  const durationScore = Math.min(20, (totalListeningDurationMs / minDurationMs) * 20);
  const readinessScore = Math.min(100, Math.round(playsScore + completionsScore + artistsScore + durationScore));

  return {
    isReady,
    score: isReady ? readinessScore : Math.min(readinessScore, 85),
    metrics: {
      uniqueTracksPlayed,
      uniqueCompletedTracks,
      uniqueArtistsCount,
      totalListeningDurationMs,
      totalPlays,
      repeatListensCount,
      completionRate,
      skipRate,
    },
    reasons,
  };
}
