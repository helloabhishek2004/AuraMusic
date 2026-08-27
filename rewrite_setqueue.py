import re

with open('src/features/player/store/player.store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''
      setQueue: async (tracks, startIndex = 0, context) => {
        if (!tracks || tracks.length === 0) return;
        
        const currentTrack = tracks[startIndex];
        if (!currentTrack) return;

        const guard = get()._transitionGuard;
        set({
          queue: tracks,
          originalQueue: tracks,
          currentIndex: startIndex,
          currentTrack: currentTrack,
          status: "buffering",
          isBuffering: true,
          isPlaying: false,
          position: 0,
          lyrics: null,
          error: null,
          selectedTrackId: currentTrack.id,
          selectedTrackIndex: startIndex,
          queueContext: context || null,
          _transitionGuard: { ...guard, inProgress: true, owner: "setQueue", destinationId: currentTrack.id, operationId: guard.operationId + 1 }
        });

        try {
          await PlaybackService.loadTrack(currentTrack, tracks, startIndex);
        } catch (error) {
          console.error("[PlayerStore] setQueue native load failed:", error);
          set({ error: "Failed to load queue" });
        }
      },

      setTrack: async (track) => {
'''

content = content.replace('      setTrack: async (track) => {', replacement)
with open('src/features/player/store/player.store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
