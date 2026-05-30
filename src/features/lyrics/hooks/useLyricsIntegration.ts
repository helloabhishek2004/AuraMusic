import { useEffect, useCallback } from "react";
import { useDerivedValue, SharedValue } from "react-native-reanimated";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { useLyricsStore } from "../store/lyrics.store";
import TrackPlayer from "@rntp/player";
import { playbackProgress } from "@/src/features/player/services/playback-progress";

export const useLyricsIntegration = (isVisible: boolean) => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const duration = usePlayerStore((state) => state.duration);
  const lyricsData = useLyricsStore((state) => state.lyrics);
  const fetchLyrics = useLyricsStore((state) => state.fetchLyrics);
  
  const activeLineIndex = usePlayerStore(s => s.activeLineIndex) || useSharedValue(-1);
  const isFollowing = useSharedValue(true);

  // Optimized Active Line Detection on UI Thread
  useDerivedValue(() => {
    if (!lyricsData?.lyrics?.length) {
      if (activeLineIndex.value !== -1) activeLineIndex.value = -1;
      return;
    }

    const t = playbackProgress.positionMs.value;
    const lines = lyricsData.lyrics;
    const last = activeLineIndex.value;

    // Fast Path: Still on same line?
    if (last >= 0 && last < lines.length) {
      const cur = lines[last].time;
      const nxt = lines[last].endTime || (last + 1 < lines.length ? lines[last + 1].time : Infinity);
      if (t >= cur && t < nxt) return;
    }

    // Forward Scan Path: Normal progression
    if (last >= 0 && last + 1 < lines.length && lines[last + 1].time <= t) {
      let i = last + 1;
      while (i + 1 < lines.length && lines[i + 1].time <= t) i++;
      activeLineIndex.value = i;
      return;
    }

    // Binary Search Fallback: Seeking / Rewinding
    let lo = 0, hi = lines.length - 1;
    let res = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].time <= t) { res = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    activeLineIndex.value = res;
  });

  useEffect(() => {
    if (!currentTrack || !isVisible) return;
    fetchLyrics(currentTrack.id, currentTrack.title, currentTrack.artist, Math.round(duration));
  }, [currentTrack?.id, isVisible, duration, fetchLyrics]);

  const seekToLine = useCallback(async (timeMs: number) => {
    playbackProgress.positionMs.value = timeMs;
    isFollowing.value = true;
    try {
      await TrackPlayer.seekTo(timeMs / 1000);
    } catch (e) {}
  }, [isFollowing]);

  return {
    lyrics: lyricsData?.lyrics || [],
    isSynced: lyricsData?.synced || false,
    isLoading: useLyricsStore((state) => state.isLoading),
    error: useLyricsStore((state) => state.error),
    progress: playbackProgress.positionMs,
    activeLineIndex,
    isFollowing,
    seekToLine
  };
};
