import re

with open("src/context/MusicContext.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add static import at the top
if 'import { PlaybackService }' not in content:
    content = content.replace('import { playbackProgress } from "../features/player/services/playback-progress";', 'import { playbackProgress } from "../features/player/services/playback-progress";\nimport { PlaybackService } from "../features/player/services/playback.service";')

# Remove dynamic imports
content = re.sub(r'^\s*const\s*\{\s*PlaybackService\s*\}\s*=\s*await\s*import\([^)]+\);\s*$', '', content, flags=re.MULTILINE)

with open("src/context/MusicContext.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Replaced!")
