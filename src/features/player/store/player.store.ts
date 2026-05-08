import { create } from "zustand";
import { PlaybackService } from "../services/playback.service";
import {
    PlaybackStatus,
    PlayerStore,
    PlayerTrack,
    RepeatMode,
} from "../types/player";

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  // State
  currentTrack: null,
  queue: [],
  currentIndex: -1,
  status: "idle",
  isPlaying: false,
  isBuffering: false,
  duration: 0,
  position: 0,
  bufferedPosition: 0,
  volume: 1.0,
  repeatMode: "off",
  isShuffle: false,
  error: null,

  // Actions
  setTrack: async (track: PlayerTrack) => {
    console.log("[Player] Track selected:", {
      id: track.id,
      title: track.title,
      artist: track.artist,
    });
    set({
      currentTrack: track,
      status: "loading",
      isPlaying: false,
      position: 0,
    });
    try {
      await PlaybackService.loadTrack(track);
      console.log("[Player] Track loaded successfully:", track.id);
      set({ status: "playing", isPlaying: true });
    } catch (error) {
      console.error("[Player] setTrack failed:", error);
      set({ status: "error", error: (error as Error).message });
    }
  },

  setQueue: async (tracks: PlayerTrack[], startIndex: number = 0) => {
    set({ queue: tracks, currentIndex: startIndex });
    if (tracks[startIndex]) {
      await get().setTrack(tracks[startIndex]);
    }
  },

  play: async () => {
    try {
      await PlaybackService.play();
      set({ isPlaying: true, status: "playing" });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  pause: async () => {
    try {
      await PlaybackService.pause();
      set({ isPlaying: false, status: "paused" });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  togglePlayback: async () => {
    if (get().isPlaying) {
      await get().pause();
    } else {
      await get().play();
    }
  },

  stop: async () => {
    await PlaybackService.stop();
    set({ isPlaying: false, status: "idle", position: 0 });
  },

  next: async () => {
    const { queue, currentIndex, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    let nextIndex = currentIndex + 1;

    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      if (repeatMode === "queue") {
        nextIndex = 0;
      } else {
        return; // End of queue
      }
    }

    set({ currentIndex: nextIndex });
    await get().setTrack(queue[nextIndex]);
  },

  previous: async () => {
    const { queue, currentIndex, position } = get();
    if (queue.length === 0) return;

    // If more than 3 seconds in, restart track
    if (position > 3000) {
      await get().seek(0);
      return;
    }

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    set({ currentIndex: prevIndex });
    await get().setTrack(queue[prevIndex]);
  },

  seek: async (position: number) => {
    try {
      await PlaybackService.seek(position);
      set({ position });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  setVolume: async (volume: number) => {
    await PlaybackService.setVolume(volume);
    set({ volume });
  },

  setRepeatMode: (mode: RepeatMode) => {
    set({ repeatMode: mode });
  },

  toggleShuffle: () => {
    set((state) => ({ isShuffle: !state.isShuffle }));
  },

  updateProgress: (position: number, duration: number, buffered: number) => {
    set({ position, duration, bufferedPosition: buffered });
  },

  setStatus: (status: PlaybackStatus) => {
    set({
      status,
      isPlaying: status === "playing",
      isBuffering: status === "buffering",
    });
  },
}));
