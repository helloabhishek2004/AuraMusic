import re

with open('src/context/MusicContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('MusicActionsContext.Provider')
print(content[idx-600:idx+300])

