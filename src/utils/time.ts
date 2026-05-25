/**
 * Utility functions for time and duration formatting/parsing.
 */

/**
 * Parses a duration string (e.g., "3:45", "1:20:30") into total seconds.
 * Returns 0 if the string is invalid or empty.
 */
/**
 * Hardened normalization flow to parse/extract seconds from any duration shape.
 * Returns null if duration is invalid or cannot be determined.
 */
export function normalizeDuration(input: any): number | null {
  if (input === null || input === undefined || input === "" || input === "--:--") {
    return null;
  }

  // If it's a string, check if it's formatted (MM:SS or HH:MM:SS) or raw number
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      try {
        if (parts.length === 2) {
          const minutes = parseInt(parts[0], 10);
          const seconds = parseInt(parts[1], 10);
          if (!isNaN(minutes) && !isNaN(seconds)) {
            return (minutes * 60) + seconds;
          }
        } else if (parts.length === 3) {
          const hours = parseInt(parts[0], 10);
          const minutes = parseInt(parts[1], 10);
          const seconds = parseInt(parts[2], 10);
          if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
            return (hours * 3600) + (minutes * 60) + seconds;
          }
        }
      } catch (e) {
        console.warn('[TimeUtils] Failed to parse formatted duration:', trimmed, e);
      }
    }

    const parsed = parseFloat(trimmed);
    if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
      return null;
    }
    input = parsed;
  }

  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input) || input <= 0) {
      return null;
    }
    // Check if it's in milliseconds (usually > 10000)
    if (input > 10000) {
      return Math.round(input / 1000);
    }
    return Math.round(input);
  }

  return null;
}

/**
 * Parses a duration string or number into total seconds.
 * Returns 0 if the input is invalid or empty.
 */
export function parseDuration(duration: any): number {
  const norm = normalizeDuration(duration);
  return norm !== null ? norm : 0;
}

/**
 * Formats seconds into a human-readable string (e.g., 225 -> "3:45").
 */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  
  return `${m}:${s.toString().padStart(2, '0')}`;
}
