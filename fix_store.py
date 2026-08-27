import re

with open('src/features/player/store/player.store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove ExtendedPlayerStore interface properties that aren't implemented
content = re.sub(r'  injectAutoplayQueue: \(tracks: PlayerTrack\[\]\) => Promise<void>;', '', content)

with open('src/features/player/store/player.store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
