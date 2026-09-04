---
name: Performance Issue
about: Report a stutter, slow startup, dropped frames, or excessive latency
title: '[PERF] <Short description of performance bottleneck>'
labels: ['performance']
assignees: ''
---

## Description
Describe the performance bottleneck, lag, dropped frames, or high latency you are experiencing.

## Environment
- **AuraMusic Version**: [e.g., 0.1.0-beta.1]
- **Device Model**: [e.g., Google Pixel 7, Samsung Galaxy A54]
- **Android Version**: [e.g., Android 14, Android 12]
- **Refresh Rate**: [e.g., 60Hz, 90Hz, 120Hz]

## Affected Area
- [ ] Cold Startup
- [ ] List Scrolling (Home / Search / Playlists)
- [ ] Search Query Latency
- [ ] Track Start Buffering Latency
- [ ] Player Modal Expand/Collapse Animation
- [ ] Memory / Battery Consumption

## Observed Delay & Frame Drops
- **Observed Behavior/Delay**: [e.g., Track takes >5 seconds to start playback, or Now Playing sheet stutters during pull-down]
- **Expected Behavior**: [e.g., Instant smooth 60/120fps gesture transition, or playback buffer under 1.5s]

## Profiling & Logcat (Optional)
If you ran `adb logcat` or Android Studio Profiler, attach relevant timing logs:
```text
<paste timing or Choreographer dropped frame warnings here>
```
