# AuraMusic v3.0.0 — Official Release Notes

Welcome to the official release of **AuraMusic v3.0.0**! 🎵

AuraMusic is a modern, serverless Android music player engineered for pure audio fidelity, atmospheric visuals, and complete server independence. Built with **React Native (Expo SDK 55)** and a high-performance **Kotlin Native Core (AndroidX Media3)**, AuraMusic runs entirely on your device with no external middleman proxy or subscription login required.

> [!NOTE]
> **Source-Available Release**: AuraMusic is distributed as source code and standalone signed APK packages for personal testing, technical evaluation, and educational exploration. All rights are reserved by the author.

---

### ✨ Highlights & What's New in v3.0.0

* **The Sonic Nebula Onboarding (9-Step Experience)**:
  * Atmospheric 9-screen first-run experience (`app/onboarding.tsx`) introducing new users to the app with a living Grape Dusk sky (`GrapeDuskAtmosphere.tsx`, optimized 77 KB WebP with smooth horizontal drift and scale), celestial constellation particles, and a scalable vector AuraMusic logo.
  * Signature **"hello" animated SVG vector stroke** (`WelcomeStrokeSvg.tsx`) dynamically rendered on the welcome screen.
  * **CurvedNameInput** with smooth keyboard handling, clear action, and an animated dual-gradient focus ring (`#BF5AF2` to `#46F5E0`).
  * Dynamic **Artist Discovery Loader** (`ArtistDiscoveryLoader.tsx`) featuring a pill-shaped container with real-time rotating status messages ("Finding best artists...", "Figuring out who is best for you...") while dynamically querying suggestions based on user language/genre choices.
  * 4-tier artist avatar fallback hierarchy (`ArtistAvatarCard.tsx`: Remote InnerTube CDN -> Memory Cache -> Deterministic Gradient with Initials -> Icon Placeholder).
  * **Backup-First Entrypoint**: "Look for Backups" button allowing returning users to recover their playlists and preferences directly from Google Cloud backup without going through onboarding.
  * **Zero-Flash Splash Gate**: Synchronizes `SplashScreen` auto-hide with initial theme and font mounting to prevent 1-frame flashes on cold launch.

* **Decoupled Taste Profile Architecture (Prior Layer)**:
  * Pure cold-start prior layer (`src/features/taste-profile/store/taste-profile.store.ts`), strictly separating explicit onboarding preferences from organic listening history.
  * Mathematical cold-start prior decay formula (`decayFactor = Math.max(0.1, 1.0 - totalHistoryCount / 40)`), gracefully transferring recommendation weighting to organic listening signals as history accumulates.
  * Dedicated **Taste Profile Editor & Safe Reset** (`/music_taste`) in Settings, enabling users to re-tune favorite artists, genres, and languages or reset onboarding preferences without erasing listening history, downloaded tracks, or custom playlists.

* **Connected Music Libraries (Personal Testing / Developer Capability)**:
  * Multi-provider architecture for YouTube Music, Spotify, and Apple Music (`src/features/connected-libraries/`).
  * Native Google Sign-In integration via `@react-native-google-signin/google-signin` and `play-services-auth:21.4.0` requesting minimal read-only scope (`youtube.readonly`).
  * Two-stage revocation workflow: attempts remote OAuth token revocation, clears local session credentials, and displays direct links to Google Account Security Settings if remote revocation cannot be verified.
  * Automated local Authorized Data cleanup (`youtube-data-cleanup.service.ts`) systematically purging imported playlists, tracks, and cached tokens upon disconnection.

* **Android Auto Cloud Backup & Restore System**:
  * Declarative backup XML rules (`data_extraction_rules.xml` and legacy `backup_rules.xml`) covering Room DB (`aura_music.db`, `-wal`, `-shm`), `AsyncStorage`/`RKStorage`, and SharedPreferences.
  * Intentional exclusion of offline media files from cloud backup to prevent quota exhaustion, paired with download queue reconciliation on restore.
  * Dedicated "Fetch Latest Backup" UI action and "Back Up Now" action in Settings that creates a local checkpoint and schedules Android Cloud Backup.
  * Post-restore database integrity validator (`RestoreValidatorService`) verifying SQLite schema consistency, WAL journal reconciliation, and playlist record integrity.
  * Native Android foreground status notifications for backup and restore lifecycle states.

* **Core Playback & Design Language**:
  * Authoritative on-device playback timeline in Kotlin via **AndroidX Media3 (ExoPlayer)**.
  * Direct on-device stream resolution (`InnerTube WEB_REMIX` with `ANDROID_VR` fallback).
  * Signature **Liquid Glass Design Language** featuring 38–54 blur radius hierarchies, dynamic album-art gradients, and Reanimated v4 gesture physics.
  * Real-time synchronized LRC lyrics powered by LRCLIB and KuGou with SQLite caching.
  * High-performance 120Hz display refresh rate synchronization.

---

### 📦 Release Artifacts & Verification

* **File**: `AuraMusic-v3.0.0-universal.apk` (Standard Release: `app-release.apk`)
* **Size**: `119,083,062 bytes` (~113.57 MiB)
* **Build Date**: `2026-09-30`
* **Version**: `3.0.0`
* **Version Code**: `4`
* **Package**: `com.anonymous.AuraMusic`
* **Architecture**: Universal (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`)
* **Minimum Android Version**: Android 7.0 (API Level 24)
* **Target Android Version**: Android 16 Preview (API Level 36)
* **SHA-256**: `9695e8d7eea9512294f0551bf202914aa4c785a6d7f87ddce9e55a9d54e2a6a1`
* **Git Release Tag**: `v3.0.0`

---

### 📲 Installation Instructions

1. Download **`AuraMusic-v3.0.0.apk`** from the official GitHub Releases page.
2. Open the downloaded `.apk` file on your Android device (Android 7.0 / API 24 or newer).
3. If prompted, enable **"Install unknown apps"** for your browser or file manager in Android Settings.
4. Tap **Install** and launch AuraMusic!
5. Follow the **Sonic Nebula Onboarding** flow to personalize your music taste, or tap **"Look for Backups"** to restore previous data.

---

### ⚠️ Known Limitations & Scope Notes

* **Connected Apps / YouTube Music Setup**: The YouTube Music connection is a personal / manual testing capability. Connecting successfully on physical Android devices requires registering the application ID (`com.anonymous.AuraMusic`) along with your release/debug keystore SHA-1 fingerprint as an Android OAuth Client ID in Google Cloud Console project `304304144156`.
* **First Track Latency**: On cold launch or after token expiry, initial BotGuard token acquisition may take 1–3 seconds before the first audio track buffers. Subsequent tracks resolve in under 300ms.
* **Upstream Streaming Changes**: AuraMusic communicates directly with public streaming endpoints. Sudden YouTube format changes can occasionally disrupt resolution until app resolvers are updated.
* **Scoped Storage Constraints**: Local library scanning only accesses audio files located within standard media folders permitted under Android 13+ `READ_MEDIA_AUDIO`.
* **Cloud Backup Status**: Local database checkpointing and Android `BackupManager.dataChanged()` dispatch are verified on-device. Full cross-device cloud round-trip restore requires an active Google One / Android Backup environment.

---

### 💬 Feedback & Bug Reports

Encountered an issue or have a feature suggestion?
Please open an issue on our [GitHub Issue Tracker](https://github.com/helloabhishek2004/AuraMusic/issues) using the appropriate issue template:
* 🐛 [Bug Report](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=bug_report.md)
* 💡 [Feature Request](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=feature_request.md)
* ⚡ [Performance Issue](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=performance_issue.md)
