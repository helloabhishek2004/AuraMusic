# MIGRATION_PLAN.md — 10-Phase Incremental Migration

## PRINCIPLE

No big-bang rewrite. Each phase produces a working, testable increment. At every phase boundary, the app must compile, run, and pass existing functionality. The FastAPI backend remains running until Phase 9 removes it.

## PHASE 0: EXPO MODULE SKELETON

**Objective:** Create the native module shell that proves Expo Module → Kotlin communication works.

**Prerequisites:** None

**Files/modules affected:**
- New: `modules/aura-music-core/` (Expo Module)
- New: `modules/aura-music-core/android/src/main/java/com/auramusic/core/AuraMusicModule.kt`
- Modified: `app.json` (add module)
- Modified: `package.json` (add module dependency)

**What to implement:**
1. Expo Module definition with `Name("AuraMusicCore")`
2. Single test function: `getDeviceInfo()` returning Android build info
3. React Native hook: `useAuraMusic()` that calls `getDeviceInfo()`
4. Verify round-trip: JS → Native → JS

**Risks:** Expo Module API compatibility with SDK 55

**Tests:**
- `getDeviceInfo()` returns correct Android version
- Module is discoverable from React Native
- Hot reload preserves module connection

**Completion criteria:** `useAuraMusic().getDeviceInfo()` returns valid Android build info on a physical device.

**Rollback:** Delete `modules/aura-music-core/`, revert `app.json` and `package.json`

---

## PHASE 1: INNERtube CLIENT (SEARCH ONLY)

**Objective:** Prove on-device InnerTube search works without any server.

**Prerequisites:** Phase 0 complete

**Files/modules affected:**
- New: `modules/aura-music-core/.../youtube/InnerTubeClient.kt`
- New: `modules/aura-music-core/.../youtube/YouTubeClients.kt`
- New: `modules/aura-music-core/.../youtube/SessionManager.kt`
- New: `modules/aura-music-core/.../youtube/requests/SearchRequest.kt`
- New: `modules/aura-music-core/.../youtube/responses/SearchResponse.kt`
- Modified: `AuraMusicModule.kt` (add search function)

**What to implement:**
1. `YouTubeClients.kt` — WEB_REMIX client profile (single client, no fallback yet)
2. `SessionManager.kt` — visitor data acquisition from `sw.js_data`
3. `InnerTubeClient.kt` — HTTP POST to `/youtubei/v1/search` using Ktor
4. `SearchRequest.kt` — request body builder
5. `SearchResponse.kt` — response parser (parse `tabbedSearchResultsRenderer`)
6. Domain mapper: response → `List<Track>`
7. Bridge function: `search(query) → JSON string`

**What NOT to implement yet:** Player, browse, cipher, PoToken, fallback

**Risks:**
- YouTube response format changes (mitigated: parse defensively)
- Ktor dependency conflicts with existing RN networking

**Tests:**
- Search "Taylor Swift" → returns list of tracks
- Search results include title, artist, duration, thumbnail
- Search with empty query → returns error
- Network unavailable → returns error (not crash)

**Completion criteria:** `AuraMusicCore.search("Taylor Swift")` returns ≥5 track results with valid metadata. Results displayed in React Native UI.

**Rollback:** Keep InnerTubeClient as optional feature flag. UI falls back to server search if flag off.

---

## PHASE 2: STREAM RESOLVER (PLAYBACK POC)

**Objective:** Play audio from YouTube CDN without any server. This is the PRIMARY FEASIBILITY GATE.

**Prerequisites:** Phase 1 complete

**Files/modules affected:**
- New: `modules/aura-music-core/.../cipher/CipherService.kt`
- New: `modules/aura-music-core/.../cipher/PlayerScriptParser.kt`
- New: `modules/aura-music-core/.../cipher/QuickJsEngine.kt`
- New: `modules/aura-music-core/.../stream/StreamResolver.kt`
- New: `modules/aura-music-core/.../stream/FormatSelector.kt`
- New: `modules/aura-music-core/.../player/PlayerController.kt`
- Modified: `AuraMusicModule.kt` (add play/pause/seek functions)

**What to implement:**
1. `QuickJsEngine.kt` — Android QuickJS binding (use aspect-quickjs library)
2. `PlayerScriptParser.kt` — extract n-parameter and signature functions from player JS
3. `CipherService.kt` — download player JS, parse, solve signature + n-parameter
4. `StreamResolver.kt` — player request → format extraction → cipher → URL
5. `FormatSelector.kt` — select best audio format
6. `PlayerController.kt` — Media3 ExoPlayer with ResolvingDataSource
7. Bridge: play/pause/seek/skip

**Client strategy for POC:** TVHTML5 only (no PoToken, simplest path)

**What NOT to implement yet:** Fallback clients, SABR, downloads, Room

**Risks:**
- QuickJS integration complexity
- Player JS parsing fragility
- Cipher algorithm changes

**Tests:**
- Resolve "dQw4w9WgXcQ" → valid stream URL
- Stream URL plays audio in ExoPlayer
- Play/pause/seek work from React Native
- Cipher solve takes <500ms
- Total resolve time <2s

**Completion criteria:** Playing any public YouTube video from React Native with zero server involvement. Audio plays through device speakers.

**Rollback:** Feature flag to use server resolver instead. Player falls back to FastAPI.

---

## PHASE 3: BROWSE + HOME + ARTIST + ALBUM

**Objective:** All content browsing works on-device.

**Prerequisites:** Phase 1 complete (can parallel with Phase 2)

**Files/modules affected:**
- New: `modules/aura-music-core/.../youtube/requests/BrowseRequest.kt`
- New: `modules/aura-music-core/.../youtube/responses/BrowseResponse.kt`
- New: `modules/aura-music-core/.../youtube/YouTubeEngine.kt` (facade)
- Modified: `AuraMusicModule.kt` (add home/artist/album/charts functions)

**What to implement:**
1. Browse request to `/youtubei/v1/browse`
2. Parse `browseId` responses (VL*, UC*, MPREb_*)
3. Home page content extraction
4. Artist page extraction
5. Album page extraction
6. Playlist page extraction
7. Charts extraction
8. Search suggestions via `get_search_suggestions`

**Tests:**
- Home page loads with content sections
- Artist page shows songs, albums, singles
- Album page shows track list
- Playlist page loads
- All metadata has title, artist, thumbnail

**Completion criteria:** Home, Search, Artist, Album screens all display content from InnerTube with no server.

---

## PHASE 4: CLIENT FALLBACK STRATEGY

**Objective:** Robustness against YouTube API changes.

**Prerequisites:** Phase 2 complete

**Files/modules affected:**
- New: `modules/aura-music-core/.../strategy/ClientSelector.kt`
- New: `modules/aura-music-core/.../strategy/FallbackStrategy.kt`
- Modified: `InnerTubeClient.kt` (add client rotation)
- Modified: `YouTubeClients.kt` (add all client profiles)

**What to implement:**
1. All 20+ client profiles from YouTubeClient.kt
2. Fallback cascade: TVHTML5 → ANDROID_VR → VISIONOS → IOS → WEB_REMIX
3. Error-based rotation (403 → rotate, PoToken fail → skip)
4. Client health tracking (success/failure counts)

**Tests:**
- If primary client returns 403, next client is tried
- If all clients fail, error propagates to UI
- No infinite retry loops

**Completion criteria:** Playback survives YouTube client changes by rotating through profiles.

---

## PHASE 5: ROOM DATABASE

**Objective:** Proper local persistence replacing AsyncStorage.

**Prerequisites:** Phase 0 complete (can start early)

**Files/modules affected:**
- New: `modules/aura-music-core/.../database/AuraDatabase.kt`
- New: All entity and DAO classes
- New: `modules/aura-music-core/.../database/migrations/`
- Modified: `AuraMusicModule.kt` (add database functions)

**What to implement:**
1. Room database with all entities
2. All DAO interfaces
3. Migration from AsyncStorage
4. Bridge functions for history, favorites, settings

**Tests:**
- Insert/play query works
- History records persist across app restart
- Favorites persist
- AsyncStorage migration runs once

**Completion criteria:** All local data stored in Room. AsyncStorage migration complete.

---

## PHASE 6: DOWNLOADS

**Objective:** Download tracks for offline playback.

**Prerequisites:** Phase 2 (stream resolver) + Phase 5 (Room)

**Files/modules affected:**
- New: `modules/aura-music-core/.../download/AuraDownloadManager.kt`
- New: `modules/aura-music-core/.../download/StorageManager.kt`
- Modified: `AuraMusicModule.kt` (add download functions)

**What to implement:**
1. Media3 DownloadManager integration
2. Download queue with persistence
3. Progress tracking
4. File integrity verification
5. Storage management
6. Bridge: download/pause/resume/cancel/delete

**Tests:**
- Download a track → file saved to device
- Pause/resume works
- Downloaded track plays offline
- Delete removes file

**Completion criteria:** Can download tracks and play them offline.

---

## PHASE 7: LYRICS

**Objective:** Multi-provider lyrics on-device.

**Prerequisites:** Phase 0

**Files/modules affected:**
- New: `modules/aura-music-core/.../lyrics/LyricsEngine.kt`
- New: `modules/aura-music-core/.../lyrics/providers/LRCLIBProvider.kt`
- New: `modules/aura-music-core/.../lyrics/providers/KuGouProvider.kt`
- Modified: `AuraMusicModule.kt` (add lyrics function)

**What to implement:**
1. LRCLIB provider (primary)
2. KuGou provider (fallback)
3. YouTube transcript provider (future)
4. Lyrics caching in Room
5. Synced lyrics parsing

**Tests:**
- Fetch lyrics for known track → synced lyrics returned
- Provider fallback works
- Cached lyrics load instantly

**Completion criteria:** Lyrics display for most tracks with sync.

---

## PHASE 8: RECOMMENDATIONS + DISCOVERY

**Objective:** Enhanced on-device recommendations using Room data.

**Prerequisites:** Phase 5 (Room)

**Files/modules affected:**
- Modified: `modules/aura-music-core/.../recommendation/RecommendationEngine.kt`
- Modified: `AuraMusicModule.kt` (add recommendation functions)

**What to implement:**
1. Port existing recommendation-engine.ts logic to Kotlin
2. Integrate with Room play events
3. InnerTube browse for trending/charts as candidate source
4. Bridge: getRecommendations(section)

**Tests:**
- Recommendations generate without server
- Quality matches or exceeds current JS engine
- Daily Mix, Deep Cuts, etc. all work

**Completion criteria:** Recommendations work with zero server.

---

## PHASE 9: REMOVE FASTAPI

**Objective:** Delete the backend dependency entirely.

**Prerequisites:** All previous phases complete and verified

**Files/modules affected:**
- Deleted: `backend/` directory
- Deleted: `src/services/api/client.ts`
- Deleted: `src/services/api/music.ts`
- Modified: All features that previously used API calls

**What to verify:**
- [ ] Every API call in the codebase has been replaced
- [ ] No Axios imports remain
- [ ] No references to FastAPI backend
- [ ] All features work with native core
- [ ] Build succeeds without backend
- [ ] Tests pass

**Rollback:** Keep backend alive in a branch until 30 days after production release.

---

## PHASE 10: POLISH + OPTIMIZE

**Objective:** Performance tuning and edge case handling.

**Prerequisites:** Phase 9 complete

**What to implement:**
1. Performance profiling
2. Memory leak detection
3. Battery usage optimization
4. Animation smoothness verification
5. Error handling refinement
6. Analytics integration
7. Crash reporting

**Completion criteria:** App meets performance targets from TARGET_ARCHITECTURE.md.

## DEPENDENCY GRAPH

```
Phase 0 (Expo Module)
    ├── Phase 1 (InnerTube) ──→ Phase 2 (Stream Resolver) ──→ Phase 4 (Fallback)
    │                           Phase 3 (Browse) ──→ Phase 8 (Recommendations)
    ├── Phase 5 (Room) ──→ Phase 6 (Downloads)
    └── Phase 7 (Lyrics)
    
Phase 9 (Remove FastAPI) ← requires ALL above
Phase 10 (Polish) ← requires Phase 9
```

## ESTIMATED TIMELINE

| Phase | Estimated Effort | Risk Level |
|---|---|---|
| Phase 0 | 1-2 days | Low |
| Phase 1 | 3-5 days | Medium |
| Phase 2 | 7-14 days | HIGH |
| Phase 3 | 3-5 days | Medium |
| Phase 4 | 3-5 days | Medium |
| Phase 5 | 3-5 days | Low |
| Phase 6 | 3-5 days | Medium |
| Phase 7 | 2-3 days | Low |
| Phase 8 | 2-3 days | Low |
| Phase 9 | 1-2 days | Low |
| Phase 10 | 3-5 days | Low |
| **Total** | **30-54 days** | |

END OF FILE
