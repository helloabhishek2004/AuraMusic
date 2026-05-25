import { useEffect, useCallback } from "react";
import { useSharedValue, useDerivedValue } from "react-native-reanimated";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { useLyricsStore } from "../store/lyrics.store";
import TrackPlayer from "@rntp/player";

export const useLyricsIntegration = (isVisible: boolean) => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const duration = usePlayerStore((state) => state.duration);
  const lyrics = useLyricsStore((state) => state.lyrics);
  const fetchLyrics = useLyricsStore((state) => state.fetchLyrics);
  
  // Progress tracking via Reanimated SharedValues (UI thread)
  const progress = useSharedValue(0);
  const activeLineIndex = useSharedValue(-1);
  const isFollowing = useSharedValue(true);

  /**
   * Pure JS Polling Loop:
   * Replaces `useProgress` to completely bypass React state updates.
   * Runs at 180ms intervals directly mutating the SharedValue.
   */
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(async () => {
      try {
        const { position } = await TrackPlayer.getProgress();
        progress.value = position * 1000; // Store as ms
      } catch (e) {
        // Player not ready
      }
    }, 180); // >= 180ms per strict requirement

    return () => clearInterval(interval);
  }, [isVisible, progress]);

  /**
   * Automatically calculate active line index on UI thread.
   */
  useDerivedValue(() => {
    if (!lyrics || !lyrics.lyrics || lyrics.lyrics.length === 0) {
      if (activeLineIndex.value !== -1) activeLineIndex.value = -1;
      return;
    }

    const lines = lyrics.lyrics;
    let index = -1;
    const currentMs = progress.value;

    for (let i = 0; i < lines.length; i++) {
      if (currentMs >= lines[i].time) {
        index = i;
      } else {
        break;
      }
    }

    if (activeLineIndex.value !== index) {
      activeLineIndex.value = index;
    }
  });

  /**
   * Fetch lyrics when track changes.
   */
  useEffect(() => {
    if (!currentTrack || !isVisible) return;

    fetchLyrics(
      currentTrack.id,
      currentTrack.title,
      currentTrack.artist,
      Math.round(duration)
    );
  }, [currentTrack?.id, isVisible, duration, fetchLyrics]);

  /**
   * Performance-first seeking:
   * Instantly updates UI state and native player position.
   */
  const seekToLine = useCallback(async (timeMs: number) => {
    // 1. Update UI thread immediately
    progress.value = timeMs;
    isFollowing.value = true;

    // 2. Update native player immediately (no debounce)
    try {
      await TrackPlayer.seekTo(timeMs / 1000);
    } catch (e) {
      console.warn("[Lyrics] Seek failed:", e);
    }
  }, [progress, isFollowing]);

  return {
    lyrics: lyrics?.lyrics || [],
    isSynced: lyrics?.synced || false,
    isLoading: useLyricsStore((state) => state.isLoading),
    error: useLyricsStore((state) => state.error),
    progress,
    activeLineIndex,
    isFollowing,
    seekToLine
  };
};
