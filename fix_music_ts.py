import re

with open('src/services/api/music.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
if 'import { isNativeCoreAvailable, AuraYouTube }' not in content:
    content = 'import { isNativeCoreAvailable, AuraYouTube } from "../native-core";\n' + content

# Fix redeclarations
content = content.replace("const data = await AuraYouTube.getArtistDetails(browseId);", "const nativeData = await AuraYouTube.getArtistDetails(browseId);")
content = content.replace("!data) return null;", "!nativeData) return null;")
content = content.replace("data.id", "nativeData.id")
content = content.replace("data.name", "nativeData.name")
content = content.replace("data.title", "nativeData.title")
content = content.replace("data.description", "nativeData.description")
content = content.replace("data.thumbnail", "nativeData.thumbnail")
content = content.replace("data.art", "nativeData.art")
content = content.replace("data.songs", "nativeData.songs")
content = content.replace("data.albums", "nativeData.albums")
content = content.replace("data.tracks", "nativeData.tracks")
content = content.replace("data.artist", "nativeData.artist")
content = content.replace("data.year", "nativeData.year")

content = content.replace("const data = await AuraYouTube.getAlbumDetails(browseId);", "const nativeData = await AuraYouTube.getAlbumDetails(browseId);")
content = content.replace("const data = await AuraYouTube.searchArtists(query);", "const nativeData = await AuraYouTube.searchArtists(query);")
content = content.replace("const data = await AuraYouTube.searchAlbums(query);", "const nativeData = await AuraYouTube.searchAlbums(query);")

content = content.replace("return nativeData.map", "return nativeData.map")

# Fix videos missing in ArtistDetails
content = content.replace("singles_params: \"\",\n          videos: [],\n          related: []", "singles_params: \"\",\n          related: []")

# Fix art in AlbumDetails
content = content.replace("year: nativeData.year || \"\",\n          art: nativeData.thumbnail || nativeData.art || \"\",", "year: nativeData.year || \"\",\n          thumbnail: nativeData.thumbnail || nativeData.art || \"\",")

with open('src/services/api/music.ts', 'w', encoding='utf-8') as f:
    f.write(content)
