import re

with open('src/hooks/use-search.ts', 'r', encoding='utf-8') as f:
    content = f.read()

target_start = "// 1. PRIMARY SEARCH: Songs"
target_end = "// 3. UPDATE STATE"

start_idx = content.find(target_start)
end_idx = content.find(target_end)

if start_idx != -1 and end_idx != -1:
    new_code = """// 1. PARALLEL SEARCH
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
    
    content = content[:start_idx] + new_code + content[end_idx:]

    with open('src/hooks/use-search.ts', 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Could not find start or end index!")
