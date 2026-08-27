import re

with open('app/artist/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('setQueue')
print(content[idx-100:idx+100])

