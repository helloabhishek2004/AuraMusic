import re

with open('src/components/PlayerOverlay.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace usePlayerStore definitions
content = re.sub(r'const play = usePlayerStore\(s => s\.play\);\n\s*const pause = usePlayerStore\(s => s\.pause\);\n\s*const next = usePlayerStore\(s => s\.next\);\n\s*const prev = usePlayerStore\(s => s\.previous\);', '', content)

content = content.replace('next();', 'import_PlaybackService.skipToNext();')
content = content.replace('prev();', 'import_PlaybackService.skipToPrevious();')
content = content.replace('!isLocked && prev()', '!isLocked && import_PlaybackService.skipToPrevious()')
content = content.replace('!isLocked && next()', '!isLocked && import_PlaybackService.skipToNext()')
content = content.replace('play();', 'import_PlaybackService.play();')
content = content.replace('pause();', 'import_PlaybackService.pause();')

# We need to import PlaybackService
import_stmt = 'import { PlaybackService as import_PlaybackService } from "@/src/features/player/services/playback.service";\n'
if 'import_PlaybackService' not in content:
    content = content.replace('import { usePlayerStore }', import_stmt + 'import { usePlayerStore }')

with open('src/components/PlayerOverlay.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
