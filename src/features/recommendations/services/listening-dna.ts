import { HistoryEntry, AffinityMetric, splitArtistNames, useAnalyticsStore } from '../../analytics/store/analytics.store';

export type SessionType = 'morning' | 'night' | 'commute' | 'weekend' | 'general';

export interface ListeningDNA {
  completionRate: number;
  skipRate: number;
  explorationScore: number;
  loyaltyScore: number;
  sessionProfile: {
    morning: number;    // % of listening
    commute: number;    // % of listening
    night: number;      // % of listening
    weekend: number;    // % of listening
  };
  primarySession: SessionType;
  primaryTasteCluster: string;
  secondaryTasteCluster: string | null;
  listenerType: 'Explorer' | 'Balanced' | 'Loyalist';
  tasteConfidence: number; // 0 - 100 based on history depth
  
  // recommendation metrics
  recommendationClickRate: number;
  recommendationCompletionRate: number;
  discoverySuccessRate: number;
  
  generatedAt: number;
}

/**
 * Derives the Listening DNA profile dynamically from listening history and affinities
 */
export function calculateListeningDNA(
  history: HistoryEntry[],
  artistAffinities: Record<string, AffinityMetric>,
  primaryCluster: string,
  secondaryCluster: string | null
): ListeningDNA {
  const total = history.length;
  
  const analytics = useAnalyticsStore.getState();
  const recCount = analytics.newSongsRecommendedCount || 0;
  const compCount = analytics.newSongsCompletedCount || 0;
  const discoverySuccessRate = recCount > 0 ? compCount / recCount : 0;

  const shown = analytics.shownRecommendationsCount || 0;
  const clicked = analytics.clickedRecommendationsCount || 0;
  const completed = analytics.completedRecommendationsCount || 0;
  const recommendationClickRate = shown > 0 ? clicked / shown : 0;
  const recommendationCompletionRate = clicked > 0 ? completed / clicked : 0;
  
  if (total === 0) {
    return {
      completionRate: 0,
      skipRate: 0,
      explorationScore: 0.5,
      loyaltyScore: 0.5,
      sessionProfile: { morning: 0, commute: 0, night: 0, weekend: 0 },
      primarySession: 'general',
      primaryTasteCluster: primaryCluster,
      secondaryTasteCluster: secondaryCluster,
      listenerType: 'Balanced',
      tasteConfidence: 0,
      recommendationClickRate: 0,
      recommendationCompletionRate: 0,
      discoverySuccessRate: 0,
      generatedAt: Date.now()
    };
  }

  // 1. Completion & Skip Rates
  const completions = history.filter(h => h.completionRatio >= 0.95 || !h.skipped).length;
  const skips = history.filter(h => h.skipped).length;
  const completionRate = completions / total;
  const skipRate = skips / total;

  // 2. Exploration Score
  // Calculated over the last 30 days of plays (or all of history if history is sparse)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentHistory = history.filter(h => h.playedAt >= thirtyDaysAgo);
  const explorationWindow = recentHistory.length >= 10 ? recentHistory : history;
  
  const allArtistsInWindow: string[] = [];
  explorationWindow.forEach(entry => {
    allArtistsInWindow.push(...splitArtistNames(entry.artist));
  });
  
  const uniqueArtistsInWindow = new Set(allArtistsInWindow);
  const totalPlaysInWindow = Math.max(1, allArtistsInWindow.length);
  const explorationScore = Math.min(1.0, uniqueArtistsInWindow.size / totalPlaysInWindow);

  // 3. Loyalty Score
  // Measures repeat track plays out of total history
  const trackPlayCounts = new Map<string, number>();
  history.forEach(entry => {
    trackPlayCounts.set(entry.id, (trackPlayCounts.get(entry.id) || 0) + 1);
  });
  
  let repeatPlays = 0;
  trackPlayCounts.forEach(count => {
    if (count > 1) {
      repeatPlays += count;
    }
  });
  const loyaltyScore = repeatPlays / total;

  // 4. Session Profile (Time-of-day listening habits)
  let morningCount = 0;   // 5:00 - 10:00
  let commuteCount = 0;   // 8:00 - 10:00 & 17:00 - 19:00 on weekdays
  let nightCount = 0;     // 22:00 - 03:00
  let weekendCount = 0;   // Sat/Sun all day

  history.forEach(entry => {
    const date = new Date(entry.playedAt);
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
      weekendCount++;
    }
    
    if (hour >= 5 && hour < 10) {
      morningCount++;
    }
    
    if (hour >= 22 || hour < 3) {
      nightCount++;
    }
    
    // Commute: Mon-Fri, 8-10 AM or 5-7 PM
    if (!isWeekend && ((hour >= 8 && hour < 10) || (hour >= 17 && hour < 19))) {
      commuteCount++;
    }
  });

  const sessionProfile = {
    morning: Math.round((morningCount / total) * 100),
    commute: Math.round((commuteCount / total) * 100),
    night: Math.round((nightCount / total) * 100),
    weekend: Math.round((weekendCount / total) * 100)
  };

  // Determine Primary Session
  let primarySession: SessionType = 'general';
  let maxPercent = 0;
  
  const entries = Object.entries(sessionProfile) as [SessionType, number][];
  entries.forEach(([session, pct]) => {
    if (pct > maxPercent) {
      maxPercent = pct;
      primarySession = session;
    }
  });
  
  // If the max session has very low prominence (<15%), default to general
  if (maxPercent < 15) {
    primarySession = 'general';
  }

  // 5. Listener Type
  let listenerType: 'Explorer' | 'Balanced' | 'Loyalist' = 'Balanced';
  if (explorationScore >= 0.55) {
    listenerType = 'Explorer';
  } else if (loyaltyScore >= 0.65) {
    listenerType = 'Loyalist';
  }

  // 6. Taste Confidence
  // Based on history size, unique artists count, and unique listening days
  const sizePoints = Math.min(40, (total / 150) * 40); // Max 40 points for 150+ plays
  
  const allArtists = new Set<string>();
  const activeDays = new Set<string>();
  history.forEach(h => {
    splitArtistNames(h.artist).forEach(a => allArtists.add(a));
    activeDays.add(new Date(h.playedAt).toDateString());
  });
  
  const artistPoints = Math.min(30, allArtists.size * 2); // Max 30 points (15+ unique artists)
  const dayPoints = Math.min(30, activeDays.size * 5);    // Max 30 points (6+ unique active days)
  const tasteConfidence = Math.round(sizePoints + artistPoints + dayPoints);

  return {
    completionRate,
    skipRate,
    explorationScore,
    loyaltyScore,
    sessionProfile,
    primarySession,
    primaryTasteCluster: primaryCluster,
    secondaryTasteCluster: secondaryCluster,
    listenerType,
    tasteConfidence,
    recommendationClickRate,
    recommendationCompletionRate,
    discoverySuccessRate,
    generatedAt: Date.now()
  };
}
