import re

with open('src/context/MusicContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('const actionsValue')
print(content[idx-50:idx+600])

