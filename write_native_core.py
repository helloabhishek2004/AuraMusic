import re

with open('src/services/native-core.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  getTrack(videoId: string): Promise<NativeTrack>;\n}',
    '  getTrack(videoId: string): Promise<NativeTrack>;\n  getArtistDetails(browseId: string): Promise<any>;\n  getAlbumDetails(browseId: string): Promise<any>;\n}'
)

with open('src/services/native-core.ts', 'w', encoding='utf-8') as f:
    f.write(content)
