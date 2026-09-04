# AuraMusic v0.1.0-beta.1 — Public Beta Release Notes

Welcome to the first public beta release of **AuraMusic**! 🎵

AuraMusic is a modern, standalone Android music player engineered for pure audio fidelity, atmospheric visuals, and complete server independence. Built with **React Native (Expo SDK 55)** and a high-performance **Kotlin Native Core (AndroidX Media3)**, AuraMusic runs entirely on your device with no external middleman proxy or subscription login required.

> [!WARNING]
> **Beta Release Status**: This is an early public testing build (`v0.1.0-beta.1`) distributed as an independent Android APK. It is **NOT** available on the Google Play Store. You may encounter occasional edge-case bugs or upstream stream format shifts. Please report any issues via GitHub Issues.

---

### ✨ Highlights

* **100% Serverless On-Device Playback**: Stream resolution and audio streaming are executed directly in Kotlin via AndroidX Media3 (ExoPlayer).
* **Atmospheric Liquid Glass UI**: Refractive translucent blur materials, responsive fluid physics, and real-time album cover gradient adaptations.
* **Intelligent Music Search**: Multi-signal relevance ranking that surfaces studio tracks and verified artists while suppressing reaction clips, podcasts, and non-music noise.
* **Vibe-Aware Autoplay Queue**: Mathematical continuation algorithm that preserves musical mood without fatigue when your playlist finishes.
* **Native Offline Downloads**: Save tracks directly to device storage with Media3 `DownloadService` for uninterrupted offline playback.
* **Synchronized LRC Lyrics**: Live synchronized lyrics integration powered by LRCLIB and KuGou with local SQLite caching.
* **Lockscreen & Notification Controls**: Full Android MediaSession integration with interactive seekbars, previous/next buttons, and Bluetooth support.

---

### 📦 What's Included

* `AuraMusic-v0.1.0-beta.1.apk` (Universal release APK for ARM64, ARMv7, x86, and x86_64 Android devices)
* Full source code tag `v0.1.0-beta.1`

---

### 📲 Installation Instructions

1. Download **`AuraMusic-v0.1.0-beta.1.apk`** from the Assets section below.
2. Open the downloaded `.apk` file on your Android device (Android 7.0 / API 24 or newer).
3. If prompted, enable **"Install unknown apps"** for your browser or file manager in Android Settings.
4. Tap **Install** and launch AuraMusic!
5. Grant Notification and Audio Storage permissions when prompted to enable background media controls and local library playback.

---

### ⚠️ Known Limitations

* **First Track Latency**: On cold launch, initial BotGuard token acquisition may take 1–3 seconds before the first audio track buffers. Subsequent tracks resolve in under 300ms.
* **Upstream Streaming Changes**: AuraMusic communicates directly with public streaming endpoints. Sudden YouTube format changes can occasionally disrupt resolution until app resolvers are updated.
* **Scoped Storage Constraints**: Local library scanning only accesses audio files located within standard media folders permitted under Android 13+ `READ_MEDIA_AUDIO`.

---

### 💬 Feedback & Bug Reports

Encountered an issue or have a feature suggestion? We appreciate your help in testing the beta!
Please open an issue on our [GitHub Issue Tracker](https://github.com/helloabhishek2004/AuraMusic/issues) using the appropriate issue template:
* 🐛 [Bug Report](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=bug_report.md)
* 💡 [Feature Request](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=feature_request.md)
* ⚡ [Performance Issue](https://github.com/helloabhishek2004/AuraMusic/issues/new?template=performance_issue.md)
