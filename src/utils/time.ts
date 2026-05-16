/**
 * Utility functions for time and duration formatting/parsing.
 */

/**
 * Parses a duration string (e.g., "3:45", "1:20:30") into total seconds.
 * Returns 0 if the string is invalid or empty.
 */
export function parseDuration(duration: string | undefined): number {
  if (!duration || typeof duration !== 'string' || duration === '--:--') {
    return 0;
  }

  const parts = duration.split(':');
  
  try {
    if (parts.length === 1) {
      // Single number (seconds)
      return parseInt(parts[0], 10) || 0;
    }
    
    if (parts.length === 2) {
      // MM:SS
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseInt(parts[1], 10) || 0;
      return (minutes * 60) + seconds;
    }
    
    if (parts.length === 3) {
      // HH:MM:SS
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseInt(parts[2], 10) || 0;
      return (hours * 3600) + (minutes * 60) + seconds;
    }
  } catch (e) {
    console.warn('[TimeUtils] Failed to parse duration:', duration);
  }

  return 0;
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
