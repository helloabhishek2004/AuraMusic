import re

with open('src/services/native-core.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  getArtistDetails(browseId: string): Promise<any>;\n  getAlbumDetails(browseId: string): Promise<any>;\n}',
    '  getArtistDetails(browseId: string): Promise<any>;\n  getAlbumDetails(browseId: string): Promise<any>;\n  searchArtists(query: string): Promise<any[]>;\n  searchAlbums(query: string): Promise<any[]>;\n}'
)

with open('src/services/native-core.ts', 'w', encoding='utf-8') as f:
    f.write(content)
