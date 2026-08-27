import re

with open('src/context/MusicContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all usePlayerStore.getState().X() calls with PlaybackService calls
old_actions = """  const actionsValue = useMemo<MusicActionsContextType>(
    () => ({
      play: async (track?: Track) => track ? usePlayerStore.getState().setTrack(track) : usePlayerStore.getState().play(),
      pause: async () => usePlayerStore.getState().pause(),
      next: async () => { import('../features/player/services/playback.service').then(m => m.PlaybackService.skipToNext()) },
      prev: async (forcePrevious?: boolean) => usePlayerStore.getState().previous(forcePrevious),
      seek: async (p: number) => {
        const duration = usePlayerStore.getState().duration;
        await usePlayerStore.getState().seek(p * duration);
      },
      setTrack: async (track: Track) => usePlayerStore.getState().setTrack(track),
      setQueue: async (tracks: Track[], startIndex?: number, context?: QueueContext) => usePlayerStore.getState().setQueue(tracks, startIndex, context),
      playNext: (track: Track) => usePlayerStore.getState().playNext(track),
      addToQueue: (track: Track) => usePlayerStore.getState().addToQueue(track),
      toggleRepeat,
      toggleShuffle: async () => usePlayerStore.getState().setShuffle(!usePlayerStore.getState().isShuffle),
      setVolume: async (volume: number) => usePlayerStore.getState().setVolume(volume),
      preloadTrack: async (track: Track) => usePlayerStore.getState().preloadTrack(track),
    }),
    [toggleRepeat],
  );"""

new_actions = """  const actionsValue = useMemo<MusicActionsContextType>(
    () => ({
      play: async (track?: Track) => { 
        if (track) {
            const { PlaybackService } = await import('../features/player/services/playback.service');
            await PlaybackService.loadTrack(track, [track], 0);
        } else {
            const { PlaybackService } = await import('../features/player/services/playback.service');
            await PlaybackService.play();
        }
      },
      pause: async () => {
          const { PlaybackService } = await import('../features/player/services/playback.service');
          await PlaybackService.pause();
      },
      next: async () => { 
          const { PlaybackService } = await import('../features/player/services/playback.service');
          await PlaybackService.skipToNext();
      },
      prev: async (forcePrevious?: boolean) => {
          const { PlaybackService } = await import('../features/player/services/playback.service');
          await PlaybackService.skipToPrevious();
      },
      seek: async (p: number) => {
        const duration = usePlayerStore.getState().duration;
        const { PlaybackService } = await import('../features/player/services/playback.service');
        await PlaybackService.seek(p * duration);
      },
      setTrack: async (track: Track) => {
          const { PlaybackService } = await import('../features/player/services/playback.service');
          await PlaybackService.loadTrack(track, [track], 0);
      },
      setQueue: async (tracks: Track[], startIndex?: number, context?: QueueContext) => {
          const { PlaybackService } = await import('../features/player/services/playback.service');
          if (tracks.length > 0) {
              const activeIdx = startIndex ?? 0;
              await PlaybackService.loadTrack(tracks[activeIdx], tracks, activeIdx);
          }
      },
      playNext: (track: Track) => { console.warn('playNext unimplemented natively'); },
      addToQueue: (track: Track) => { console.warn('addToQueue unimplemented natively'); },
      toggleRepeat,
      toggleShuffle: async () => usePlayerStore.getState().setShuffle(!usePlayerStore.getState().isShuffle),
      setVolume: async (volume: number) => {
          const { PlaybackService } = await import('../features/player/services/playback.service');
          await PlaybackService.setVolume(volume);
      },
      preloadTrack: async (track: Track) => null,
    }),
    [toggleRepeat],
  );"""

if "setQueue: async (tracks: Track" in content:
    content = re.sub(r'const actionsValue = useMemo<MusicActionsContextType>\([\s\S]*?\[toggleRepeat\],\s*\);', new_actions, content)
    with open('src/context/MusicContext.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched MusicContext!")
else:
    print("Could not find exact actionsValue string")

