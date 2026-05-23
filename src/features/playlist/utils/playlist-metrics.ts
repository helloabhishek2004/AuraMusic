/**
 * AuraMusic Playlist Metrics Utilities
 *
 * SINGLE SOURCE OF TRUTH for all playlist-derived calculations.
 * Used by: Library, Playlist Detail, Download page, Search, AddToPlaylistSheet.
 * NEVER compute these inline in UI components.
 */

import type { Playlist, PlaylistDownloadState } from '../types/playlist';
import type { DownloadedTrack, DownloadTask } from '@/src/features/download/types/download';

// ─── Duration ────────────────────────────────────────────────────────────────

/**
 * Total duration of all tracks in the playlist (ms).
 * Uses trackSnapshots as source. Returns 0 for tracks without snapshot duration.
 */
export function getTotalDurationMs(playlist: Playlist): number {
  if (!playlist.trackSnapshots) return 0;
  return playlist.trackIds.reduce((total, id) => {
    const snap = playlist.trackSnapshots?.[id];
    return total + (snap?.duration ?? 0);
  }, 0);
}

/**
 * Human-readable duration string.
 * Examples: "1h 23m", "45 min", "3:45" for short playlists
 */
export function getFormattedDuration(playlist: Playlist): string {
  const totalMs = getTotalDurationMs(playlist);
  if (totalMs === 0) return '';

  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) return `${minutes} min`;
  return `${totalSeconds}s`;
}

// ─── Download Counts ──────────────────────────────────────────────────────────

/**
 * Number of tracks in the playlist that are fully downloaded.
 */
export function getDownloadedCount(
  playlist: Playlist,
  downloadedTracks: Record<string, DownloadedTrack>
): number {
  return playlist.trackIds.filter((id) => Boolean(downloadedTracks[id])).length;
}

/**
 * Number of tracks actively downloading.
 */
export function getDownloadingCount(
  playlist: Playlist,
  activeTasks: Record<string, DownloadTask>
): number {
  return playlist.trackIds.filter((id) => Boolean(activeTasks[id])).length;
}

/**
 * Total bytes consumed by downloaded tracks in this playlist.
 */
export function getDownloadedSizeBytes(
  playlist: Playlist,
  downloadedTracks: Record<string, DownloadedTrack>
): number {
  return playlist.trackIds.reduce((total, id) => {
    const track = downloadedTracks[id];
    return total + (track?.fileSize ?? 0);
  }, 0);
}

// ─── Download State (Enum) ────────────────────────────────────────────────────

/**
 * Derives the canonical PlaylistDownloadState for a playlist.
 * Use this EVERYWHERE — never ad-hoc ternaries.
 *
 * Priority:
 *   'downloaded'  → ALL tracks are in downloadedTracks
 *   'downloading' → ANY track has an active task
 *   'partial'     → SOME but not all downloaded (and none downloading)
 *   'none'        → nothing downloaded
 */
export function getPlaylistDownloadState(
  playlist: Playlist,
  downloadedTracks: Record<string, DownloadedTrack>,
  activeTasks: Record<string, DownloadTask>
): PlaylistDownloadState {
  if (playlist.trackIds.length === 0) return 'none';

  const downloadedCount = getDownloadedCount(playlist, downloadedTracks);
  const downloadingCount = getDownloadingCount(playlist, activeTasks);

  if (downloadedCount === playlist.trackIds.length) return 'downloaded';
  if (downloadingCount > 0) return 'downloading';
  if (downloadedCount > 0) return 'partial';
  return 'none';
}

// ─── Stats Line ───────────────────────────────────────────────────────────────

/**
 * Human-readable stats line for playlist display.
 * Examples:
 *   "12 songs • 1h 4m"
 *   "1 song • 3 min • 1 downloaded"
 *   "0 songs"
 */
export function getStatsLine(
  playlist: Playlist,
  downloadedTracks: Record<string, DownloadedTrack>
): string {
  const count = playlist.trackIds.length;
  const songLabel = count === 1 ? 'song' : 'songs';
  const parts: string[] = [`${count} ${songLabel}`];

  const duration = getFormattedDuration(playlist);
  if (duration) parts.push(duration);

  const downloaded = getDownloadedCount(playlist, downloadedTracks);
  if (downloaded > 0 && downloaded < count) {
    parts.push(`${downloaded} downloaded`);
  }

  return parts.join(' • ');
}

/**
 * Short stats for list cells (Library grid, AddToPlaylistSheet).
 * Example: "12 songs"
 */
export function getShortStats(playlist: Playlist): string {
  const count = playlist.trackIds.length;
  return `${count} ${count === 1 ? 'song' : 'songs'}`;
}

// ─── Artwork Helpers ──────────────────────────────────────────────────────────

/**
 * Returns artwork URIs for auto-generated collage covers.
 * Pulls from trackSnapshots.art in trackIds order.
 * Returns up to `limit` unique, non-empty URIs.
 */
export function getCollageArtUrls(playlist: Playlist, limit = 4): string[] {
  if (playlist.coverArt) return [playlist.coverArt];
  if (!playlist.trackSnapshots) return [];

  const urls: string[] = [];
  for (const id of playlist.trackIds) {
    if (urls.length >= limit) break;
    const art = playlist.trackSnapshots[id]?.art;
    if (art && art.length > 0 && !urls.includes(art)) {
      urls.push(art);
    }
  }
  return urls;
}

// ─── Gradient Generation ──────────────────────────────────────────────────────

// 8 curated gradient pairs aligned to AuraMusic palette
const GRADIENT_PRESETS: Array<[string, string]> = [
  ['#bf5af2', '#6f2bbe'],  // Purple (brand)
  ['#2f8cff', '#1a5ccc'],  // Blue
  ['#46f5e0', '#1a8c7d'],  // Cyan
  ['#ff7a8a', '#cc3355'],  // Coral
  ['#d946ef', '#701a75'],  // Fuchsia
  ['#47e39a', '#1a8c55'],  // Green
  ['#9b38da', '#2f8cff'],  // Purple → Blue
  ['#46f5e0', '#bf5af2'],  // Cyan → Purple
];

/**
 * Deterministic gradient from playlist name using FNV-1a hash.
 * Same name always produces the same gradient pair.
 */
export function generateGradientColors(name: string): [string, string] {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return GRADIENT_PRESETS[hash % GRADIENT_PRESETS.length];
}

// ─── Time Ago ─────────────────────────────────────────────────────────────────

/**
 * Human-readable relative time from a Unix ms timestamp.
 * Examples: "Just now", "2 hours ago", "3 days ago", "Jan 12"
 */
export function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
