import re
with open('src/services/api/music.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
if 'import { isNativeCoreAvailable, AuraYouTube }' not in content:
    content = 'import { isNativeCoreAvailable, AuraYouTube } from "../native-core";\n' + content

new_searchArtists = """
  searchArtists: async (query: string): Promise<SearchEntity[]> => {
    try {
      if (!query.trim()) return [];
      if (isNativeCoreAvailable() && AuraYouTube) {
        const data = await AuraYouTube.searchArtists(query);
        return data.map((a: any) => ({
          id: a.id, title: a.title, type: 'artist', art: a.art || "", subscribers: ""
        }));
      }
      const response = await apiClient.get(`/search`, { params: { q: query, type: 'artists' } });
"""
content = re.sub(r'searchArtists: async \(query: string\): Promise<SearchEntity\[\]> => \{\s*try \{\s*if \(!query\.trim\(\)\) return \[\];\s*const response = await apiClient\.get\(`/search`,\s*\{\s*params:\s*\{\s*q:\s*query,\s*type:\s*\'artists\'\s*\},?\s*\}\s*\);', new_searchArtists.strip(), content)

new_searchAlbums = """
  searchAlbums: async (query: string): Promise<SearchEntity[]> => {
    try {
      if (!query.trim()) return [];
      if (isNativeCoreAvailable() && AuraYouTube) {
        const data = await AuraYouTube.searchAlbums(query);
        return data.map((a: any) => ({
          id: a.id, title: a.title, type: 'album', artist: a.artist || "", art: a.art || ""
        }));
      }
      const response = await apiClient.get(`/search`, { params: { q: query, type: 'albums' } });
"""
content = re.sub(r'searchAlbums: async \(query: string\): Promise<SearchEntity\[\]> => \{\s*try \{\s*if \(!query\.trim\(\)\) return \[\];\s*const response = await apiClient\.get\(`/search`,\s*\{\s*params:\s*\{\s*q:\s*query,\s*type:\s*\'albums\'\s*\},?\s*\}\s*\);', new_searchAlbums.strip(), content)

new_getArtistDetails = """
  getArtistDetails: async (browseId: string): Promise<ArtistDetails | null> => {
    try {
      if (!browseId) return null;
      if (isNativeCoreAvailable() && AuraYouTube) {
        const nData = await AuraYouTube.getArtistDetails(browseId);
        if (nData) {
          return {
            id: nData.id,
            name: nData.name || nData.title,
            description: nData.description || "",
            thumbnail: nData.art || nData.thumbnail || "",
            subscribers: "",
            songs: (nData.songs || []).map((s: any) => ({
              id: s.id, title: s.title, artist: s.artist, album: s.album, duration: s.duration, art: s.artworkUrl || s.art || "", source: 'ytmusic'
            })),
            songs_params: "",
            albums: (nData.albums || []).map((a: any) => ({
              id: a.id, title: a.title, year: a.year || "", art: a.art || a.thumbnail || ""
            })),
            albums_params: "",
            singles: [],
            singles_params: "",
            related: []
          };
        }
      }
      const response = await apiClient.get(`/artist/${browseId}`);
"""
content = re.sub(r'getArtistDetails: async \(browseId: string\): Promise<ArtistDetails \| null> => \{\s*try \{\s*if \(!browseId\) return null;\s*const response = await apiClient\.get\(`/artist/\$\{browseId\}`\);', new_getArtistDetails.strip(), content)

new_getAlbumDetails = """
  getAlbumDetails: async (browseId: string): Promise<AlbumDetails | null> => {
    try {
      if (!browseId) return null;
      if (isNativeCoreAvailable() && AuraYouTube) {
        const nData = await AuraYouTube.getAlbumDetails(browseId);
        if (nData) {
          return {
            id: nData.id,
            title: nData.title,
            artist: nData.artist || "",
            year: nData.year || "",
            thumbnail: nData.thumbnail || nData.art || "",
            tracks: (nData.tracks || nData.songs || []).map((s: any) => ({
              id: s.id, title: s.title, artist: s.artist || nData.artist || "", album: nData.title, duration: s.duration, art: s.artworkUrl || s.art || nData.thumbnail || "", source: 'ytmusic'
            }))
          };
        }
      }
      const response = await apiClient.get(`/album/${browseId}`);
"""
content = re.sub(r'getAlbumDetails: async \(browseId: string\): Promise<AlbumDetails \| null> => \{\s*try \{\s*if \(!browseId\) return null;\s*const response = await apiClient\.get\(`/album/\$\{browseId\}`\);', new_getAlbumDetails.strip(), content)

with open('src/services/api/music.ts', 'w', encoding='utf-8') as f:
    f.write(content)
