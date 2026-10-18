# AuraMusic — System Architecture & Runtime Context

**Repository:** `helloabhishek2004/AuraMusic`  
**Branch:** `master`  
**Version:** `3.1.0` (Android `versionCode 5`)  
**Package:** `com.anonymous.AuraMusic`  
**Target Platform:** Android (Android-First, SDK 24 to 36)  
**Last Updated:** October 2026  

---

## 1. Project Overview & Philosophy

AuraMusic is a flagship-grade, serverless Android music player featuring a custom Liquid Glass design system, native AndroidX Media3 (ExoPlayer) playback, direct on-device stream resolution, and local SQLite persistence via AndroidX Room.

### Key Architectural Invariants
1. **Serverless & Local-First:** No intermediate proxy servers or cloud middleman scrapers. Stream resolution, buffering, audio decoding, media sessions, offline caching, and scoped storage backups execute directly on the Android device.
2. **Authoritative Native Playback:** The playback position, buffering states, audio timeline, and active queue are owned strictly by Kotlin/ExoPlayer on the Android OS thread (`AuraPlayer.kt`). The React Native UI acts as a reactive subscriber.
3. **Liquid Glass Design System:** Multi-layered visual depth, 38–54 blur radius hierarchies, dynamic artwork gradient extraction, kinetic gestures via Reanimated v4 and `motion.ts`, and high-density virtualized lists via `@shopify/flash-list`.
4. **Strict Data Privacy & Minimal Scopes:** Zero analytics telemetry sent to external third parties. Connected services (Google/YouTube) request only minimal read-only scopes (`youtube.readonly`) and enforce complete local data purging upon disconnect.
5. **Deterministic Foundation with Optional AI Ranking:** The local mathematical recommendation heuristics form the fail-safe baseline; on-device AI (Gemini Nano) operates exclusively as an optional candidate re-ranking layer.

---

## 2. Tech Stack & Native Environment

* **Framework:** React Native `0.83.6` (React `19.2.0`), Expo SDK `55.0.26`
* **Architecture:** React Native New Architecture (Fabric renderer + Hermes engine enabled)
* **Android Target / Compile SDK:** `36` (Android 16 preview compatible)
* **Android Min SDK:** `24` (Android 7.0 Nougat)
* **Build System:** Gradle `9.0.0`, Android Gradle Plugin `8.8.2`, Kotlin `2.1.20`, KSP `2.1.20-2.0.1`
* **Audio Engine:** AndroidX Media3 `1.5.1` (ExoPlayer, MediaSession, DownloadService)
* **Database:** AndroidX Room SQLite (`aura_music.db`) with Write-Ahead Logging (WAL)
* **State Management:** Zustand with custom AsyncStorage persistence

---

## 3. Subsystem Architecture & Modules

```
AuraMusic Architecture
├── Presentation Layer (React Native + Expo SDK 55)
│   ├── app/                         # File-based routing (tabs, player, settings, privacy, downloads)
│   ├── src/features/
│   │   ├── connected-libraries/     # YouTube, Spotify, Apple Music sync & OAuth
│   │   ├── download/                # Download queue manager, store, service
│   │   ├── player/                  # Zustand stores, controllers, autoplay radio, queue
│   │   ├── recommendations/         # Taste profiles, Daily Mixes, hydrator, daily feed evolution
│   │   ├── taste-profile/           # Onboarding preferences, priors, catalog
│   │   ├── search/                  # Search engine, intent detection, deduplication
│   │   ├── lyrics/                  # Multi-provider synced LRC lyrics
│   │   └── settings/                # Preferences, local backup UI, storage management
│   ├── src/design/
│   │   └── motion.ts                # Physics tokens, 60 FPS transitions, reduced-motion rules
│   └── src/services/
│       ├── native-core.ts           # TurboModule JNI bridge bindings
│       ├── local-backup.service.ts  # Scoped storage backup/restore coordinator
│       └── restore-validator.service.ts # Post-restore database integrity verification
│
├── Native Android Core (android/app/src/main/java/com/auramusic/core/)
│   ├── playback/                    # AuraPlayer.kt, ExoPlayer audio pipeline
│   ├── session/                     # AuraMediaSessionService.kt (Foreground service)
│   ├── resolver/                    # UnifiedStreamResolver, PoTokenManager (WebView)
│   ├── download/                    # Media3 DownloadManager, cache storage, notifications
│   ├── backup/                      # LocalBackupManager.kt (Scoped Storage MediaStore)
│   ├── db/                          # Room Database, DAOs, and Entities
│   └── bridge/                      # React Native TurboModules & EventEmitters
│
└── Storage & System Integration
    ├── Local Scoped Storage         # Documents/AuraMusic/backup.json
    ├── Media3 Cache Storage         # SimpleCache with custom CacheKey
    ├── Google Cloud Backup Rules    # data_extraction_rules.xml & backup_rules.xml (disabled in UI)
    └── Google OAuth 2.0 Client      # Read-only YouTube Data API integration
```

---

## 4. Key Subsystems in Detail

### 4.1. Playback & Audio Pipeline
* **Native Playback:** `AuraPlayer.kt` handles timeline updates, gapless buffering, error handling, audio focus management, and system hardware equalizer delegation.
* **Stream Resolution:** Resolves raw streaming media directly in Kotlin via `UnifiedStreamResolver.kt` using `WEB_REMIX` and `ANDROID_VR` payloads with on-device headless BotGuard / PoToken generation via `PoTokenManager.kt`.
* **MediaSession:** `AuraMediaSessionService.kt` exposes Android `MediaSessionCompat` / Media3 `MediaSession` supporting lock screens, Bluetooth AVRCP, WearOS, and Android Auto.

### 4.2. Connected Libraries & Google OAuth Data Compliance
* **Personal / Manual Testing Status:** The Connected Libraries feature (specifically YouTube Music) is a personal/developer testing capability backed by `@react-native-google-signin/google-signin` and native `play-services-auth:21.4.0`.
* **OAuth Registration Requirements:** Successfully testing on physical Android devices requires registering package `com.anonymous.AuraMusic` and the release or debug keystore SHA-1 fingerprint as an Android OAuth Client ID in Google Cloud Console project `304304144156`.
* **OAuth Scope:** Uses minimal read-only scope `https://www.googleapis.com/auth/youtube.readonly`.
* **Authorized Data Purging:** Upon user disconnect or token revocation, `youtube-data-cleanup.service.ts` immediately deletes all imported playlists, cached tracks, tokens, and metadata from the local database.
* **Revocation Signaling:** `google-auth.service.ts` returns `{ success: true, remotelyRevoked: boolean }`, confirming remote revocation via `GoogleSignin.revokeAccess()` and providing fallback links to Google Account Security Settings if remote confirmation fails.
* **Privacy Policy Alignment:** `app/privacy_policy.tsx` accurately documents data retention, user controls, and the remote revocation fallback mechanism.

### 4.3. Offline Scoped Storage Local Backup & Recovery Engine
* **Standalone Uninstallation Persistence:**
  - `LocalBackupManager.kt` reads/writes self-contained, versioned JSON backups to `Documents/AuraMusic/backup.json` using Android MediaStore on API 29+ and direct File APIs on legacy versions.
  - Sideloaded APKs persist all user state (playlists, likes, history, preferences) across complete app uninstalls without requiring user accounts or third-party servers.
* **Cold-Start Recovery Detection:**
  - On fresh cold launch before onboarding completes, scans `Documents/AuraMusic/backup.json`. If found, displays a modal with 1-tap restore to immediately recover library and skip manual onboarding.
* **Automated Sync & Checksums:**
  - Debounced auto-sync to public storage upon database entity mutations or app backgrounding (`onStop`).
  - SHA-256 verification and atomic temp file writes prevent corruption during power loss or app kill.
* **Google Cloud Backup Status:**
  - Google Cloud Backup UI actions in Settings are set to disabled with a clear "Temporarily disabled" notice while keeping the underlying plumbing intact.

### 4.4. Forensic Download Engine & Native Notifications
* **Media3 Download Event Listener:** `DownloadUtil.kt` registers `DownloadManager.Listener` forwarding terminal states (`STATE_COMPLETED`, `STATE_FAILED`, `STATE_REMOVED`) directly across the JNI bridge.
* **Concurrency Recovery:** `download-queue-manager.ts` guarantees concurrency slot release on failure, cancellation, and bridge timeouts, preventing queue freezes.
* **Native Android Notifications:** `AuraDownloadService.kt` uses Android NotificationChannels (`FOREGROUND_SERVICE_DATA_SYNC`) to display real download progress and completion notifications outside React Native.

### 4.5. Evolving Daily Home Feed & Unified Motion
* **Daily Feed Evolution:** `daily-feed-evolution.service.ts` deterministically constructs daily personalized playlists and rotating hero artwork using organic listening history, likes, skips, and regional language preferences.
* **Unified 60 FPS Motion:** `src/design/motion.ts` standardizes spring and ease curves, respects Android reduced-motion settings, and protects against animation jank over blur layers.
* **In-Screen Library Search:** Fast local search in `app/downloads.tsx` and `app/(tabs)/library.tsx` with instant filtering on title, artist, and album.
* **Universal Haptics:** Global persisted preference in `settings.store.ts` driving subtle native tactile feedback.

### 4.6. Display & Rendering Fidelity
* **Liquid Atmospheric Background:** Canonical signature animated background (`src/components/ui/LiquidAtmosphereBackground.tsx`) matching the Search screen. Features 3 floating ambient blobs (`#2a0053`, `#003731`, `#1a0038`), multi-stop depth vignette LinearGradient for card and text contrast, 100% native driver execution (`useNativeDriver: true`), and route/AppState lifecycle gating. Shared across Search, Home, Downloads, Download Queue, and Connected Apps.
* **120Hz High Refresh Rate:** Window display mode configured to request maximum available display refresh rate on Android, eliminating stutter and delivering 120 FPS animations on high-refresh AMOLED/OLED displays.
* **Virtualized Lists:** `@shopify/flash-list` with estimated item sizes ensures instantaneous rendering across massive playlist libraries and search results.

### 4.7. On-Device AI Architecture (Gemini Nano)
* **2-Stage Recommendation Engine:**
  - *Candidate Generation:* `recommendation-engine.ts` (Home) and `autoplay-radio.ts` (Queue) aggregate 30–60 candidate tracks from history, favorites, and automix seeds.
  - *Scoring / Re-Ranking:* Candidates are scored heuristically (`Relational + Affinity + Session - Fatigue`) and ready for semantic re-ranking via Gemini Nano.
* **Latency & Queue Safety:** The `QUEUE_NEARING_END` event triggers when `remainingTracks <= 2`, providing a 3.5 to 7.0-minute buffer that easily accommodates 300–600ms on-device inference without audio dropout risk.
* **Device Gating:** Hardware-gated via Android AICore availability checks. Fully functional deterministic fallback guarantees zero downtime on devices without AICore.

### 4.8. First-Run Onboarding & Dynamic Music Taste Architecture
* **The Sonic Nebula Flow (`app/onboarding.tsx`):**
  - 9-step atmospheric first-run experience: Welcome screen with signature animated "hello" vector stroke (`WelcomeStrokeSvg.tsx`), Name input with fluid curved capsule design (`CurvedNameInput.tsx`), Language selection with expanded regional taxonomy, Genre & Mood selection, and dynamic Artist Discovery.
  - Living atmospheric sky: Grape Dusk atmosphere (`GrapeDuskAtmosphere.tsx`, 77 KB WebP with hardware-accelerated horizontal drift and organic scaling), scalable vector AuraMusic logo (`AuraLogoSvg.tsx`), and celestial constellation particles (`ConstellationParticles.tsx`).
  - Dynamic Artist Discovery Loader (`ArtistDiscoveryLoader.tsx`): Pill-shaped container with rotating status messages ("Finding best artists...", "Figuring out who is best for you...") dynamically querying artist suggestions based on user language/genre selections.
  - 4-tier artist avatar fallback hierarchy (`ArtistAvatarCard.tsx`: Remote InnerTube CDN -> Memory Cache -> Deterministic Gradient with Initials -> Icon Placeholder).
* **Decoupled Taste Profile Prior Layer (`src/features/taste-profile/`):**
  - Manages `MusicTasteProfile` (version 1) in `taste-profile.store.ts` backed by `AsyncStorage` (`'aura_music_taste_profile'`).
  - Pure cold-start prior layer, strictly separated from organic listening history. Does not inject fake play counts or completion events into Room DB history.
  - Mathematical cold-start prior decay:
    $$\text{decayFactor} = \max\left(0.1, 1.0 - \frac{\text{totalHistoryCount}}{40}\right)$$
  - Feeds Home screen cold-start carousels (`trendingSeeds`, `featuredHeroMix`, and `favorite_artists`) immediately upon launch.
* **Splash Rehydration Barrier (`StartupOnboardingGate` in `app/_layout.tsx`):**
  - Holds `SplashScreen.preventAutoHideAsync()` until fonts and taste profile rehydrate, completely preventing the "Home screen flash" on fresh installs.
* **Backup-First Entrypoint:**
  - "Look for Backups" detects existing cloud backups, restoring libraries and skipping onboarding.
* **Settings Management & Safe Reset (`app/music_taste.tsx`):**
  - Dedicated screen allowing editing of musical preferences at any time.
  - Safe reset clears the taste profile and redirects to onboarding without deleting local SQLite history, playlists, downloads, or the native install marker.

### 4.9. Web Landing Page Architecture
* **Canonical Source:** `website_vite_backup`
* **Deployment Mirror:** `website`
* **Production Deployment URL:** `https://listenwith-auramusic.vercel.app/`
* **Technology Stack:** Vite, React 19, Tailwind CSS v4, Framer Motion, OGL
* **Note:** `website_nextjs_backup` is a legacy archive and must not be modified.

---

## 5. Critical Development Guidelines for AI Agents

1. **Do Not Touch Working Audio Code:** Never modify `AuraPlayer.kt`, `UnifiedStreamResolver.kt`, or `AuraMediaSessionService.kt` unless explicitly addressing an audio bug.
2. **Preserve Liquid Glass Visual Hierarchy:** Maintain 38–54 blur radii, translucent borders, dynamic gradient tints, and smooth spring physics. Do not flatten UI components.
3. **Maintain Safe Fallbacks:** Any AI or remote service call must always be wrapped in a deterministic fallback that preserves functionality if offline or unsupported.
4. **Protect Backup Invariants:** Never remove WAL or AsyncStorage files from `plugins/withAuraNative.js` backup rules.
