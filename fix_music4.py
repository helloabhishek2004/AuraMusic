import re
with open('src/services/api/music.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'apiClient\.get\(.*?/artist/.*?\)', 'apiClient.get(`/artist/${browseId}`)', content)
content = re.sub(r'apiClient\.get\(.*?/album/.*?\)', 'apiClient.get(`/album/${browseId}`)', content)
content = content.replace("(`/search`, {\n        params: { q: query, type: 'artists' },\n      });(`/search`, {\n        params: { q: query, type: 'artists' },\n      });", "(`/search`, {\n        params: { q: query, type: 'artists' },\n      });")
content = content.replace("(`/search`, {\n        params: { q: query, type: 'albums' },\n      });(`/search`, {\n        params: { q: query, type: 'albums' },\n      });", "(`/search`, {\n        params: { q: query, type: 'albums' },\n      });")
content = content.replace("const data = response.data;(`/album/${browseId}`);", "const data = response.data;")

with open('src/services/api/music.ts', 'w', encoding='utf-8') as f:
    f.write(content)
