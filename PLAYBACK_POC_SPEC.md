# PLAYBACK_POC_SPEC.md — Vertical Slice POC

## OBJECTIVE

Prove that a React Native app can play audio from YouTube CDN with ZERO server involvement, using only on-device Kotlin code.

## ACCEPTANCE CRITERIA

### MUST PASS (all required for GO)

1. **Video ID in → Audio out**
   - Input: YouTube video ID (e.g., "dQw4w9WgXcQ")
   - Output: Audio plays through device speakers
   - Path: RN → Bridge → Kotlin → InnerTube → Cipher → YouTube CDN → Media3 → Speakers

2. **No server dependency**
   - FastAPI backend is NOT running
   - No reference to any Aura server in the request path
   - No cookies or authentication used

3. **Public content only**
   - Any public YouTube video can be played
   - No login required

4. **Stream resolution works**
   - Player request returns valid streamingData
   - Cipher (if present) is solved correctly
   - N-parameter (if present) is processed correctly
   - Audio format is selected (highest available bitrate)

5. **Basic controls work**
   - Play
   - Pause
   - Seek (position changes)
   - Current position updates in UI

6. **Error handling works**
   - Invalid video ID → shows error, does not crash
   - Network unavailable → shows error, does not crash
   - Expired stream → re-resolves automatically

### NICE TO HAVE (not required for GO)

- Queue: play next track automatically
- Skip next/previous
- Album art displays
- Lyrics fetch works

## POC ARCHITECTURE

```
┌─────────────────────────────────────────┐
│            React Native UI              │
│  ┌─────────────────────────────────┐   │
│  │  Simple player screen            │   │
│  │  - Text input for video ID       │   │
│  │  - Play/Pause button             │   │
│  │  - Seek bar                      │   │
│  │  - Status text                   │   │
│  └──────────────┬──────────────────┘   │
│                 │                        │
│  ┌──────────────┴──────────────────┐   │
│  │  useAuraMusic() hook             │   │
│  │  - play(videoId)                 │   │
│  │  - pause()                       │   │
│  │  - seek(position)                │   │
│  │  - playerState                   │   │
│  └──────────────┬──────────────────┘   │
│                 │ JSI                    │
└─────────────────┼───────────────────────┘
                  │
┌─────────────────┼───────────────────────┐
│    AuraMusicCore (Kotlin)               │
│                 │                        │
│  ┌──────────────┴──────────────────┐   │
│  │  AuraMusicModule                 │   │
│  │  - search(videoId)               │   │
│  │  - play(videoId)                 │   │
│  │  - pause()                       │   │
│  │  - seek(position)                │   │
│  └──────┬───────────┬──────────────┘   │
│         │           │                    │
│  ┌──────┴──────┐ ┌──┴───────────────┐  │
│  │ InnerTube   │ │ PlayerController  │  │
│  │ Client      │ │ (Media3)          │  │
│  └──────┬──────┘ └──────────────────┘  │
│         │                                │
│  ┌──────┴──────────────────────────┐   │
│  │ StreamResolver                   │   │
│  │ ┌─────────────┐ ┌────────────┐  │   │
│  │ │CipherService│ │FormatSelect│  │   │
│  │ └─────────────┘ └────────────┘  │   │
│  └──────────────────────────────────┘   │
│                                          │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────┼───────────────────────┐
│              INTERNET                    │
│  ┌───────────┐  ┌───────────────────┐   │
│  │ YouTube   │  │ YouTube CDN       │   │
│  │ InnerTube │  │ (googlevideo.com) │   │
│  │ API       │  │                   │   │
│  └───────────┘  └───────────────────┘   │
└──────────────────────────────────────────┘
```

## IMPLEMENTATION CHECKLIST

### Step 1: Expo Module Shell
- [ ] Create `modules/aura-music-core/`
- [ ] Define `AuraMusicModule` with `Name("AuraMusicCore")`
- [ ] Add test function `getDeviceInfo()`
- [ ] Verify from React Native

### Step 2: InnerTube HTTP Client
- [ ] Add Ktor dependency
- [ ] Implement `InnerTubeClient` with single WEB_REMIX profile
- [ ] Implement `SessionManager` for visitor data
- [ ] Test: `player("dQw4w9WgXcQ")` returns valid response

### Step 3: Cipher Service
- [ ] Add QuickJS dependency (aspect-quickjs)
- [ ] Implement `PlayerScriptParser`
- [ ] Implement `CipherService` with signature + n-parameter solving
- [ ] Test: `resolve("dQw4w9WgXcQ")` returns valid stream URL

### Step 4: Stream Resolver
- [ ] Implement `StreamResolver` orchestrating player + cipher
- [ ] Implement `FormatSelector` for audio format selection
- [ ] Test: `resolve("dQw4w9WgXcQ")` returns playable URL

### Step 5: Media3 Player
- [ ] Implement `PlayerController` with ExoPlayer
- [ ] Implement `ResolvingDataSource` for on-demand resolution
- [ ] Implement play/pause/seek
- [ ] Test: Audio plays, controls work

### Step 6: React Native Integration
- [ ] Add bridge functions to `AuraMusicModule`
- [ ] Create `useAuraMusic()` hook
- [ ] Build simple player UI
- [ ] End-to-end test

## TEST DATA

Valid public video IDs for testing:
- `dQw4w9WgXcQ` — Never Gonna Give You Up (Rick Astley)
- `9bZkp7q19f0` — Gangnam Style (PSY)
- `kJQP7kiw5Fk` — Despacito (Luis Fonsi)
- `JGwWNGJdvx8` — Shape of You (Ed Sheeran)
- `OPf0YbXqDm0` — Uptown Funk (Bruno Mars)

## SUCCESS METRICS

| Metric | Target | Measurement |
|---|---|---|
| Time to first audio | <5 seconds | From "Play" tap to audio output |
| Stream resolve latency | <2 seconds | From request to URL |
| Cipher solve time | <500ms | From player JS download to solution |
| Memory usage | <200MB total | RSS during playback |
| CPU usage | <30% during playback | During active streaming |
| No crashes | 0 crashes in 100 plays | Stress test |

## WHAT PROVES THE ARCHITECTURE

If this POC passes all MUST PASS criteria, it proves:

1. ✅ InnerTube API works directly from Android (no server needed)
2. ✅ Cipher deobfuscation works on-device
3. ✅ Stream URLs can be resolved without yt-dlp
4. ✅ Media3 can play resolved streams
5. ✅ React Native can control native playback via bridge
6. ✅ The entire serverless architecture is feasible

If this POC FAILS, the architecture is NO-GO and we must redesign.

END OF FILE
