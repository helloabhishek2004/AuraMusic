# AuraMusic — Engineering Memory & Forensic Change Ledger

**Repository:** `helloabhishek2004/AuraMusic`  
**Branch:** `master`  
**Version:** `3.0.0` (Android `versionCode 4`)  
**Package:** `com.anonymous.AuraMusic`  
**Last Updated:** September 2026  

---

## 1. Architectural Memory & Invariants

This file preserves cross-session memory, verified forensic findings, hardware inspections, and architectural invariants for AuraMusic. AI agents and developers must consult this document before proposing architectural modifications.

### Core Architectural Rules
* **ExoPlayer/Media3 is Authoritative:** Audio decoding, position polling, timeline state, and queue transitions are owned exclusively by `AuraPlayer.kt`. React Native never computes playback timing independently.
* **Stream Resolution is On-Device:** InnerTube client requests and format extractions happen directly in Kotlin via `UnifiedStreamResolver.kt`. No proxy servers or third-party web scrapers.
* **Liquid Glass Visual Standard:** Never flatten UI cards, remove blur hierarchies, or alter padding tokens without explicit approval.
* **Fail-Safe AI Boundary:** AI models (Gemini Nano) must NEVER directly mutate audio pipelines or database tables. All model outputs must be strictly validated candidate IDs (`TrackID[] -> TrackID[]`), backed by instantaneous deterministic fallbacks.
* **Strict Google OAuth Compliance:** Whenever Google/YouTube integration is touched, maintain strict adherence to Google API Services User Data Policy and YouTube API Services Terms of Service (minimal scope, zero persistent caching beyond 30 days, complete purge on disconnect).

---

## 2. Verified Forensic Inspections & Hardware Findings

### 2.1. Connected Test Device Diagnostics (Verified September 2026)
* **Device Model:** Vivo I2202 (`ro.product.model = V2202`)
* **SoC / Chipset:** Qualcomm Snapdragon 870 5G (`ro.board.platform = kona` / `SM8250-AC`)
* **OS / API:** Android 14 (`ro.build.version.release = 14`, API Level 34)
* **Total System Memory:** ~8 GB (`7,782,288 kB`)
* **AICore Package Inspection:**
  ```text
  $ adb shell dumpsys package com.google.android.aicore
  Unable to find package: com.google.android.aicore
  ```
* **Critical Finding:** `com.google.android.aicore` is **NOT present** on the Vivo I2202 test device. Google AICore is restricted to Google Tensor (Pixel 8+) and flagship SoCs with certified OEM system integrations (e.g. Snapdragon 8 Gen 3+ on Samsung S24+).
* **Engineering Mandate:** Any future Gemini Nano implementation **must** feature a hardware capability check (`checkGenAIAvailability()`) that gracefully falls back to the deterministic recommendation engine, with an optional mock/cloud stub for testing on the Vivo I2202.

---

## 3. Chronological Change Ledger (Recent Sessions)

### 3.1. Google / YouTube OAuth Compliance & Authorized Data Cleanup
* **Privacy Policy Realignment (`app/privacy_policy.tsx`):**
  - Corrected Section 9 (Data Retention & User Controls) to accurately reflect the two-stage revocation implementation:
    - Attempts remote Google OAuth token revocation via `GoogleSignin.revokeAccess()`.
    - Always clears local Google session credentials.
    - Purges all local Authorized Data (collections, playlists, cached tokens).
    - Sets `remotelyRevoked: false` if network fails or remote revocation cannot be confirmed, and provides fallback links to Google Account Security Settings (`myaccount.google.com/permissions`).
* **YouTube Data Cleanup Service (`src/features/connected-libraries/services/youtube-data-cleanup.service.ts`):**
  - Created standalone service to systematically delete imported YouTube playlists, track metadata, and authorization tokens from local SQLite and Zustand state upon service disconnection.
* **Google Auth Service Update (`src/features/connected-libraries/services/google-auth.service.ts`):**
  - Integrated `youtubeDataCleanupService.cleanupAllYouTubeData()` into the disconnect flow.
  - Returns structured `{ success: true, remotelyRevoked: boolean }` metadata.
* **UI Feedback in Manage Service Modal (`ManageServiceModal.tsx`):**
  - Added visual confirmation of disconnection and clear warning when remote revocation could not be verified, directing users to Google Account Settings.

### 3.2. Google / Android Auto Cloud Backup & Restore System
* **Backup Rules Synchronization (`plugins/withAuraNative.js`):**
  - Updated XML template generators for `data_extraction_rules.xml` (Android 12+) and legacy `backup_rules.xml` (Android <12).
  - Synchronized allowlist to include SQLite WAL journal and AsyncStorage database files:
    - `databases/aura_music.db`
    - `databases/aura_music.db-wal`
    - `databases/aura_music.db-shm`
    - `databases/RKStorage`
    - `databases/RKStorage.db`
    - `databases/AsyncStorage`
    - `databases/AsyncStorage.db`
    - `shared_prefs/aura_player_prefs.xml`
  - Applied allowlist to both Google Cloud Backup and Device-to-Device transfer configs.
* **Restore Integrity Validator (`src/services/restore-validator.service.ts`):**
  - Implemented post-restore validation routine that checks SQLite database file presence, executes PRAGMA integrity checks, verifies table schemas, and issues WAL checkpointing after restore.
* **Settings UI Integration (`app/(tabs)/settings.tsx`):**
  - Added "Fetch Latest Backup" / "Restore from Cloud" button to allow users to manually trigger restoration on demand.
  - Added status indicators for backup/restore state (idle, in-progress, completed, failed).
* **Native Android Notifications:**
  - Integrated foreground notification indicators for Android Backup & Restore progress and status.
* **Fresh Install Detection Lifecycle:**
  - Android OS automatically restores backed-up files from Google Drive prior to first app launch.
  - On first launch, the app detects existing restored DB files, runs `RestoreValidatorService`, performs WAL checkpoints, and re-hydrates user playlists into Zustand.

### 3.3. Display Refresh Rate & Smooth UI Rendering
* **120Hz Maximum Display Mode:**
  - Configured window display mode attributes on Android to request the highest available refresh rate from the display hardware (60Hz -> 120Hz).
  - Ensured smooth 120 FPS animations across Reanimated v4 transitions and FlashList scroll containers.
* **Liquid Atmosphere Background Component (`LiquidAtmosphereBackground.tsx`):**
  - Standardized the signature 3-blob liquid background from the Search page into a high-performance reusable component.
  - Consistently applied across:
    - Home Screen (`app/(tabs)/index.tsx`)
    - Downloads Screen (`app/downloads.tsx`)
    - Connected Apps Screen (`app/connected_apps.tsx`)
    - Download Queue Screen (`app/download-queue.tsx`)
  - Features 100% native driver execution (`useNativeDriver: true`), `AppState` background listener pausing, route visibility matching, and multi-stop depth vignette gradients for contrast and battery efficiency.

### 3.4. Gemini Nano On-Device Recommendation Architecture Audit
* **Audit Artifact:** `AuraMusic_Gemini_Nano_Readiness_Forensic_Audit.md`
* **Forensic Findings:**
  - Evaluated 22 forensic sections covering candidate generation, state stores, Room DB queries, token budgets, latency SLAs, AICore compatibility, and safety boundaries.
  - AuraMusic already implements a clean candidate generation layer (`recommendation-engine.ts` for Home, `autoplay-radio.ts` for Queue) producing 30–60 candidates.
  - Latency SLA during `QUEUE_NEARING_END` provides 3.5 to 7.0 minutes of buffer, making on-device model inference (~300–600ms) completely safe from audio dropouts.
  - Defined strict output JSON schema (`{"ranked_ids": [...]}`) with anti-hallucination validation and deterministic heuristic fallback.
### 3.5. First-Run Onboarding & Dynamic Music Taste System
* **Onboarding & Taste Profile Types (`src/features/taste-profile/types/taste-profile.ts`):**
  - Canonical schema: `MusicTasteProfile` (version 1, `name`, `songLanguages`, `genres`, `favoriteArtists`, `onboardingCompleted`).
  - Artist model: `OnboardingArtist` (`id`, `name`, `artworkUrl`, `source`).
  - Strict separation between declarative user intent and raw behavioral telemetry.
* **Canonical Taste Profile Store (`src/features/taste-profile/store/taste-profile.store.ts`):**
  - Persisted locally via AsyncStorage under `'aura_music_taste_profile'` (allowlisted in `data_extraction_rules.xml`).
  - Provides hydration barrier `ensureTasteProfileHydrated()`, atomic `commitProfile()`, `updateProfile()`, `resetProfile()`, and `markCompletedFromRestore()`.
* **Music Taxonomy Catalog (`src/data/music-taxonomy.ts`):**
  - Curated languages with native script and semantic search tags (Malayalam, Hindi, English, Tamil, Telugu, Punjabi, etc.).
  - Curated genres with gradient stops and search queries (Pop, Hip-Hop, Indie, Synthwave, Lo-Fi, EDM, Acoustic, Classical, R&B, Rock, Bollywood, Devotional).
  - Curated offline artists catalog providing 100% offline functionality.
* **Preference Prior & Candidate Generator (`src/features/taste-profile/services/preference-prior.service.ts`):**
  - Calculates prior affinity scores for selected artists with organic decay (`decayFactor = Math.max(0.1, 1.0 - (historyLength / 40))`).
  - Zero synthetic analytics: no fake play counts, no fake completions, preserving telemetry truthfulness for `calculateRecommendationReadiness`.
  - Builds dynamic discovery carousels (`buildDynamicDiscoverySeeds()`) matching user's taste.
* **First-Run Onboarding UI (`app/onboarding.tsx`):**
  - 5-step flow adhering to "The Sonic Nebula" (Welcome -> Options -> Name -> Languages -> Genres -> Artists -> Creating space animation).
  - Dual options: "Get Started" vs "Look for Backups" (checks native restore, skips onboarding if durable data/profile restored).
  - Integrated debounced YouTube Music artist search via native `AuraYouTube.searchArtists`.
* **Startup Navigation & Splash Hydration Gate (`app/_layout.tsx`):**
  - Implemented `StartupOnboardingGate` holding `SplashScreen.preventAutoHideAsync()` until fonts and taste profile rehydrate.
  - Fresh installs route to `/onboarding` before splash dismisses, eliminating the "Home screen flash".
* **Home Screen Personalization (`app/(tabs)/index.tsx`):**
  - Personalized time-of-day greeting ("Good morning, [Name]").
  - Home discovery carousel (`trendingSeeds`) dynamically tuned to selected languages and genres.
  - Favorite Artists carousel immediately populated on Cold Start from `favoriteArtists`.
* **Settings Taste Profile Editor & Safe Reset (`app/music_taste.tsx` & `app/(tabs)/settings.tsx`):**
  - "Music Taste" row in Settings showing profile summary.
  - Dedicated screen to edit name, languages, genres, and favorite artists at any time.
  - Safe "Reset Taste Profile" action that preserves playlists, downloads, and listening history while routing cleanly to onboarding.
* **Playlist Track Deletion Fix (`app/playlist/[id].tsx`):**
  - Replaced ellipsis 3-dots button with direct `trash-outline` delete icon.
  - Wired track removal across user playlists (`playlist.store`), seed mixes (`recommendations.store`), liked songs (`likes.store`), and active queue. Removed dead action sheet.

### 3.6. Onboarding UI/UX Refinement & Grape Dusk First-Run Experience
* **Grape Dusk Living Sky Atmosphere (`src/components/ui/GrapeDuskAtmosphere.tsx`):**
  - Replaced heavy video decoders with an optimized 77 KB WebP asset (`assets/images/grape_dusk.webp`) layered with 20-second organic scale/drift loops, dual-accent ambient lighting (`#BF5AF2` purple and `#46F5E0` teal), and a multi-stop vignette contrast gradient.
  - 100% native driver execution (`useNativeDriver: true`), `pointerEvents="none"` to never block gestures, and dynamic reduced-motion accessibility support.
* **AuraMusic Vector SVG Logo (`src/components/ui/AuraLogoSvg.tsx`):**
  - Replaced raster approximations with the authentic vector SVG path data from `website/public/aura_logo.svg`, rendering crisp, scalable white branding.
* **9-Screen Apple Music-Grade Onboarding Flow (`app/onboarding.tsx`):**
  - SCREEN 01: AuraMusic Entry (Minimal reveal, fading logo & typography, floating glass continue arrow).
  - SCREEN 02: What AuraMusic Is (Eyebrow, "Music without the noise", 5 progressive staggered feature points).
  - SCREEN 03: Welcome / Wish ("Here's to better listening", celestial `ConstellationParticles` visual, and secondary link to `https://auramusic-jet.vercel.app`).
  - SCREEN 04: Journey Choice (Floating glass action cards: "Get Started" vs "Look for Backups").
  - SCREEN 05: Name (`CurvedNameInput` inspired by React Bits CurvedInput with dynamic focus ring and animated gradient border).
  - SCREEN 06: Song Languages (Floating glass chips with native scripts and active checkmarks).
  - SCREEN 07: Music Genres (Glass cards with gradient glows and icons).
  - SCREEN 08: Favorite Artists (`ArtistAvatarCard` with live InnerTube search, curated suggestions, and floating tray with tap-to-remove).
  - SCREEN 09: Creating Your Space ("Your taste is becoming your Aura..." breathing logo transition).
* **Elimination of Fresh Install Home Screen Flash:**
  - `StartupOnboardingGate` in `app/_layout.tsx` routes fresh installations immediately to `/onboarding` while holding the splash screen.
  - `app/onboarding.tsx` dismisses `SplashScreen.hideAsync()` once the first screen has mounted and painted.
  - `app/(tabs)/index.tsx` includes an airtight guard: if `!onboardingCompleted`, it renders a blank `#131318` view before any section or carousel evaluates, completely eliminating the 1-frame Home flash.
* **Artist Avatars Bug Fix & Fallback System (`src/data/music-taxonomy.ts` & `ArtistAvatarCard.tsx`):**
  - Replaced non-functional placeholder hashes in `CURATED_DISCOVERY_ARTISTS` with 31 verified, high-resolution YouTube/Google CDN thumbnail URLs fetched directly from InnerTube.
  - Created `ArtistAvatarCard` with graceful fallback: valid artwork URL $\to$ cached image $\to$ deterministic initials on gradient with glass rim $\to$ placeholder icon. Zero empty circles or broken images.

### 3.7. Google OAuth Audit, Onboarding Welcome Stroke & v3.0.0 Release Synchronization
* **Google / YouTube Sign-In Forensic Audit (`DEVELOPER_ERROR`):**
  - Conducted forensic audit of `@react-native-google-signin/google-signin` on physical Android device (`com.anonymous.AuraMusic`).
  - Identified root cause of `DEVELOPER_ERROR`: Missing Android OAuth Client ID registration in Google Cloud Console project `304304144156`.
  - Audited release keystore SHA-1: `75:B0:81:48:75:95:EA:EB:8F:B5:86:1D:5D:4B:A7:65:65:61:1B:46`.
  - Audited debug keystore SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
  - Explicitly documented that YouTube Music connection is an external personal/testing capability requiring matching Google Cloud Console credentials.
* **Welcome Stroke SVG & Dynamic Artist Discovery Loader:**
  - Integrated signature animated "hello" vector stroke (`WelcomeStrokeSvg.tsx`) on the welcome screen.
  - Replaced static loading squares with a streamlined pill-shaped `ArtistDiscoveryLoader.tsx` with dynamic rotating status messages.
  - Fixed keyboard dismissal and viewport positioning in `app/music_taste.tsx`.
* **v3.0.0 Release Metadata & Project Context Synchronization:**
  - Synchronized `package.json`, `app.json`, `android/app/build.gradle`, and `src/features/update/utils/app-version.ts` to `3.0.0`, Android `versionCode 4`.
  - Overhauled `CHANGELOG.md` with complete Keep-A-Changelog entries for `[3.0.0] - 2026-09-29` and `[2.0.0] - 2026-09-20`.
  - Rewrote `RELEASE_NOTES.md` for official `v3.0.0` release.
  - Aligned `README.md`, `CONTEXT.md`, `MEMORY.md`, `SECURITY.md`, `CONTRIBUTING.md`, and `.github/ISSUE_TEMPLATE/*`.
  - Documented web landing page deployment: `website_vite_backup` canonical source, `website` deployment mirror (`https://listenwith-auramusic.vercel.app/`).

---

## 4. Active Codebase State & Release Identifiers

* **Release Version:** `3.0.0`
* **Android Version Code:** `4`
* **Target / Compile SDK:** `36` (Android 16 preview compatible)
* **Min SDK:** `24` (Android 7.0)
* **License Model:** Source-available (all rights reserved; no formal OSI license)
* **Connected Libraries Status:** Personal / manual testing capability
* **Backup/Restore Status:** Local checkpointing & BackupManager dispatch verified on-device; cross-device cloud round-trip testing is not physically verified.
* **Canonical Website:** `website_vite_backup` (mirror: `website`, deployment: `https://listenwith-auramusic.vercel.app/`)
