# SPRINT 16.9 — HOME EXPERIENCE FORENSIC AUDIT

## EXECUTIVE SUMMARY

The Home screen renders **6 sections** but defines **11 card components**. The 6 rendered sections contain **at most 14 visible items**, of which **7 have real artwork** (the greeting, hero, and cleanup card have no artwork dependency). The screen is **visually empty** because **5 card types and their corresponding sections are defined in code but never wired into the section renderer**. Actual user data (likes, analytics top tracks/artists/albums, recommendation seeds) exists in stores but has **zero visual representation** on the Home screen.

---

## PHASE A — HOME SECTION CENSUS

### How the Home screen is built

The screen uses a **stable sections array** at `index.tsx:667-674`:

```
sectionsData = [
  { id: 'welcome', type: 'welcome' },
  { id: 'hero', type: 'hero' },
  { id: 'cleanup', type: 'cleanup' },          ← conditional, often hidden
  { id: 'continue_listening', type: 'continue_listening' },
  { id: 'recently_played', type: 'recently_played' },
  { id: 'daily_mixes', type: 'daily_mixes' },
]
```

### Section-by-section breakdown

| Section | Cards | Items Supplied | Items Rendered | With Artwork | W/O Artwork | Data Source | Real/Hardcoded |
|---|---|---|---|---|---|---|---|
| Welcome | — | — | — | — | — | Hardcoded time-based string | Hardcoded |
| Hero | BentoCard | 1 | 1 | 1 (picsum) | 0 | Hardcoded in renderSectionItem | **Hardcoded** |
| Cleanup | LibraryCleanupCard | 1 (conditional) | 0-1 | — | — | library-health.store | Real but hidden if <50MB waste |
| Continue Listening | ContinueListeningCard | 0-10 | 0-7 | 0 (null art) | 7 | analytics.computed.continueListening | **Real but art=null** |
| Recently Played | RecentlyPlayedCard | 0-20 | 0-20 | 0 (null art) | 20 | analytics.computed.recentlyPlayed | **Real but art=null** |
| Daily Mixes | DailyMixCard | 3 | 3 | 3 (picsum) | 0 | Hardcoded in DailyMixesSection | **Hardcoded** |

### Card components defined but NEVER instantiated in the Home screen

| Card Component | File:Line | Purpose | Status |
|---|---|---|---|
| **TrackCard** | `index.tsx:122` | Vertical track list with heart/download | **UNUSED** |
| **CircleArtistCard** | `index.tsx:381` | Circular artist portrait with affinity score | **UNUSED** |
| **FavoriteAlbumCard** | `index.tsx:412` | Album cover with title/artist | **UNUSED** |
| **BecauseYouLikeCard** | `index.tsx:478` | Artist-based recommendation card | **UNUSED** |
| **SeedTrackCard** | `index.tsx:510` | Track seed card | **UNUSED** |

### Sections with store data but NO screen presence

| Section | Store Has Data? | Card Exists? | Wired to Home? |
|---|---|---|---|
| Top Songs | ✅ recommendations.topSongs (0-25) | ✅ SeedTrackCard exists | ❌ |
| Top Artists | ✅ recommendations.topArtists (0-10) | ✅ CircleArtistCard exists | ❌ |
| Favorite Albums | ✅ analytics.topAlbums | ✅ FavoriteAlbumCard exists | ❌ |
| Favorite Artists | ✅ analytics.topArtists/favoriteArtists | ✅ CircleArtistCard exists | ❌ |
| Made For You | ✅ recommendations.madeForYou (0-6) | — | ❌ |
| Because You Like | ✅ recommendations.becauseYouLike (0-5) | ✅ BecauseYouLikeCard exists | ❌ |
| Rediscover | ✅ recommendations.rediscover (0-10) | ✅ SeedTrackCard exists | ❌ |
| Recently Loved | ✅ recommendations.recentlyLoved (0-10) | ✅ TrackCard exists | ❌ |
| Hidden Gems | ✅ recommendations.hiddenGems (0-25) | ✅ SeedTrackCard exists | ❌ |
| Forgotten Favorites | ✅ recommendations.forgottenFavorites (0-25) | ✅ SeedTrackCard exists | ❌ |
| Trending For You | ✅ recommendations.trendingForYou | — | ❌ |

**Total potential Home screen capacity: ~100+ items**
**Actual rendered items: ~10-14 (with 7 showing gradient-only artwork)**

---

## PHASE B — ANALYTICS AUDIT

### Store structure (`analytics.store.ts`)

```
AnalyticsState:
├── history: HistoryEntry[]                    ← persisted, capped at 1000
├── artistAffinities: Record<string, ...>      ← persisted
├── albumAffinities: Record<string, ...>       ← persisted
├── trackAffinities: Record<string, ...>       ← persisted
├── artistCache: Record<string, {id, image}>   ← persisted
├── userTasteProfile: {
│   ├── favoriteArtists: string[]              ← TOP 5 artist NAMES only
│   └── favoriteAlbums: string[]               ← TOP 5 album NAMES only
│}                                             ← persisted
└── computed: {                                ← NOT persisted (rebuilt on rehydration)
    ├── continueListening: HistoryEntry[]       ← max 10
    ├── recentlyPlayed: HistoryEntry[]          ← max 20
    ├── topArtists: (AffinityMetric & {name})[] ← max 30
    ├── topAlbums: (AffinityMetric & {name})[]  ← max 30
    └── topTracks: (AffinityMetric & {name})[]  ← max 30
}
```

### Critical finding: `computed` is NOT in `partialize`

Lines 845-862 (`analytics.store.ts`):
```typescript
partialize: (state) => ({
    history: state.history,
    artistAffinities: state.artistAffinities,
    albumAffinities: state.albumAffinities,
    trackAffinities: state.trackAffinities,
    artistCache: state.artistCache || {},
    artistProfileCache: state.artistProfileCache || {},
    userTasteProfile: state.userTasteProfile || null,
    // ❌ computed is NOT here!
    // continueListening, recentlyPlayed, topArtists, topAlbums, topTracks are all excluded
    ...
}),
```

These computed collections ARE rebuilt on rehydration via `onRehydrateStorage` (line 867), but only if rebuildComputedCollections() runs successfully. If rehydration fails or is interrupted, the Home screen sections render nothing.

### No Favorite Songs / Favorite Albums / Favorite Artists as State

There are no `favoriteSongs`, `favoriteAlbums`, or `favoriteArtists` arrays in the analytics store at the top level. The only approximation is:
- `userTasteProfile.favoriteArtists: string[]` — JUST NAMES, no metadata
- `userTasteProfile.favoriteAlbums: string[]` — JUST NAMES, no metadata
- `computed.topArtists` — has metadata but NOT persisted, NOT rendered to Home
- `computed.topTracks` — same issue

### Likes store has data (`likes.store.ts`)

```
LikesState:
├── likedTrackIds: Record<string, boolean>     ← persisted
├── likedAt: Record<string, number>            ← persisted
├── trackMetadata: Record<string, Partial<PlayerTrack>>  ← persisted (has art, title, artist)
└── latestLikedTrackId: string | null
```

This store has rich artwork data (`trackMetadata[trackId].art`), but the Home screen **never reads it**. No section renders liked songs.

---

## PHASE C — RECOMMENDATION ENGINE AUDIT

### Generator outputs (theoretical maximums)

| Generator | File:Line | Max Seeds | Artwork Source | Artwork Fallback |
|---|---|---|---|---|
| `generateDailyMixes` | `rec-engine.ts:80` | 3 | artistCache → picsum | picsum.photos |
| `generateBecauseYouLike` | `rec-engine.ts:120` | 5 | artistCache → match.art → picsum | picsum.photos |
| `generateRediscover` | `rec-engine.ts:159` | 10 | entry.art → picsum | picsum.photos |
| `generateRecentlyLoved` | `rec-engine.ts:194` | 10 | match.art → picsum | picsum.photos |
| `generateMadeForYou` | `rec-engine.ts:287` | 6 | artistCache → picsum | picsum.photos + unsplash |
| `generateHiddenGems` | `rec-engine.ts:375` | 25 | `match?.art \|\| undefined` | **undefined** |
| `generateForgottenFavorites` | `rec-engine.ts:473` | 25 | `match?.art \|\| undefined` | **undefined** |

### Why sections become empty

**Root Cause #1: generateRecommendations() is never auto-triggered for Home consumption**

The `recommendations.store.ts` has NO `onRehydrateStorage` handler. When the app boots:
1. Analytics store rehydrates → `rebuildComputedCollections()` runs
2. Recommendations store rehydrates → **NOTHING runs** (no `onRehydrateStorage`)
3. `generateRecommendations()` is only called externally via `refreshTrendingIfNeeded()` or manual triggers

Result: After cold boot, the recommendations store has persisted seeds from the LAST generation, which may be stale by hours/days.

**Root Cause #2: Tier 1 (history.length === 0) zeroes everything**

At line 311-321:
```typescript
if (historyLength === 0) {
    // ALL sections become empty
    dailyMixes = [];
    trendingForYou = null;
    madeForYou = [];
    rediscover = [];
    becauseYouLike = [];
    recentlyLoved = [];
    topSongs = [];
    topArtists = [];
}
```

If analytics history is empty (first launch, cleared, or rehydration failure), the recommendations store clears ALL seeds — even persisted ones.

**Root Cause #3: `hiddenGems` and `forgottenFavorites` use `undefined` artwork**

At lines 397 and 508: `image: match?.art || undefined`

`undefined` survives serialization but produces `{}` (empty object) on rehydration since the field is optional. `resolveSeedArtworkAsync` in `recommendations.store.ts` catches this via `resolveListArtworks`, but only if `generateRecommendations()` has been called — NOT on rehydration from persisted state.

---

## PHASE D — NAVIGATION AUDIT

### Tap behaviors for every Home card

| Card | Tap Handler | Destination | Params Sent | Data Lookup | Loading Issue |
|---|---|---|---|---|---|
| BentoCard (Hero) | `goPlaylist('p1')` | PlaylistScreen | `{ id: 'p1' }` | Likely fails — 'p1' is not a real playlist ID | Navigates to empty playlist |
| ContinueListeningCard | `handlePlayTrack(track)` | NowPlaying | Single `track` obj | `setQueue([track])` — pushes 1 track | Artwork is null → gradient |
| RecentlyPlayedCard | `handlePlayTrack(track)` | NowPlaying | Single `track` obj | Same as above | Same |
| DailyMixCard | `goPlaylist(mix.id)` | PlaylistScreen | `{ id: 'p1'/'p2'/'p3' }` | Same as hero | Navigates to empty/non-existent playlist |
| Cleanup | Navigate to `/library-health` | LibraryHealth | None | health store | Works if visible |

### Critical Navigation Issues

1. **DailyMixCard and BentoCard both navigate to non-existent playlists** — The IDs `p1`, `p2`, `p3` don't correspond to actual playlist data. The destination PlaylistScreen likely performs a data lookup (e.g., `fetchPlaylist(id)` or `getPlaylist(id)`) that returns nothing. Since `onPress={() => goPlaylist('p1')}` has no data fetch fallback, the screen shows an empty loading state forever or renders nothing.

2. **ContinueListeningCard pushes a single track** — `handlePlayTrack` on line 658-662 calls `setQueue([track])`. This sets the queue to exactly 1 track. After it finishes, there is no autoplay or continuation. The user gets one song then silence.

3. **No navigation to Artist or Album detail screens** — While `goAlbum` is imported from `useMusicNavigation`, it's never called from any Home card handler.

---

## PHASE E — RUNTIME STORE DUMP

### What gets persisted vs rebuilt

| Store | Persisted (partialize) | Not Persisted | Rebuilt on Rehydration |
|---|---|---|---|
| **analytics.store** | history[], artistAffinities, albumAffinities, trackAffinities, artistCache, userTasteProfile, counters | **computed** (continueListening, recentlyPlayed, topArtists, topAlbums, topTracks) | ✔️ `onRehydrateStorage` → `rebuildComputedCollections()` |
| **recommendations.store** | ALL seeds (dailyMixes, madeForYou, topSongs, topArtists, etc.), tasteSnapshots, fatigueTracker | — | ❌ **No onRehydrateStorage** — seeds restored from local storage but NOT refreshed |
| **player.store** | currentTrack, queue[], currentIndex, position | playback state (isPlaying) | ✔️ `restoreSession()` via async setTimeout |
| **likes.store** | likedTrackIds, likedAt, trackMetadata | — | ✔️ Default zustand persist |
| **source-health.store** | cooldowns, sourceHealth | — | ? |

### Critical runtime gap

When the app cold-starts:
1. **Analytics** rehydrates and rebuilds computed collections → `ContinueListening` and `RecentlyPlayed` sections get data
2. **Recommendations** rehydrates with STALE seeds (last generation) → Home doesn't use them anyway (no sections wired)
3. **No automatic trigger** calls `generateRecommendations()` on boot — the engine only regenerates via `refreshTrendingIfNeeded()` (6-hour timer) or manual calls
4. **User plays tracks** → analytics history fills → `rebuildComputedCollections()` fires → Continue Listening / Recently Played appear
5. **But the recommendation seeds remain stale** until something explicitly calls `generateRecommendations()`

---

## PHASE F — HARDCODED CONTENT AUDIT

### All hardcoded/mock/placeholder content in the Home screen

| File:Line | Content | Type |
|---|---|---|
| `index.tsx:646-652` | Greeting text ("Good morning", etc.) | Time-based strings (acceptable) |
| `index.tsx:693` | `image="https://picsum.photos/600/400?random=10"` | Hero card artwork |
| `index.tsx:694` | `title="Neon Shadows"` | Fake playlist title |
| `index.tsx:695` | `subtitle="The best of cyberpunk synthwave..."` | Fake description |
| `index.tsx:696` | `onPress={() => goPlaylist('p1')}` | Fake playlist ID |
| `index.tsx:770` | `id: 'p1', title: 'Daily Mix 1'` | Fake mix ID + title |
| `index.tsx:770` | `image: 'https://picsum.photos/400/300?random=1'` | Daily Mix artwork |
| `index.tsx:771` | `id: 'p2', title: 'Focus Flow'` | Fake mix ID + title |
| `index.tsx:771` | `image: 'https://picsum.photos/400/300?random=2'` | Daily Mix artwork |
| `index.tsx:772` | `id: 'p3', title: 'Chill Vibes'` | Fake mix ID + title |
| `index.tsx:772` | `image: 'https://picsum.photos/400/300?random=3'` | Daily Mix artwork |

### Hardcoded content in the Recommendation Engine (seeds with fake images)

| File:Line | Content | Type |
|---|---|---|
| `rec-engine.ts:92` | `` image = `https://picsum.photos/400/400?random=${101 + i}` `` | Daily Mix fallback image |
| `rec-engine.ts:133` | `` image = ... || `https://picsum.photos/...` `` | BecauseYouLike fallback |
| `rec-engine.ts:181` | `` image: entry.art || 'https://picsum.photos/400/400?random=17' `` | Rediscover fallback image |
| `rec-engine.ts:214` | `` image: match.art || 'https://picsum.photos/400/400?random=18' `` | RecentlyLoved fallback image |
| `rec-engine.ts:242,257,272` | Unsplash URLs | TimeBasedPicks images |
| `rec-engine.ts:301,320,332` | picsum URLs | MadeForYou fallback images |
| `rec-engine.ts:365` | Unsplash URL | TrendingForYou image |
| `rec-engine.ts:397` | `image: match?.art || undefined` | HiddenGems — **undefined** |
| `rec-engine.ts:508` | `image: match?.art || undefined` | ForgottenFavorites — **undefined** |

### Hardcoded content in Recommendation Store

| File:Line | Content | Type |
|---|---|---|
| `rec.store.ts:267-295` | `fallbackDailyMixes[]` with Unsplash URLs | Editorial fallback seeds |
| `rec.store.ts:297-305` | `fallbackTrendingForYou` with Unsplash URL | Editorial fallback |
| `rec.store.ts:457-474` | `trendingSeeds[]` with Unsplash URLs | Trending global/india |
| `rec.store.ts:749` | `art: track.art || 'https://picsum.photos/400/400?random=105'` | Autoplay fallback |

### Hardcoded content in Recommendation Hydrator

| File:Line | Content | Type |
|---|---|---|
| `rec-hydrator.ts:76` | `art: item.art || item.thumbnail || 'https://picsum.photos/...'` | Hydration fallback |
| `rec-hydrator.ts:491` | `art: s.art || s.thumbnail || 'https://picsum.photos/...'` | Hydration seed mapping |
| `rec-hydrator.ts:538` | `art: seed.image || 'https://picsum.photos/...'` | Hydration playlist mapping |
| `rec-hydrator.ts:579` | `art: seed.image || 'https://picsum.photos/...'` | Hydration artist mapping |

**Total: 25+ hardcoded/mock/placeholder content sources affecting the Home experience.**

---

## FINAL RANKING — TOP 10 CAUSES MAKING HOME FEEL EMPTY

| Rank | Cause | Evidence | Impact |
|---|---|---|---|
| **#1** | **5 card components are defined but never wired into the Home screen's section renderer** | `index.tsx:667-674` shows only 6 sections. TrackCard, CircleArtistCard, FavoriteAlbumCard, BecauseYouLikeCard, SeedTrackCard exist as components (lines 122, 381, 412, 478, 510) but `renderSectionItem` (line 676) has no case for them. | **~75% of potential content missing** — top songs, top artists, favorite albums, because-you-like, rediscover, loved tracks, hidden gems, forgotten favorites |
| **#2** | **Recommendation seeds exist in the store but have zero Home screen sections** | `recommendations.store.ts` generates dailyMixes, madeForYou, topSongs, topArtists, rediscover, recentlyLoved, hiddenGems, forgottenFavorites — NONE are rendered in `index.tsx` | **~50 potential items never shown** |
| **#3** | **Continue Listening artwork is permanently null** | `playback.controller.ts:126` converts `""` to `null` via `track.art \|\| null`. This null survives into the analytics history entry and propagates through `resolveArtwork` to `aura://generated` gradient. | **7 items render with gradient fallbacks instead of real artwork** |
| **#4** | **Daily Mixes section is fully hardcoded with fake data** | `index.tsx:767-792` — `DailyMixesSection` creates 3 hardcoded objects with picsum.photos artwork, fake IDs (`p1`, `p2`, `p3`), and fake titles. No connection to `recommendations.dailyMixes`. | **3 fake cards with picsum artwork, navigate to non-existent playlists** |
| **#5** | **Hero BentoCard is fully hardcoded with a fake playlist** | `index.tsx:690-698` — Uses `image="https://picsum.photos/..."`, hardcoded `title="Neon Shadows"`, navigates to `goPlaylist('p1')` which doesn't exist. | **1 hero card with fake content, broken navigation** |
| **#6** | **Recommendations engine never auto-generates on app boot** | `recommendations.store.ts` has NO `onRehydrateStorage` handler. Seeds persist from last session but are never refreshed. `generateRecommendations()` only fires via 6-hour `refreshTrendingIfNeeded()` timer or external triggers. | **Home never shows current recommendations** |
| **#7** | **All "Made For You" sections (Daily Mixes, Because You Like, Rediscover, etc.) are defined in the store but have zero Home sections** | `recommendations.store` generates madeForYou, becauseYouLike, rediscover (lines 432-443). `index.tsx` renders none of these. | **~15-30 personalized items hidden** |
| **#8** | **Favorite Albums and Top Artists analytics data exists but is ignored** | `analytics.computed.topArtists` (max 30), `analytics.computed.topAlbums` (max 30), `analytics.userTasteProfile.favoriteArtists`, `likes.trackMetadata` (all persisted with artwork) — none rendered on Home. | **0 of 60+ favorite/top items shown** |
| **#9** | **Cleaning/Library Health card hides itself for 95% of users** | `index.tsx:736` — Only renders if `storageWasteBytes >= 50MB`. Most users either have no cache data or haven't generated enough waste. | **An additional empty visual slot** |
| **#10** | **Navigation from Home cards leads to empty/dead screens** | Hero → `goPlaylist('p1')`, DailyMix → `goPlaylist(mix.id)`, ContListen → `setQueue([track])`. These either navigate to non-existent playlists or push a single-track queue with no continuation. | **Every tap leads to an empty or dead experience**, reinforcing the perception of emptiness |

### Summary

```
Home screen capacity:   ~100+ items (if all sections wired)
Home screen actual:     ~10-14 items
    3 hardcoded mixes with picsum URLs
    1 hardcoded hero card with picsum URL
    0-7 Continue Listening items with gradient-only artwork
    0-20 Recently Played items with gradient-only artwork
    0-1 Library Cleanup card (conditional)
    
Content hidden by architecture:  ~90 items
    - Recommendations store:     ~50 seeds never shown
    - Analytics top lists:       ~30 items never shown
    - Likes store:               unlimited liked songs never shown
    
Percent of Home that is hardcoded filler:  28-40% (4 of 10-14 items)
Percent of Home with real user data:       0% (all real data has null artwork → gradients)
Percent of Home that feels empty:          ~100% upon first few seconds of observation
```
