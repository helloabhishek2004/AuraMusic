import { PlayerTrack, RepeatMode } from "../types/player";

/**
 * Pure queue resolution engine.
 * Contains only deterministic calculations.
 * No side effects, no React, no Zustand, no native player dependencies.
 */
export const QueueEngine = {
  /**
   * Resolves the target index for manual "next" skips.
   * Manual next MUST bypass repeat-track loop and navigate normally.
   */
  getNextIndex(
    currentIndex: number,
    queueLength: number,
    repeatMode: RepeatMode
  ): number {
    if (queueLength <= 0) return -1;
    if (currentIndex === queueLength - 1) {
      // Manual skip wraps to 0 only when repeatMode is 'queue'
      return repeatMode === "queue" ? 0 : -1;
    }
    return currentIndex + 1;
  },

  /**
   * Resolves the target index for manual "previous" skips.
   * Manual previous MUST navigate normally even when repeatMode is 'track'.
   */
  getPreviousIndex(
    currentIndex: number,
    queueLength: number,
    repeatMode: RepeatMode
  ): number {
    if (queueLength <= 0) return -1;
    if (currentIndex === 0) {
      // Manual skip wraps to end only when repeatMode is 'queue'
      return repeatMode === "queue" ? queueLength - 1 : -1;
    }
    return currentIndex - 1;
  },

  /**
   * Resolves progression index for natural track progression (autoplay).
   * Respects repeat-track, repeat-queue, repeat-off rules cleanly.
   */
  resolveAutoAdvance(
    currentIndex: number,
    queueLength: number,
    repeatMode: RepeatMode
  ): number {
    if (queueLength <= 0) return -1;

    // repeatMode === 'track' loops same track infinitely
    if (repeatMode === "track") {
      return currentIndex;
    }

    if (currentIndex === queueLength - 1) {
      // repeatMode === 'queue' wraps to 0, otherwise stop cleanly (-1)
      return repeatMode === "queue" ? 0 : -1;
    }

    return currentIndex + 1;
  },

  /**
   * Predicts the index of the next track that should be preloaded.
   * Matches actual sequential or loop-back ordering.
   */
  resolvePreloadIndex(
    currentIndex: number,
    queueLength: number,
    repeatMode: RepeatMode
  ): number {
    if (queueLength <= 0) return -1;

    // If looping a single track, it is already loaded; no preload needed
    if (repeatMode === "track") {
      return -1;
    }

    if (currentIndex === queueLength - 1) {
      return repeatMode === "queue" ? 0 : -1;
    }

    return currentIndex + 1;
  },

  /**
   * Reorders the queue array for shuffle toggle.
   * Anchors playing track at index 0, shuffles remaining items using Fisher-Yates.
   * Preserves duplicate tracks in queue.
   */
  buildShuffledQueue(
    queue: PlayerTrack[],
    currentTrack: PlayerTrack,
    currentIndex: number = -1
  ): PlayerTrack[] {
    if (queue.length <= 1) return [...queue];

    try {
      const { useSettingsStore } = require("../../settings/store/settings.store");
      const smartShuffle = useSettingsStore.getState().smartShuffleEnabled;
      if (smartShuffle) {
        const { generateSmartShuffleQueue } = require("../services/smart-shuffle");
        return generateSmartShuffleQueue(queue, currentTrack);
      }
    } catch (e) {
      console.warn("[QueueEngine] Failed to resolve settings for smart shuffle:", e);
    }

    // Resolve index of playing track: prefer explicit currentIndex, fallback to findIndex
    let targetIdx = currentIndex;
    if (targetIdx < 0 || targetIdx >= queue.length || queue[targetIdx]?.id !== currentTrack.id) {
      targetIdx = queue.findIndex((t) => t.id === currentTrack.id);
    }
    if (targetIdx === -1) targetIdx = 0;

    const activeItem = queue[targetIdx] || currentTrack;
    const remaining = [
      ...queue.slice(0, targetIdx),
      ...queue.slice(targetIdx + 1),
    ];

    // True Fisher-Yates (Knuth) shuffle
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = remaining[i];
      remaining[i] = remaining[j];
      remaining[j] = temp;
    }

    return [activeItem, ...remaining];
  },

  /**
   * Restores original sequential order.
   * Resolves the current playing track's index in the sequential list.
   */
  restoreOriginalQueue(
    originalQueue: PlayerTrack[],
    currentTrack: PlayerTrack
  ): { queue: PlayerTrack[]; restoredIndex: number } {
    if (!originalQueue || !Array.isArray(originalQueue) || originalQueue.length === 0) {
      return {
        queue: currentTrack ? [currentTrack] : [],
        restoredIndex: 0,
      };
    }
    const idx = originalQueue.findIndex((t) => t?.id === currentTrack?.id);
    return {
      queue: [...originalQueue],
      restoredIndex: idx >= 0 ? idx : 0,
    };
  },
};
