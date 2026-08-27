import re

with open('src/components/PlayerOverlay.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_stmt = 'import { PlaybackService } from "@/src/features/player/services/playback.service";\n'
if 'import { PlaybackService }' not in content:
    content = import_stmt + content

with open('src/components/PlayerOverlay.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
