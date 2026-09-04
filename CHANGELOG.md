# Changelog

All notable changes to **AuraMusic** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
