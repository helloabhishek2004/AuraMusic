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
   * Anchor playing track at index 0, shuffles remaining items.
   */
  buildShuffledQueue(
    queue: PlayerTrack[],
    currentTrack: PlayerTrack
  ): PlayerTrack[] {
    const remaining = queue.filter((t) => t.id !== currentTrack.id);
    
    // Deterministic-like shuffle randomization
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    
    return [currentTrack, ...shuffled];
  },

  /**
   * Restores original sequential order.
   * Resolves the current playing track's index in the sequential list.
   */
  restoreOriginalQueue(
    originalQueue: PlayerTrack[],
    currentTrack: PlayerTrack
  ): { queue: PlayerTrack[]; restoredIndex: number } {
    const idx = originalQueue.findIndex((t) => t.id === currentTrack.id);
    return {
      queue: [...originalQueue],
      restoredIndex: idx >= 0 ? idx : 0,
    };
  },
};
