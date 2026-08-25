# AuraMusic Native Core Migration

## Current Architecture
- React Native UI communicating with a local/remote FastAPI backend via Axios.
- React Native Track Player (`@rntp/player`) for playback.
- FastAPI backend handles search, metadata, and stream URL resolution using ytmusicapi and yt-dlp.
- Stream URLs are returned to RN and passed to Track Player.

## Verified Phase 1B Architecture
- Kotlin Native Module successfully acquires `visitorData` via OkHttp natively.
- Executes BotGuard locally in headless WebView to get `poToken`.
- Sends native request to `ANDROID_VR` client on InnerTube.
- Successfully gets pre-signed `audio/mp4` stream URLs without any JS cipher decoding.
- Audio handoff to Media3 (`ExoPlayer`) verified successfully on-device.

## Target Architecture
- Serverless Native Kotlin Core (`com.auramusic.core`).
- Native Search & Metadata parsing using InnerTube.
- Native URL resolution and playback using `ANDROID_VR` and `Media3`.
- React Native acts purely as a UI layer issuing commands via Expo Modules.

## Native Core Boundaries
- `com.auramusic.core.youtube`: Search and track lookup.
- `com.auramusic.core.botguard`: Token handling.
- `com.auramusic.core.stream`: Stream resolution.
- `com.auramusic.core.playback`: Media3 lifecycle.
- `com.auramusic.core.db` & `history`: Persistence.
- `com.auramusic.core.bridge`: Expo module interface.

## Next steps
- Create package structure.
- Extract POC code into production interfaces.
- Integrate Expo module bridge.
- Connect React Native.