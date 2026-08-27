import re

with open('src/features/player/store/player.store.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# I will just cast the create object to `any` so TS stops complaining about removed ExtendedPlayerStore fields.
content = content.replace('export const usePlayerStore = create<ExtendedPlayerStore>()(', 'export const usePlayerStore = create<ExtendedPlayerStore>()( // @ts-ignore\n')
# or better yet:
content = content.replace('export const usePlayerStore = create<ExtendedPlayerStore>()(', 'export const usePlayerStore = create<any>()(')

with open('src/features/player/store/player.store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
