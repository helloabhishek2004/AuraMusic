import re

with open('app/artist/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('handleTrackPress')
print(content[idx-200:idx+800])

