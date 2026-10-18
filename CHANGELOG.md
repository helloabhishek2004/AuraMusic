# Changelog

All notable changes to **AuraMusic** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.1.0] - 2026-10-18

### The Autonomous Resilience & Daily Evolution Release

AuraMusic v3.1.0 delivers a major leap in offline resilience, navigation ergonomics, and personalization. Highlights include an on-device **Scoped Storage Backup & Recovery Engine** (`Documents/AuraMusic/backup.json`) persisting libraries across complete uninstalls, **Forensic Download Engine** fixes with native Android progress/completion notifications, an **Evolving Daily Home Feed**, **In-Screen Library Search**, **Queue Auto-Scroll to Active Track**, and a **Unified 60 FPS Motion System**.

### Added
* **Offline Scoped Storage Backup & Recovery Engine (`Documents/AuraMusic/backup.json`):**
  * Android MediaStore / Scoped Storage engine (`LocalBackupManager.kt`, `local-backup.service.ts`) enabling full user state persistence across complete app uninstalls and re-installs without user accounts or cloud servers.
  * Cold-start backup detection on fresh installation: silently inspects public `Documents/AuraMusic/` on first launch and displays a clean modal ("Previous Library Found: Found a local backup with X songs and Y playlists...") with 1-tap restore or skip.
  * Automated debounced background sync of `backup.json` whenever Room database entities change and when the app transitions to the background.
  * Manual "Backup Now" and "Restore Backup" actions in Settings with SHA-256 integrity checksums, schema versioning, and atomic temporary writes.
  * Disabled legacy Google Cloud Backup UI items with clear "Temporarily disabled" notice while preserving backend code intact.
* **Forensic Download Engine & Native Download Notifications:**
  * Native Media3 download event listener integration bridging native download state transitions directly to the React Native Zustand store.
  * Lifecycle-safe concurrency slot recovery in `download-queue-manager.ts` ensuring failure, cancellation, network drop, and bridge timeouts release active slots to prevent permanent queue lockups.
  * Genuine Android system notifications (`AuraDownloadService.kt`) with dedicated `FOREGROUND_SERVICE_DATA_SYNC` notification channels displaying active progress, bytes, completion, and failure states even when the app is backgrounded or killed.
* **Evolving Daily Home Feed:**
  * Deterministic recommendation and feed rotation engine (`daily-feed-evolution.service.ts`) synthesizing daily-seeded personal playlists ("Daily Mix 1: Flow", "Daily Energy Booster", "Late Night Atmospheric") from organic listening history, liked tracks, skips, and language affinities.
  * Daily rotating hero visual assets and 0ms instantaneous cold-start via disk cache fallback.
* **In-Screen Library & Downloads Search:**
  * High-performance local search input added to `app/downloads.tsx` and `app/(tabs)/library.tsx` (Liked Songs) with instant substring filtering on track title, artist, and album.
  * Preserves active sort criteria and renders responsive empty states when no items match.
* **Universal Haptic Feedback Engine:**
  * Persistent Haptics toggle in Settings (`src/features/settings/store/settings.store.ts`) governing all tactile interactions throughout the app.
  * Subtle, consistent native Android haptic feedback on playback controls, like toggles, and sheet open/dismiss interactions.
* **Fluid 60 FPS Motion System:**
  * Centralized motion and physics tokens (`src/design/motion.ts`) providing consistent spring and ease transitions for page-entries, sheets, dialogs, and player expansion.
  * System-wide reduced-motion preference detection and blur optimization guards preventing UI stutter during intensive animations.

### Changed
* **Queue Navigation Ergonomics:** Opening the Queue sheet from Now Playing automatically and smoothly scrolls to the currently active track based on unique item identity rather than simple track ID, without forcing Now Playing to close or resetting queue scroll state.
* **Non-Intrusive Playback Selection:** Tapping any track from Home, Search, Downloads, or Liked Songs starts immediate playback while keeping the user on the current screen with mini-player synchronization, reserving full-screen Now Playing expansion for explicit user taps.
* Upgraded Android build configuration: `versionCode 5`, `versionName 3.1.0`.
* Upgraded web release configuration and documentation to `v3.1.0`.

### Fixed
* **Universal Haptics Enforcement:** Fully routed all tactile interactions across bottom navigation (`FloatingNavBar.tsx`), search (`search.tsx`), `press-scale.tsx`, library, and sheet components through `@/src/utils/haptics`. Completely eliminated direct `expo-haptics` calls to guarantee 100% vibration-free operation when haptics are disabled in Settings.
* **Scoped Storage Restore Across Re-installs (`EACCES` Resolution):** Declared `MANAGE_EXTERNAL_STORAGE`, integrated MediaScanner indexing, and added Android Storage Access Framework (SAF) document picker fallback (`pickAndRestoreBackup()`) so users can restore `Documents/AuraMusic/backup.json` seamlessly without permission denials on Android 10+ / 14+.
* **Artist Page Polish & Taste Profile Synchronization:** Removed the dummy 3-dots action button from `FloatingControlPanel` on `app/artist/[id].tsx`. Connected the Follow button directly to `useTasteProfileStore`, saving followed artists to user preferences and dynamically updating recommendation engine priors.
* **In-App Package Installer & Unknown Apps Security Flow:** Added `REQUEST_INSTALL_PACKAGES` permission to `AndroidManifest.xml` and created native `AuraInstallerModule.kt` to verify `packageManager.canRequestPackageInstalls()` on Android 8.0–14+. Introduced an interactive Liquid Glass security guard modal guiding users to enable "Allow from this source" in Settings, and updated the `INSTALLING` state with "Relaunch Installer" and "Return to Update Screen" controls to prevent infinite spinner traps.

---

## [3.0.0] - 2026-09-29

### The Sonic Nebula & Connected Experience Release

AuraMusic v3.0.0 introduces the complete **Sonic Nebula** first-run onboarding experience, a decoupled **Taste Profile Prior Layer** with mathematical cold-start decay, **Personal Connected Libraries** (Google / YouTube Music) with automated data purging, and enhanced **Android Auto Cloud Backup & Restore** with post-restore database validation.

### Added
* **The Sonic Nebula Onboarding (9-Step Experience):**
  * Atmospheric 9-screen first-run flow (`app/onboarding.tsx`): Welcome screen with signature animated "hello" vector stroke (`WelcomeStrokeSvg.tsx`), Name input with fluid curved capsule design (`CurvedNameInput.tsx`), Language selection with expanded regional taxonomy, Genre & Mood selection, and Dynamic Artist Discovery.
  * Living atmospheric backgrounds: Grape Dusk atmosphere (`GrapeDuskAtmosphere.tsx`, optimized 77 KB WebP with hardware-accelerated horizontal drift and organic scaling), Liquid Atmosphere, and celestial constellation particles (`ConstellationParticles.tsx`).
  * Scalable vector AuraMusic logo (`AuraLogoSvg.tsx`) replacing legacy bitmap assets on the welcome screen.
  * Pill-shaped dynamic artist discovery loader (`ArtistDiscoveryLoader.tsx`) with rotating status indicators ("Finding best artists...", "Figuring out who is best for you...") while dynamically querying artist suggestions based on user language/genre inputs.
  * 4-tier artist avatar fallback hierarchy (`ArtistAvatarCard.tsx`: Remote InnerTube CDN -> Memory Cache -> Deterministic Gradient with Initials -> Icon Placeholder).
  * Backup-First entrypoint: "Look for Backups" button on the welcome screen allowing returning users to recover from Google Cloud backup immediately without completing manual onboarding.
  * Zero-flash splash screen gate holding `SplashScreen.preventAutoHideAsync()` until fonts, taste profile, and initial screens are fully rendered.
* **Taste Profile Architecture (Prior Layer):**
  * Pure cold-start prior layer (`src/features/taste-profile/store/taste-profile.store.ts`), strictly separating explicit onboarding preferences from organic listening history.
  * Mathematical cold-start prior decay formula (`decayFactor = Math.max(0.1, 1.0 - totalHistoryCount / 40)`), gracefully transferring recommendation weighting to organic listening signals as history accumulates.
  * Dedicated Taste Profile Editor & Reset screen (`app/music_taste.tsx` / `/music_taste`) accessible via Settings, enabling users to re-tune favorite artists, genres, and languages or reset onboarding preferences without erasing listening history, downloaded tracks, or custom playlists.
* **Connected Music Libraries (Personal Testing / Developer Capability):**
  * Multi-provider architecture for YouTube Music, Spotify, and Apple Music (`src/features/connected-libraries/`).
  * Native Google Sign-In integration via `@react-native-google-signin/google-signin` and `play-services-auth:21.4.0` requesting minimal read-only scope (`youtube.readonly`).
  * Two-stage revocation workflow: attempts remote OAuth token revocation, clears local session credentials, and displays direct links to Google Account Security Settings if remote revocation cannot be verified.
  * Automated local Authorized Data cleanup (`youtube-data-cleanup.service.ts`) systematically purging imported playlists, tracks, and cached tokens upon disconnection.
* **Android Auto Cloud Backup & Restore Verification:**
  * Declarative backup XML rules (`data_extraction_rules.xml` and legacy `backup_rules.xml`) including Room SQLite database (`aura_music.db`, `-wal`, `-shm`), `AsyncStorage`/`RKStorage`, and SharedPreferences.
  * Intentional exclusion of offline media files from cloud backup to prevent cloud quota saturation, paired with download queue reconciliation on restore.
  * Dedicated "Fetch Latest Backup" UI action and "Back Up Now" action in Settings that creates a local checkpoint and schedules Android Cloud Backup.
  * Post-restore database integrity validator (`RestoreValidatorService`) verifying SQLite schema consistency, WAL journal reconciliation, and playlist record integrity.
  * Native Android foreground status notifications for backup and restore lifecycle states.
* **Website & Documentation Mirroring:**
  * Production web landing page powered by Vite + React 19 + Tailwind CSS v4 + Framer Motion (`website_vite_backup` canonical source, `website` deployment mirror).

### Changed
* Upgraded Android build configuration: `versionCode 4`, `versionName 3.0.0`, targeting Android SDK 36 (Android 16 preview compatible) with min SDK 24.
* Refined onboarding button visual hierarchy: "Get Started" as high-contrast primary CTA; "Look for Backups" as secondary atmospheric glass pill to focus first-time users.
* Dynamic artist suggestion generation in onboarding based on preceding language and genre choices instead of static hardcoded lists.
* Home screen recommendation hydrator (`recommendation-hydrator.ts`) updated to read cold-start seeds from `tasteProfileStore` with active decay weighting against Room listening history.

### Fixed
* Eliminated white flash during app cold start by synchronizing `SplashScreen` auto-hide with initial theme and font mounting.
* Fixed search bar keyboard dismissal and viewport clipping in `music_taste.tsx` by integrating keyboard listeners and smooth container translation.
* Resolved `DEVELOPER_ERROR` troubleshooting documentation for Google Sign-In by providing exact SHA-1 fingerprints (`auramusic-release.keystore` and `debug.keystore`) and Google Cloud Console configuration guidance.
* Fixed playlist track deletion in custom playlists with one-tap removal and optimistic Zustand state updates.

### Security & Privacy
* Minimal Google OAuth scope: strictly `https://www.googleapis.com/auth/youtube.readonly`.
* Zero analytics telemetry or user tracking sent to external cloud servers.
* Complete local purge of all imported YouTube data upon disconnection.
* Fallback guidance for manual token revocation via Google Account Permissions.

### Known Limitations
* Google / YouTube Music connection is a personal / manual testing capability requiring the user's Android OAuth client ID and SHA-1 certificate fingerprint to be registered in Google Cloud Console project `304304144156`.
* Initial BotGuard / PoToken generation via headless WebView may introduce a 1–3 second delay on the very first track play on cold boot; subsequent plays resolve instantaneously.
* Scoped Storage constraints on Android 13+ restrict local music indexing to media directories permitted under `READ_MEDIA_AUDIO`.
* Cross-device cloud backup round-trip testing is not physically verified; local database checkpointing and Android `BackupManager.dataChanged()` dispatch are verified on-device.

---

## [2.0.0] - 2026-09-20

### Liquid Glass & Native Media3 Architecture

* **Kotlin Native Audio Core:** Migrated entire playback, queue, and streaming pipeline to AndroidX Media3 (ExoPlayer) in Kotlin.
* **On-Device Stream Resolution:** Direct InnerTube `WEB_REMIX` and `ANDROID_VR` streaming format resolvers inside Kotlin.
* **Room Database:** Integrated AndroidX Room SQLite database (`aura_music.db`) for playback history, custom playlists, and cached lyrics.
* **Media3 Offline Downloads:** Background download service with parallel chunking and resume capability.
* **Liquid Glass Design System:** Complete visual redesign featuring 38–54 blur radius hierarchies, dynamic artwork gradient theming, and Reanimated v4 gesture-driven modals.
* **Multi-Provider Synced Lyrics:** Real-time synchronized LRC lyrics powered by LRCLIB and KuGou with SQLite caching.
* **120Hz High Refresh Rate:** Hardware-synchronized display mode configuration ensuring fluid 120 FPS animations.

---

## [0.1.0-beta.1] - 2026-09-04

### Initial Public Beta Release

This marks the first public standalone beta release of **AuraMusic**, an atmospheric, serverless Android music player featuring direct on-device stream resolution, native AndroidX Media3 audio playback, and a signature Liquid Glass design language.

### 🌟 Major Highlights & Capabilities

#### 1. Native Audio & Media Engine
* **AndroidX Media3 (ExoPlayer) Core:** Authoritative on-device playback timeline with low-latency hardware audio decoding and adaptive buffer management.
* **Direct Serverless Stream Resolution:** Multi-tier client resolution pipeline (`InnerTube WEB_REMIX` with `ANDROID_VR` fallback) eliminating middleman proxy servers.
* **AOT (Ahead-of-Time) Queue Resolution:** Automatically resolves stream URLs for queued tracks before the active track ends, enabling smooth, instant track transitions.
* **Volume Normalization:** ReplayGain / EBU R128 loudness normalization (`normalizeVolume`) calculating track-level gains dynamically.
* **OEM System Equalizer Integration:** Direct intent launch to system and hardware equalizers (`openSystemEqualizer`) attached to the active Android Audio Session.
* **Android MediaSession & Background Playback:** Full integration with Android `MediaSessionCompat` / Media3 `MediaSession` supporting lockscreen controls, notification actions, Bluetooth headsets, WearOS, and Android Auto.

#### 2. Intelligent Search & Vibe Queue
* **Deterministic Music-First Search:** Multi-signal matching (token overlap, prefix matching, Jaro-Winkler distance) with automatic suppression of podcasts, gaming clips, and UGC noise.
* **Candidate-Assisted Search Intent:** Accurately distinguishes queries targeting artists, albums, playlists, or individual songs to display contextual hero result cards.
* **Vibe-Aware Dynamic Queue:** When user queue nears completion, dynamically generates continuation tracks using mathematical affinity scoring with strict artist and album diversity constraints.

#### 3. Library, Offline & Lyrics
* **Native Offline Downloads:** Background download manager powered by Media3 `DownloadService` with resumable parallel chunking and physical file storage.
* **Synchronized Lyrics:** Real-time synced LRC lyrics powered by **LRCLIB** and **KuGou**, backed by local Room database caching and an LRU memory cache.
* **Local-First SQLite Persistence:** Instant state recovery, listening history, play counts, and playlists backed by on-device Room SQLite database.

#### 4. Performance & Design
* **Cold Startup Optimization:** Sub-1.2s first meaningful frame and sub-1.5s interactivity on Android 14 through deferred Chromium prewarming and non-blocking startup validation.
* **Liquid Glass Interface:** Refractive blur surfaces (38–54 blur radius), dynamic album-art gradients, and gesture-driven sheets via React Native Reanimated v4.

---

### ⚠️ Known Limitations in Beta 1
* **First-Track Token Resolution:** On cold boot or after long idle periods, initial BotGuard token acquisition via headless WebView may introduce a 1–3s delay on the very first track play. Subsequent plays resolve instantaneously.
* **Third-Party API Fluctuation:** As stream resolution communicates directly with public YouTube endpoints, upstream signature updates may occasionally affect stream availability until client profile headers are refreshed.
* **Android Scoped Storage:** Local music scanning is constrained to media files accessible under standard Android media permissions (`READ_MEDIA_AUDIO`).

---

### 🧪 Testing & Validation Status
* **Validated Devices:** Tested on physical Android 14 (iQOO Neo6, API 34) and Android Virtual Devices.
* **Verification Scope:** Standalone execution, clean installation, upgrade installation, background lockscreen controls, seeking, downloading, and offline playback.
