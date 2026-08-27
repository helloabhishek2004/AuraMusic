import re
with open('src/services/api/music.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix searchArtists
content = content.replace("const response = await apiClient.get(/search, {\n        params: { q: query, type: 'artists' },\n      });",
"const response = await apiClient.get(/search, {\n        params: { q: query, type: 'artists' },\n      });")

# Fix searchAlbums
content = content.replace("const response = await apiClient.get(/search, {\n        params: { q: query, type: 'albums' },\n      });",
"const response = await apiClient.get(/search, {\n        params: { q: query, type: 'albums' },\n      });")

# Fix getArtistDetails
content = content.replace("const response = await apiClient.get(/artist/);\n      const data = response.data;(/artist/\);",
"const response = await apiClient.get(/artist/\);\n      const data = response.data;")

content = content.replace("const response = await apiClient.get(/artist/);\n      const data = response.data;",
"const response = await apiClient.get(/artist/\);\n      const data = response.data;")

# Fix getAlbumDetails
content = content.replace("const response = await apiClient.get(/album/);\n      const data = response.data;(/album/\);",
"const response = await apiClient.get(/album/\);\n      const data = response.data;")

content = content.replace("const response = await apiClient.get(/album/);\n      const data = response.data;",
"const response = await apiClient.get(/album/\);\n      const data = response.data;")

with open('src/services/api/music.ts', 'w', encoding='utf-8') as f:
    f.write(content)
