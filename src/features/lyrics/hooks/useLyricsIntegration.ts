import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { useLyricsStore } from "../store/lyrics.store";

interface UseLyricsIntegrationOptions {
  enabled?: boolean;
  autoResumeDelay?: number; // ms to wait before resuming auto-follow after manual scroll
}

/**
 * Hook that integrates lyrics system with the player.
 * Automatically fetches lyrics when track changes and syncs progress.
 */
export const useLyricsIntegration = (
  options: UseLyricsIntegrationOptions = {}
) => {
  const {
    enabled = true,
    autoResumeDelay = 3000,
  } = options;

  // Player state
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const position = usePlayerStore((state) => state.position);
  const duration = usePlayerStore((state) => state.duration);

  // Lyrics state
  const fetchLyrics = useLyricsStore((state) => state.fetchLyrics);
  const setCurrentProgress = useLyricsStore((state) => state.setCurrentProgress);
  const resetUserScroll = useLyricsStore((state) => state.resetUserScroll);
  const hasUserScrolled = useLyricsStore((state) => state.hasUserScrolled);

  // Track auto-resume timer
  const autoResumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch lyrics when track changes.
   */
  useEffect(() => {
    if (!enabled || !currentTrack) {
      return;
    }

    console.log("[Lyrics Integration] Track changed, fetching lyrics:", {
      title: currentTrack.title,
      artist: currentTrack.artist,
      duration: Math.round(duration),
    });

    fetchLyrics(
      currentTrack.id,
      currentTrack.title,
      currentTrack.artist,
      Math.round(duration)
    );
  }, [currentTrack?.id, enabled, duration, fetchLyrics]);

  /**
   * Sync playback progress with lyrics.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const progressMs = position * 1000; // Convert seconds to ms
    setCurrentProgress(progressMs);
  }, [position, enabled, setCurrentProgress]);

  /**
   * Handle auto-resume of auto-follow after manual scroll.
   */
  useEffect(() => {
    if (!enabled || !hasUserScrolled) {
      return;
    }

    // Clear any existing timer
    if (autoResumeTimerRef.current) {
      clearTimeout(autoResumeTimerRef.current);
    }

    // Set new timer to resume auto-follow
    autoResumeTimerRef.current = setTimeout(() => {
      console.log("[Lyrics Integration] Resuming auto-follow after manual scroll");
      resetUserScroll();
      autoResumeTimerRef.current = null;
    }, autoResumeDelay);

    return () => {
      if (autoResumeTimerRef.current) {
        clearTimeout(autoResumeTimerRef.current);
      }
    };
  }, [hasUserScrolled, enabled, autoResumeDelay, resetUserScroll]);

  return {
    // Export the store state and actions for component usage
    lyrics: useLyricsStore((state) => state.lyrics),
    isLoading: useLyricsStore((state) => state.isLoading),
    error: useLyricsStore((state) => state.error),
    activeLineIndex: useLyricsStore((state) => state.activeLineIndex),
    currentProgress: useLyricsStore((state) => state.currentProgress),
    isFollowingPlayback: useLyricsStore((state) => state.isFollowingPlayback),
    setHasUserScrolled: useLyricsStore((state) => state.setHasUserScrolled),
  };
};
