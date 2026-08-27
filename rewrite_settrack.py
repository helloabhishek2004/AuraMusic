import re

with open('src/features/player/store/player.store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''setTrack: async (track: PlayerTrack) => {
        if (!track || !track.id) return;

        const { queue } = get();
        set({
          currentTrack: track,
          status: "buffering",
          isBuffering: true,
          isPlaying: false,
          position: 0,
          lyrics: null,
          error: null,
          selectedTrackId: track.id,
          selectedTrackIndex: queue.findIndex(t => t.id === track.id)
        });

        try {
          await PlaybackService.loadTrack(track, queue);
        } catch (error) {
          console.error("[PlayerStore] loadTrack failed", error);
          set({ error: "Playback failed" });
        }
      },'''

content = re.sub(r'setTrack: async \(track: PlayerTrack\) => \{.*?(?=addTrackToQueue:)', replacement + '\n\n      ', content, flags=re.DOTALL)

with open('src/features/player/store/player.store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
