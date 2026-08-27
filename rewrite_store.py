import re

with open('src/features/player/store/player.store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace next
content = re.sub(r'next: async \(\) => \{.*?(?=previous:)', '''next: async () => {
        try {
          await PlaybackService.skipToNext();
        } catch (e) {
          console.error("[PlayerStore] skipToNext failed:", e);
        }
      },

      ''', content, flags=re.DOTALL)

# Replace previous
content = re.sub(r'previous: async \(\) => \{.*?(?=seekTo:)', '''previous: async () => {
        try {
          await PlaybackService.skipToPrevious();
        } catch (e) {
          console.error("[PlayerStore] skipToPrevious failed:", e);
        }
      },

      ''', content, flags=re.DOTALL)

# Replace preloadNext
content = re.sub(r'preloadNext: async \(\) => \{.*?(?=resolveAutoAdvance:)', '''preloadNext: async () => {
        // Native Media3 handles buffering of the next item in the MediaItem list automatically.
        // JS manual preload resolution is no longer needed.
      },

      ''', content, flags=re.DOTALL)

with open('src/features/player/store/player.store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
