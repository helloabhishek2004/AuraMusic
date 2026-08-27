import re

with open('src/services/api/music.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace getArtistDetails
new_getArtistDetails = '''
  getArtistDetails: async (browseId: string): Promise<ArtistDetails | null> => {
    try {
      if (!browseId) return null;

      if (isNativeCoreAvailable() && AuraYouTube) {
        console.log("[Music Service] Using Native getArtistDetails");
        const data = await AuraYouTube.getArtistDetails(browseId);
        if (!data) return null;
        
        return {
          id: data.id,
          name: data.name || data.title,
          description: data.description || "",
          thumbnail: data.art || data.thumbnail || "",
          subscribers: "",
          songs: (data.songs || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            art: s.artworkUrl || s.art || "",
            source: 'ytmusic'
          })),
          songs_params: "",
          albums: (data.albums || []).map((a: any) => ({
            id: a.id,
            title: a.title,
            year: a.year || "",
            art: a.art || a.thumbnail || ""
          })),
          albums_params: "",
          singles: [],
          singles_params: "",
          videos: [],
          related: []
        };
      }

      const response = await apiClient.get(/artist/);
      const data = response.data;

      if (!data) return null;
'''
content = re.sub(r'getArtistDetails: async \(browseId: string\): Promise<ArtistDetails \| null> => \{\s*try \{\s*if \(!browseId\) return null;\s*const response = await apiClient\.get', new_getArtistDetails.strip(), content)

# Replace getAlbumDetails
new_getAlbumDetails = '''
  getAlbumDetails: async (browseId: string): Promise<AlbumDetails | null> => {
    try {
      if (!browseId) return null;

      if (isNativeCoreAvailable() && AuraYouTube) {
        console.log("[Music Service] Using Native getAlbumDetails");
        const data = await AuraYouTube.getAlbumDetails(browseId);
        if (!data) return null;

        return {
          id: data.id,
          title: data.title,
          artist: data.artist || "",
          year: data.year || "",
          art: data.thumbnail || data.art || "",
          tracks: (data.tracks || data.songs || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            artist: s.artist || data.artist || "",
            album: data.title,
            duration: s.duration,
            art: s.artworkUrl || s.art || data.thumbnail || "",
            source: 'ytmusic'
          }))
        };
      }

      const response = await apiClient.get(/album/);
      const data = response.data;
'''
content = re.sub(r'getAlbumDetails: async \(browseId: string\): Promise<AlbumDetails \| null> => \{\s*try \{\s*if \(!browseId\) return null;\s*const response = await apiClient\.get', new_getAlbumDetails.strip(), content)

with open('src/services/api/music.ts', 'w', encoding='utf-8') as f:
    f.write(content)
