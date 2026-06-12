import { PlayerTrack } from "../types/player";
import { StorageService } from "../../download/services/storage.service";

/**
 * Helper to identify placeholder, synthetic, fallback or empty audio URLs.
 */
export function isPlaceholderSource(url?: string): boolean {
  if (!url || url.trim() === "") return true;
  const lowerUrl = url.toLowerCase();
  
  // Detect standard base64 dummy silences or placeholder URIs
  if (lowerUrl.startsWith("data:audio")) return true;
  
  // Detect placeholder/fallback names in URL paths
  if (
    lowerUrl.includes("silence") || 
    lowerUrl.includes("placeholder") || 
    lowerUrl.includes("fallback") ||
    lowerUrl.includes("dummy")
  ) {
    // Only flag if it appears to be a mock media file
    if (
      lowerUrl.endsWith(".mp3") || 
      lowerUrl.endsWith(".m4a") || 
      lowerUrl.endsWith(".wav") || 
      lowerUrl.startsWith("http")
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validates track media source. Checks disk existence for local tracks and URL freshness for streaming tracks.
 */
export async function validateTrackSource(track: PlayerTrack): Promise<{
  valid: boolean;
  reason: "missing" | "expired" | "invalid" | "local_missing" | "unknown";
}> {
  if (!track) {
    return { valid: false, reason: "missing" };
  }

  const url = track.url;
  if (!url) {
    return { valid: false, reason: "missing" };
  }

  if (isPlaceholderSource(url)) {
    return { valid: false, reason: "invalid" };
  }

  const isLocal = track.isLocal || url.startsWith("file://") || url.startsWith("content://");

  if (isLocal) {
    if (url.startsWith("file://") && url.length <= 7) {
      return { valid: false, reason: "invalid" };
    }
    
    try {
      const exists = await StorageService.fileExists(url);
      if (!exists) {
        return { valid: false, reason: "local_missing" };
      }
      
      const size = await StorageService.getFileSize(url);
      if (size <= 0) {
        return { valid: false, reason: "invalid" };
      }
    } catch {
      return { valid: false, reason: "invalid" };
    }
  } else {
    // Streaming URL checks
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return { valid: false, reason: "invalid" };
    }

    // Force expired check (> 24 hours)
    if (track.sourceFetchedAt) {
      const ageMs = Date.now() - track.sourceFetchedAt;
      const ageHours = ageMs / (1000 * 60 * 60);
      if (ageHours > 24) {
        return { valid: false, reason: "expired" };
      }
    }
  }

  return { valid: true, reason: "unknown" };
}
