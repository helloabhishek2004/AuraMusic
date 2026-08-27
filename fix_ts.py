import re

with open('src/components/PlayerOverlay.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import_PlaybackService', 'PlaybackService')

import_stmt = 'import { PlaybackService } from "@/src/features/player/services/playback.service";\n'
if 'import { PlaybackService }' not in content:
    content = import_stmt + content

# Fix prev() and play() inside runX functions or elsewhere
content = content.replace('!isLocked && prev()', '!isLocked && PlaybackService.skipToPrevious()')
content = content.replace('!isLocked && next()', '!isLocked && PlaybackService.skipToNext()')
content = content.replace('prev();', 'PlaybackService.skipToPrevious();')
content = content.replace('next();', 'PlaybackService.skipToNext();')
content = content.replace('play();', 'PlaybackService.play();')
content = content.replace('pause();', 'PlaybackService.pause();')

# Fix play() missing
# error TS2304: Cannot find name 'play'.
content = re.sub(r'const { toggleRepeat, toggleShuffle } = useMusicActions\(\);', r'const { toggleRepeat, toggleShuffle, play, pause, prev, next } = useMusicActions();', content)

with open('src/components/PlayerOverlay.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
