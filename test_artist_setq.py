import re

with open('app/artist/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('const setQueue')
print(content[idx-50:idx+150])

