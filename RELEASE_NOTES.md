# AuraMusic v3.1.0 — Official Release Notes

Welcome to the official release of **AuraMusic v3.1.0**! 🎵

AuraMusic is a modern, serverless Android music player engineered for pure audio fidelity, atmospheric visuals, and complete server independence. Built with **React Native (Expo SDK 55)** and a high-performance **Kotlin Native Core (AndroidX Media3)**, AuraMusic runs entirely on your device with no external middleman proxy or subscription login required.

> [!NOTE]
> **Source-Available Release**: AuraMusic is distributed as source code and standalone signed APK packages for personal testing, technical evaluation, and educational exploration. All rights are reserved by the author.

---

### ✨ Highlights & What's New in v3.1.0

* **Offline Scoped Storage Backup & Recovery Engine (`Documents/AuraMusic/backup.json`)**:
  * Resilient, account-free local library persistence across complete app uninstalls and re-installs.
  * Writes and reads self-contained, versioned, checksummed JSON metadata to the public `Documents/AuraMusic/` directory via Android MediaStore / Scoped Storage (compatible with Android 10+ / API 29–34+).
  * **Cold-Start Auto-Detection**: Fresh installs automatically scan for an existing `backup.json` and display a clean recovery modal ("Previous Library Found: Found a local backup with X songs and Y playlists from [Date]. Would you like to restore it?") with 1-tap restore.
  * **Automatic Background Sync**: Debounced automatic serialization whenever playlists, likes, or history change, as well as on app lifecycle `onStop` / backgrounding.
  * **Manual Backup & Restore UI in Settings**: Instant "Backup Now" with SHA-256 verification and "Restore Library" action with detailed metadata inspection.
  * Legacy Google Cloud Backup UI cleanly disabled with "Temporarily disabled" notice while retaining underlying plumbing intact.

* **Forensic Download Engine & Native Android Notifications**:
  * Direct Media3 download event listener integration bridging native download state transitions directly to the React Native Zustand store.
  * Lifecycle-safe concurrency slot recovery in `download-queue-manager.ts` ensuring failure, cancellation, network drop, and bridge timeouts release active slots to prevent permanent queue lockups.
  * Genuine Android system notifications (`AuraDownloadService.kt`) with dedicated `FOREGROUND_SERVICE_DATA_SYNC` notification channels displaying active progress, bytes, completion, and failure states even when the app is backgrounded or killed.

* **Evolving Daily Home Feed**:
  * Deterministic recommendation and feed rotation engine (`daily-feed-evolution.service.ts`) synthesizing daily-seeded personal playlists ("Daily Mix 1: Flow", "Daily Energy Booster", "Late Night Atmospheric") from organic listening history, liked tracks, skips, and language affinities.
  * Daily rotating hero visual assets and 0ms instantaneous cold-start via disk cache fallback.

* **In-Screen Library & Downloads Search**:
  * High-performance local search input added to `app/downloads.tsx` and `app/(tabs)/library.tsx` (Liked Songs) with instant substring filtering on track title, artist, and album.
  * Preserves active sort criteria and renders responsive empty states when no items match.

* **Universal Haptic Feedback Engine**:
  * Persistent Haptics toggle in Settings (`src/features/settings/store/settings.store.ts`) governing all tactile interactions throughout the app.
  * Subtle, consistent native Android haptic feedback on playback controls, like toggles, and sheet open/dismiss interactions.

* **Fluid 60 FPS Motion System**:
  * Centralized motion and physics tokens (`src/design/motion.ts`) providing consistent spring and ease transitions for page-entries, sheets, dialogs, and player expansion.
  * System-wide reduced-motion preference detection and blur optimization guards preventing UI stutter during intensive animations.

* **Refined Navigation & Playback Ergonomics**:
  * **Queue Auto-Scroll**: Opening the Queue sheet from Now Playing automatically and smoothly scrolls to the active track based on unique item identity, without closing Now Playing or resetting the queue.
  * **Non-Intrusive Playback Selection**: Tapping any track from Home, Search, Downloads, or Liked Songs starts immediate playback while keeping the user on the current screen with mini-player synchronization.

---

### 📦 Release Artifacts & Verification

* **File**: `AuraMusic-v3.1.0-universal.apk` (Standard Release: `app-release.apk`)
* **Size**: `119,142,838 bytes` (~113.62 MiB)
* **Build Date**: `2026-10-18`
* **Version**: `3.1.0`
* **Version Code**: `5`
* **Package**: `com.anonymous.AuraMusic`
* **Architecture**: Universal (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`)
* **Minimum Android Version**: Android 7.0 (API Level 24)
* **Target Android Version**: Android 16 Preview (API Level 36)
* **SHA-256**: `419b27b5eaaa5a44631d3ab5cea49a3451e629163c6315a725b63bcb4871afb6`
* **Git Release Tag**: `v3.1.0`

---

### 📲 Installation Instructions

1. Download **`AuraMusic-v3.1.0-universal.apk`** from the official GitHub Releases page.
2. Open the downloaded `.apk` file on your Android device (Android 7.0 / API 24 or newer).
3. If prompted, enable **"Install unknown apps"** for your browser or file manager in Android Settings.
4. Tap **Install** and launch AuraMusic!
5. If you have an existing library backup in `Documents/AuraMusic/backup.json`, AuraMusic will prompt you to restore it automatically.

---

### 💬 Feedback & Bug Reports

Encountered an issue or have a feature suggestion?
Please open an issue on our [GitHub Issue Tracker](https://github.com/helloabhishek2004/AuraMusic/issues) using the appropriate issue template:
* 🐛 [Bug Report](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=bug_report.md)
* 💡 [Feature Request](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=feature_request.md)
* ⚡ [Performance Issue](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=performance_issue.md)
