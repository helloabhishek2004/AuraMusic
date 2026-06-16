import { useAnalyticsStore } from './src/features/analytics/store/analytics.store';
import { useRecommendationsStore } from './src/features/recommendations/store/recommendations.store';

function runAudit() {
  console.log("=== SPRINT 18.2 AUDIT ===");

  const analytics = useAnalyticsStore.getState();
  const recommendations = useRecommendationsStore.getState();

  const sections = {
    topTracks: analytics.computed.topTracks || [],
    favoriteArtists: analytics.userTasteProfile?.favoriteArtists || [],
    favoriteAlbums: analytics.userTasteProfile?.favoriteAlbums || [],
    becauseYouLike: recommendations.becauseYouLike || [],
    dailyMixes: recommendations.dailyMixes || []
  };

  for (const [name, data] of Object.entries(sections)) {
    console.log(`\n--- ${name} (${data.length} items) ---`);
    const sample = data.slice(0, 3);
    for (const item of sample as any[]) {
      console.log(`Title: ${item.title || item.name || 'Unknown'}`);
      console.log(`ID: ${item.id} | Valid ID Format? ${item.id && !item.id.includes('undefined') && !item.id.includes('picsum') && !item.id.startsWith('p')}`);
      console.log(`Artwork field: ${item.artwork || item.image || item.coverArt || 'None'}`);
    }
  }

  // Audit Daily Mix track storing capability
  console.log(`\n--- Daily Mix Structure ---`);
  const mix = recommendations.dailyMixes?.[0];
  if (mix) {
    console.log(`Seed Artists: ${mix.seedArtists?.join(', ')}`);
    console.log(`Has Track IDs embedded? ${mix.trackIds ? 'Yes' : 'No'}`);
  }
}

setTimeout(() => {
  try {
    runAudit();
  } catch (e) {
    console.error(e);
  }
}, 2000);
