import re

with open('src/hooks/use-search.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the entire search block inside the try catch
new_search = """
      // 1. PARALLEL SEARCH
      console.log(`[Search] PRIMARY: Searching for: ${trimmed}`);
      
      const [songsData, artistResults, albumResults] = await Promise.all([
        musicService.searchSongs(trimmed),
        musicService.searchArtists(trimmed).catch(() => []),
        musicService.searchAlbums(trimmed).catch(() => [])
      ]);
      
      if (controller.signal.aborted) return;

      if (songsData.length === 0 && artistResults.length === 0 && albumResults.length === 0) {
        setResults(EMPTY_RESULT);
        setIsLoading(false);
        return;
      }

      setIsEnriching(true);

      // Filter and Deduplicate Artists
      const enrichedArtists: SearchEntity[] = [];
      const seenArtistIds = new Set<string>();
      artistResults.forEach(artist => {
        if (artist && !seenArtistIds.has(artist.id)) {
          seenArtistIds.add(artist.id);
          enrichedArtists.push(artist);
        }
      });

      // Filter and Deduplicate Albums
      const enrichedAlbums: SearchEntity[] = [];
      const seenAlbumIds = new Set<string>();
      albumResults.flat().forEach(album => {
        if (album && !seenAlbumIds.has(album.id)) {
          seenAlbumIds.add(album.id);
          enrichedAlbums.push(album);
        }
      });
"""

content = re.sub(r'// 1\. PRIMARY QUERY: Fetch Songs.*?// Filter and Deduplicate', new_search.strip() + '\n\n      // Filter and Deduplicate', content, flags=re.DOTALL)

with open('src/hooks/use-search.ts', 'w', encoding='utf-8') as f:
    f.write(content)
