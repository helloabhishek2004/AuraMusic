import { catalogTracks } from './src/data/music-catalog';
import { getArtworkUrl } from './src/features/player/utils/track-identity';

async function runAudit() {
  console.log('--- PHASE B: COVERAGE CENSUS ---');
  console.log('Total Tracks:', catalogTracks.length);
  
  let valid = 0;
  let placeholder = 0;
  let missing = 0;
  
  const results: any[] = [];
  
  catalogTracks.forEach((t: any) => {
    const rawArt = t.art || t.artworkUrl || t.image || '';
    
    if (!rawArt) {
      missing++;
    } else if (rawArt.includes('placeholder') || rawArt.includes('picsum') || rawArt.includes('generated')) {
      placeholder++;
    } else {
      valid++;
    }
    
    const resolvedUrl = getArtworkUrl(t, 'album');
    results.push({
      id: t.id,
      title: t.title,
      artist: t.artist,
      originalArt: rawArt,
      resolvedArt: resolvedUrl
    });
  });
  
  console.log('Valid Art:', valid);
  console.log('Placeholder Art:', placeholder);
  console.log('Missing Art:', missing);
  
  console.log('\n--- PHASE A: END-TO-END TRACE ---');
  // Log the first track that has valid art
  const sampleTrack = results.find(r => r.originalArt && !r.originalArt.includes('picsum') && r.originalArt.includes('-'));
  if (sampleTrack) {
      console.log('Found track with hyphenated URL:');
      console.log(JSON.stringify(sampleTrack, null, 2));
  } else {
      console.log('No track with hyphenated URL found, checking first valid track:');
      console.log(JSON.stringify(results.find(r => r.originalArt && !r.originalArt.includes('picsum')), null, 2));
  }
}

runAudit().catch(console.error);
