import re

with open('src/context/MusicContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('setQueue: ')
if idx != -1:
    print(content[idx-100:idx+300])
else:
    for m in re.finditer(r'setQueue', content):
        idx = m.start()
        print(content[idx-50:idx+50])

