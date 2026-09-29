# Contributing to AuraMusic

Thank you for your interest in contributing to **AuraMusic**! 🎵

AuraMusic is built with a strong focus on on-device architectural purity, atmospheric design, and native audio fidelity. We welcome contributions that align with these principles.

---

## 1. Development Setup

### Prerequisites
* **Node.js**: `>= 18.x` (Recommended: Node 20 LTS)
* **Java Development Kit**: **JDK 17** (Required for React Native 0.83+ and Gradle 9)
* **Android SDK**:
  * Android SDK Build-Tools `35.0.0`
  * Android Platform SDK `35` / `36` (compileSdk & targetSdk 36)
  * Minimum device API target: Android 7.0 (API 24)
* **Android Studio**: Configured with Android NDK and CMake 3.22.1+.
* **Hardware**: Physical Android device with USB debugging enabled, or an Android Virtual Device (AVD).

### Setup Steps
```bash
# 1. Clone your fork
git clone https://github.com/<your-username>/AuraMusic.git
cd AuraMusic

# 2. Install dependencies (applies patches automatically)
npm install

# 3. Verify TypeScript check
npx tsc --noEmit

# 4. Run on a connected Android device or emulator
npx expo run:android
```

---

## 2. Branch Workflow

* Always branch off `master`:
  ```bash
  git checkout master
  git pull origin master
  git checkout -b feat/your-feature-name
  # or
  git checkout -b fix/your-bug-fix
  ```
* Name branches descriptively:
  * `feat/<feature-summary>`
  * `fix/<bug-summary>`
  * `perf/<optimization-summary>`
  * `docs/<documentation-summary>`

---

## 3. Architecture Preservation & Rules

AuraMusic has strict architectural boundaries to preserve Media3 pipeline stability and memory efficiency:

1. **Native Authority for Audio**: Never place raw streaming, audio decoding, or timeline management logic in JavaScript. The Kotlin Native Core (`com.auramusic.core.playback`) is the single source of truth for audio playback.
2. **On-Device Stream Resolution**: Never introduce middleman cloud proxy scrapers or external backend server dependencies. Stream resolution remains on-device inside Kotlin.
3. **Decoupled Taste Profile Prior Layer**: Onboarding cold-start preferences live in `tasteProfileStore` as a prior layer; they must NEVER synthesize fake playback events into Room listening history. Recommendation hydration decays this prior gracefully (`decayFactor = max(0.1, 1.0 - H/40)`).
4. **Zustand State Isolation**: JavaScript domain stores (`player.store.ts`, `download.store.ts`, etc.) must remain reactive consumers of native events, not state duplicators.
5. **Liquid Glass UI Standards**: Preserve the visual depth and blur token hierarchy (38–54 blur radius, subtle borders, atmospheric gradients). Avoid flat or utilitarian UI regressions.
6. **No Discarded Audio Features**: Do NOT attempt to reintroduce in-app software DSP equalizers, crossfade, or app-level gapless toggles without prior RFC discussion; native Media3 handles gapless timeline transitions naturally.

---

## 4. Coding Standards

* **TypeScript**: Strict type compliance (`noImplicitAny`). Do not use `any` unless absolutely forced by external untyped libraries.
* **Kotlin**: Idiomatic Kotlin coroutines (`Dispatchers.IO` for disk/network, `Dispatchers.Main` for UI/ExoPlayer), structured concurrency (`SupervisorJob`), and null-safety.
* **Code Formatting**: Clean indentation, self-documenting naming, and preservation of existing docstrings.

---

## 5. Testing Expectations

Before opening a pull request, you must verify:

1. **TypeScript Type Check**:
   ```bash
   npx tsc --noEmit
   ```
2. **Native Android Compilation**:
   ```bash
   cd android
   ./gradlew compileDebugKotlin
   ./gradlew assembleDebug
   cd ..
   ```
3. **Physical Device Verification**:
   * App boots cleanly without crashing.
   * Search queries return relevant tracks.
   * Playback starts and seek controls respond.
   * Lock screen / background notification displays properly.

---

## 6. Pull Request Expectations

* Title your PR using Conventional Commits format (e.g., `feat: add album track duration badges`, `fix: prevent playback state desync on headset disconnect`).
* Fill out the PR description with:
  * Motivation and context
  * Specific files modified
  * Evidence of testing (screenshots, device tested, logcat verification)
* Keep PRs atomic and focused. Do not combine unrelated refactors with bug fixes.

---

## 7. Issue Workflow

* Check existing issues before opening a new one to avoid duplicates.
* Use the provided issue templates:
  * [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)
  * [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)
  * [Performance Issue](.github/ISSUE_TEMPLATE/performance_issue.md)
* For security vulnerabilities, follow the private disclosure process in [SECURITY.md](SECURITY.md).
