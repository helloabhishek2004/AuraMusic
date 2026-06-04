import { usePlayerStore } from '../store/player.store';
import { PlayerTrack } from '../types/player';

export function usePlayer() {
  const store = usePlayerStore();

  const playTrack = async (track: PlayerTrack, queue?: PlayerTrack[], context?: any) => {
    if (queue) {
      const index = queue.findIndex(t => t.id === track.id);
      await store.setQueue(queue, index >= 0 ? index : 0, context || {
        sourceId: track.id,
        sourceType: "manual",
        generatedAt: Date.now()
      });
    } else {
      await store.setTrack(track);
    }
  };

  const progress = store.duration > 0 ? store.position / store.duration : 0;

  return {
    // State
    currentTrack: store.currentTrack,
    isPlaying: store.isPlaying,
    isBuffering: store.isBuffering,
    status: store.status,
    progress,
    position: store.position,
    duration: store.duration,
    volume: store.volume,
    repeatMode: store.repeatMode,
    isShuffle: store.isShuffle,
    queue: store.queue,
    currentIndex: store.currentIndex,

    // Actions
    play: store.play,
    pause: store.pause,
    togglePlayback: store.togglePlayback,
    next: store.next,
    previous: store.previous,
    seek: (p: number) => store.seek(p * store.duration), // Seek by percentage (0-1)
    setVolume: store.setVolume,
    setRepeatMode: store.setRepeatMode,
    toggleShuffle: store.toggleShuffle,
    playTrack,
  };
}
