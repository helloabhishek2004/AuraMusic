import re

with open('src/components/PlayerOverlay.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('PlaybackService.PlaybackService', 'PlaybackService')

with open('src/components/PlayerOverlay.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
