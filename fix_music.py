import re
with open('src/services/api/music.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const response = await apiClient.get(/search, {\n        params: { q: query, type: 'artists' },\n      });(/search, {\n        params: { q: query, type: 'artists' },\n      });",
"const response = await apiClient.get(/search, {\n        params: { q: query, type: 'artists' },\n      });")

content = content.replace("const response = await apiClient.get(/search, {\n        params: { q: query, type: 'albums' },\n      });(/search, {\n        params: { q: query, type: 'albums' },\n      });",
"const response = await apiClient.get(/search, {\n        params: { q: query, type: 'albums' },\n      });")

with open('src/services/api/music.ts', 'w', encoding='utf-8') as f:
    f.write(content)
