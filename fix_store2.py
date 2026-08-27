import re

with open('src/features/player/store/player.store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('PlaybackService.setRepeatMode(mode);', '')
content = content.replace('PlaybackService.setRepeatMode(newMode);', '')
content = content.replace('PlaybackService.setRepeatMode(repeatMode);', '')

with open('src/features/player/store/player.store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
