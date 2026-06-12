import { PlayerTrack } from "../types/player";

/**
 * Checks if a streaming track source URL has gone stale (> 6 hours).
 * Local files never expire.
 */
export function isSourceStale(track: PlayerTrack): boolean {
  if (track.isLocal || track.url?.startsWith("file://") || track.url?.startsWith("content://")) {
    return false;
  }
  
  if (!track.sourceFetchedAt) {
    return true;
  }

  const ageMs = Date.now() - track.sourceFetchedAt;
  const ageHours = ageMs / (1000 * 60 * 60);

  return ageHours > 6;
}

/**
 * Checks if a streaming track source URL has expired (> 24 hours).
 * Local files never expire.
 */
export function shouldForceRefresh(track: PlayerTrack): boolean {
  if (track.isLocal || track.url?.startsWith("file://") || track.url?.startsWith("content://")) {
    return false;
  }
  
  if (!track.sourceFetchedAt) {
    return true;
  }

  const ageMs = Date.now() - track.sourceFetchedAt;
  const ageHours = ageMs / (1000 * 60 * 60);

  return ageHours > 24;
}
