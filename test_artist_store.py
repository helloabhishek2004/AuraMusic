import re

with open('app/artist/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

for m in re.finditer(r'usePlayerStore\(.*', content):
    print(m.group(0))

