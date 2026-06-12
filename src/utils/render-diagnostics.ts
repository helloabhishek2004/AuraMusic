import { makeMutable } from 'react-native-reanimated';
import { NativeModules, Platform } from 'react-native';

const uiLongFrames = makeMutable(0);
const uiJankyFrames = makeMutable(0);
const uiFrozenFrames = makeMutable(0);
const uiAvgFrameTime = makeMutable(0);
const uiFps = makeMutable(0);
const uiFpsCounter = makeMutable(0);
const uiFpsLastTime = makeMutable(0);

const jsLongFrames = makeMutable(0);
const jsJankyFrames = makeMutable(0);
const jsFrozenFrames = makeMutable(0);
const jsAvgFrameTime = makeMutable(0);
const jsFps = makeMutable(0);

// Thread-safe Shared Values for UI/JS accumulation
const uiTotalFrameTime = makeMutable(0);
const uiTotalFramesRecorded = makeMutable(0);
const uiLastTimestamp = makeMutable(0);

const jsTotalFrameTime = makeMutable(0);
const jsTotalFramesRecorded = makeMutable(0);

const activeRefreshRate = makeMutable(60.0);

let jsLastFrameTime = 0;
let jsFrameCounter = 0;
let jsFpsLastTime = 0;
const isMonitoringShared = makeMutable(false);

export const RenderDiagnostics = {
  // Shared values exposed for UI consumption
  uiLongFrames,
  uiJankyFrames,
  uiFrozenFrames,
  uiAvgFrameTime,
  uiFps,
  
  jsLongFrames,
  jsJankyFrames,
  jsFrozenFrames,
  jsAvgFrameTime,
  jsFps,

  activeRefreshRate,

  startMonitoring() {
    if (isMonitoringShared.value) return;
    isMonitoringShared.value = true;

    // Start JS Thread frame pacing loop
    jsLastFrameTime = performance.now();
    jsFpsLastTime = performance.now();
    jsFrameCounter = 0;
    jsTotalFrameTime.value = 0;
    jsTotalFramesRecorded.value = 0;

    const jsLoop = (now: number) => {
      if (!isMonitoringShared.value) return;
      
      const delta = now - jsLastFrameTime;
      jsLastFrameTime = now;

      // Ignore startup outlier frame timings
      if (delta > 0 && delta < 500) {
        jsTotalFrameTime.value += delta;
        jsTotalFramesRecorded.value++;
        jsAvgFrameTime.value = jsTotalFrameTime.value / jsTotalFramesRecorded.value;

        // Classify frame pacing dynamically based on current refresh rate
        const currentRate = activeRefreshRate.value > 0 ? activeRefreshRate.value : 60.0;
        const frameTarget = 1000.0 / currentRate;
        const longThreshold = frameTarget + 2.0; // Margin to prevent roundoff noise
        const jankThreshold = frameTarget * 2.0 + 2.0;
        const frozenThreshold = 100.0;

        if (delta > frozenThreshold) {
          jsFrozenFrames.value += 1;
        } else if (delta > jankThreshold) {
          jsJankyFrames.value += 1;
        } else if (delta > longThreshold) {
          jsLongFrames.value += 1;
        }
      }

      // Estimate FPS
      jsFrameCounter++;
      const timeElapsed = now - jsFpsLastTime;
      if (timeElapsed >= 1000) {
        jsFps.value = Math.round((jsFrameCounter * 1000) / timeElapsed);
        jsFrameCounter = 0;
        jsFpsLastTime = now;
      }

      requestAnimationFrame(jsLoop);
    };

    requestAnimationFrame(jsLoop);
  },

  stopMonitoring() {
    isMonitoringShared.value = false;
  },

  resetTelemetry() {
    uiLongFrames.value = 0;
    uiJankyFrames.value = 0;
    uiFrozenFrames.value = 0;
    uiAvgFrameTime.value = 0;
    uiFps.value = 0;
    uiFpsCounter.value = 0;
    uiFpsLastTime.value = 0;
    uiTotalFrameTime.value = 0;
    uiTotalFramesRecorded.value = 0;
    uiLastTimestamp.value = 0;

    jsLongFrames.value = 0;
    jsJankyFrames.value = 0;
    jsFrozenFrames.value = 0;
    jsAvgFrameTime.value = 0;
    jsFps.value = 0;
    jsTotalFrameTime.value = 0;
    jsTotalFramesRecorded.value = 0;
    jsFrameCounter = 0;
    jsLastFrameTime = performance.now();
    jsFpsLastTime = performance.now();
  },

  // Record UI-thread frame durations (called from useFrameCallback worklet)
  recordUIFrame(timeSinceLastFrameMs: number, timestampMs: number) {
    "worklet";
    if (!isMonitoringShared.value) return;
    // Prevent double-counting if the callback triggers multiple times in the same frame tick
    if (timestampMs === uiLastTimestamp.value) return;
    uiLastTimestamp.value = timestampMs;

    if (timeSinceLastFrameMs <= 0 || timeSinceLastFrameMs > 500) return;

    uiTotalFramesRecorded.value++;
    uiTotalFrameTime.value += timeSinceLastFrameMs;
    uiAvgFrameTime.value = uiTotalFrameTime.value / uiTotalFramesRecorded.value;

    // Classify frame pacing dynamically based on active refresh rate
    const currentRate = activeRefreshRate.value > 0 ? activeRefreshRate.value : 60.0;
    const frameTarget = 1000.0 / currentRate;
    const longThreshold = frameTarget + 2.0; 
    const jankThreshold = frameTarget * 2.0 + 2.0;
    const frozenThreshold = 100.0;

    if (timeSinceLastFrameMs > frozenThreshold) {
      uiFrozenFrames.value += 1;
    } else if (timeSinceLastFrameMs > jankThreshold) {
      uiJankyFrames.value += 1;
    } else if (timeSinceLastFrameMs > longThreshold) {
      uiLongFrames.value += 1;
    }

    // UI FPS Calculation
    uiFpsCounter.value += 1;
    if (uiFpsLastTime.value === 0) {
      uiFpsLastTime.value = timestampMs;
    }
    const elapsed = timestampMs - uiFpsLastTime.value;
    if (elapsed >= 1000) {
      uiFps.value = Math.round((uiFpsCounter.value * 1000) / elapsed);
      uiFpsCounter.value = 0;
      uiFpsLastTime.value = timestampMs;
    }
  },

  async getCurrentRefreshRate() {
    if (Platform.OS === 'android') {
      try {
        const AuraAudioSession = NativeModules.AuraAudioSession;
        if (AuraAudioSession && AuraAudioSession.getDisplaySpecs) {
          const specs = await AuraAudioSession.getDisplaySpecs();
          
          // Cache current rate in the shared value for UI-thread worklet consumption
          const rate = specs.currentRefreshRate || 60.0;
          activeRefreshRate.value = rate;

          return {
            currentRefreshRate: rate,
            displayMode: specs.modeWidth 
              ? `${specs.modeWidth}x${specs.modeHeight} @ ${specs.modeRefreshRate.toFixed(1)}Hz (Mode ID: ${specs.modeId})` 
              : "Dynamic Display Mode",
            frameInterval: rate ? (1000.0 / rate) : 16.67,
            estimatedFPS: jsFps.value,
            preferredRefreshRate: specs.preferredRefreshRate,
            preferredDisplayModeId: specs.preferredDisplayModeId,
            currentModeId: specs.modeId || 0,
            supportedModes: specs.supportedModes || [],
          };
        }
      } catch (e) {
        console.warn("[RenderDiagnostics] Native display specs query failed:", e);
      }
    }
    return {
      currentRefreshRate: 60.0,
      displayMode: "Default 60.0Hz Mode",
      frameInterval: 16.67,
      estimatedFPS: jsFps.value,
      preferredRefreshRate: 0.0,
      preferredDisplayModeId: 0,
      currentModeId: 0,
      supportedModes: [],
    };
  }
};
