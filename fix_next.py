import re

with open('src/context/MusicContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("next: async () => usePlayerStore.getState().next(),", "next: async () => { import('../features/player/services/playback.service').then(m => m.PlaybackService.skipToNext()) },")
content = content.replace("previous: async () => usePlayerStore.getState().previous(),", "previous: async () => { import('../features/player/services/playback.service').then(m => m.PlaybackService.skipToPrevious()) },")

with open('src/context/MusicContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/features/player/services/playback.controller.ts', 'r', encoding='utf-8') as f:
    content2 = f.read()

content2 = content2.replace("store.next();", "PlaybackService.skipToNext();")

with open('src/features/player/services/playback.controller.ts', 'w', encoding='utf-8') as f:
    f.write(content2)
