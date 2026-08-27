import re

with open('src/services/api/music.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace searchArtists
new_searchArtists = '''
  searchArtists: async (query: string): Promise<SearchEntity[]> => {
    try {
      if (!query.trim()) return [];

      if (isNativeCoreAvailable() && AuraYouTube) {
        console.log("[Music Service] Using Native searchArtists");
        const data = await AuraYouTube.searchArtists(query);
        return data.map((a: any) => ({
          id: a.id,
          title: a.title,
          type: 'artist',
          art: a.art || "",
          subscribers: ""
        }));
      }

      const response = await apiClient.get(/search, {
        params: { q: query, type: 'artists' },
      });
'''
content = re.sub(r'searchArtists: async \(query: string\): Promise<SearchEntity\[\]> => \{\s*try \{\s*if \(!query\.trim\(\)\) return \[\];\s*const response = await apiClient\.get', new_searchArtists.strip(), content)

# Replace searchAlbums
new_searchAlbums = '''
  searchAlbums: async (query: string): Promise<SearchEntity[]> => {
    try {
      if (!query.trim()) return [];

      if (isNativeCoreAvailable() && AuraYouTube) {
        console.log("[Music Service] Using Native searchAlbums");
        const data = await AuraYouTube.searchAlbums(query);
        return data.map((a: any) => ({
          id: a.id,
          title: a.title,
          type: 'album',
          artist: a.artist || "",
          art: a.art || ""
        }));
      }

      const response = await apiClient.get(/search, {
        params: { q: query, type: 'albums' },
      });
'''
content = re.sub(r'searchAlbums: async \(query: string\): Promise<SearchEntity\[\]> => \{\s*try \{\s*if \(!query\.trim\(\)\) return \[\];\s*const response = await apiClient\.get', new_searchAlbums.strip(), content)

with open('src/services/api/music.ts', 'w', encoding='utf-8') as f:
    f.write(content)
