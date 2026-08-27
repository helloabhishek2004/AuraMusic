import re

with open('src/features/player/store/player.store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# I am going to delete these properties from the ExtendedPlayerStore interface entirely!
lines_to_remove = [
    'addToQueue: (tracks: PlayerTrack[]) => Promise<void>;',
    'playNext: (track: PlayerTrack) => Promise<void>;',
    'removeFromQueue: (index: number) => Promise<void>;',
    'reorderQueue: (from: number, to: number) => Promise<void>;',
    'clearOriginalQueue: () => void;',
    'seekTo: (position: number) => Promise<void>;',
    'skipToNext: () => Promise<void>;',
    'skipToPrevious: () => Promise<void>;',
    'shuffle: () => Promise<void>;',
    'setRepeatMode: (mode: RepeatMode) => Promise<void>;',
    'updateQueue: (tracks: PlayerTrack[]) => void;',
    'play: () => Promise<void>;',
    'pause: () => Promise<void>;',
    'stop: () => Promise<void>;'
]

for line in lines_to_remove:
    content = content.replace(line, '')

with open('src/features/player/store/player.store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
