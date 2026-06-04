export interface TasteSnapshot {
  timestamp: number;
  month: number; // 0-11
  season: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
  topArtists: string[];
  topAlbums: string[];
  topTracks: string[];
  topCluster: string;
  completionRate: number;
  skipRate: number;
}

export type TasteDriftLevel = 'none' | 'minor' | 'moderate' | 'major';

export interface FatigueRecord {
  seedId: string;
  recommendedCount: number;
  ignoredCount: number;
  lastShownAt: number;
  lastPlayedAt?: number;
}

/**
 * Returns the season corresponding to a given month (0-indexed, 0 = January)
 */
export function getSeason(month: number): 'Spring' | 'Summer' | 'Autumn' | 'Winter' {
  // Dec, Jan, Feb -> Winter
  if (month === 11 || month === 0 || month === 1) {
    return 'Winter';
  }
  // Mar, Apr, May -> Spring
  if (month >= 2 && month <= 4) {
    return 'Spring';
  }
  // Jun, Jul, Aug -> Summer
  if (month >= 5 && month <= 7) {
    return 'Summer';
  }
  // Sep, Oct, Nov -> Autumn
  return 'Autumn';
}

/**
 * Creates a TasteSnapshot based on current user metrics
 */
export function createTasteSnapshot(
  topArtists: string[],
  topAlbums: string[],
  topTracks: string[],
  topCluster: string,
  completionRate: number,
  skipRate: number
): TasteSnapshot {
  const date = new Date();
  const month = date.getMonth();
  return {
    timestamp: Date.now(),
    month,
    season: getSeason(month),
    topArtists,
    topAlbums,
    topTracks,
    topCluster,
    completionRate,
    skipRate
  };
}

/**
 * Detects the level of taste drift by comparing current top artists to the oldest snapshot (ideally 4+ weeks old)
 */
export function detectTasteDrift(currentTopArtists: string[], snapshots: TasteSnapshot[]): TasteDriftLevel {
  if (!snapshots || snapshots.length < 2 || currentTopArtists.length === 0) {
    return 'none';
  }

  // Find oldest snapshot. Since snapshots are stored in chronological order, snapshots[0] is oldest.
  // Ideally we want a snapshot that is at least 4 weeks old, so let's look for the first one that is old enough,
  // or default to snapshots[0] if none are 4 weeks old yet.
  const fourWeeksAgo = Date.now() - 4 * 7 * 24 * 60 * 60 * 1000;
  let referenceSnapshot = snapshots[0];
  
  for (const snap of snapshots) {
    if (snap.timestamp <= fourWeeksAgo) {
      referenceSnapshot = snap;
      break;
    }
  }

  const pastTopArtists = referenceSnapshot.topArtists;
  if (!pastTopArtists || pastTopArtists.length === 0) {
    return 'none';
  }

  // Calculate percentage overlap
  const commonArtists = currentTopArtists.filter(artist => pastTopArtists.includes(artist));
  const overlapPercent = commonArtists.length / Math.max(1, currentTopArtists.length);

  // Map to TasteDriftLevel
  // 0-20%   -> major
  // 21-40%  -> moderate
  // 41-60%  -> minor
  // 61%+    -> none
  if (overlapPercent <= 0.20) {
    return 'major';
  } else if (overlapPercent <= 0.40) {
    return 'moderate';
  } else if (overlapPercent <= 0.60) {
    return 'minor';
  }
  
  return 'none';
}

/**
 * Evaluates whether a seed is locked out due to recommendation fatigue
 */
export function isSeedFatigued(record: FatigueRecord): boolean {
  if (!record || record.ignoredCount === 0) {
    return false;
  }

  const elapsedMs = Date.now() - record.lastShownAt;
  let lockDurationMs = 0;

  if (record.ignoredCount === 1) {
    lockDurationMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  } else if (record.ignoredCount === 2) {
    lockDurationMs = 14 * 24 * 60 * 60 * 1000; // 14 days
  } else if (record.ignoredCount >= 3) {
    lockDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  return elapsedMs < lockDurationMs;
}

/**
 * Handles fatigue reset actions: on play, completion, or like
 */
export function handleFatigueInteraction(
  record: FatigueRecord,
  action: 'play' | 'like' | 'complete'
): FatigueRecord {
  const updated = { ...record };
  
  if (action === 'play' || action === 'like') {
    updated.ignoredCount = 0;
    updated.recommendedCount = 0;
    if (action === 'play') {
      updated.lastPlayedAt = Date.now();
    }
  } else if (action === 'complete') {
    // Completed is handled by store directly or resets count to 0 too
    updated.ignoredCount = 0;
  }
  
  return updated;
}
