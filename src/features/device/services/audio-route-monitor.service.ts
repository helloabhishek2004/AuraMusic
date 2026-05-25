import { Platform } from 'react-native';
import { useDeviceStateStore, AudioRoute } from '../store/device-state.store';
import { PlaybackService } from '../../player/services/playback.service';

/**
 * AudioRouteMonitorService - Diagnostics for hardware playback routing.
 */
class AudioRouteMonitorService {
  private static instance: AudioRouteMonitorService;
  
  static getInstance() {
    if (!this.instance) this.instance = new AudioRouteMonitorService();
    return this.instance;
  }

  async startMonitoring() {
    if (Platform.OS === 'web') return;

    // Monitor via TrackPlayer noisy events
    // We already have handleAudioBecomingNoisy in DeviceStateService.
    
    // In a production app, we would use a native bridge to AudioManager on Android
    // to detect exact device names and codecs (LDAC, aptX, etc.)
    this.refreshRoute();
  }

  async refreshRoute() {
    const deviceStore = useDeviceStateStore.getState();
    
    // Default assumption
    let route: AudioRoute = 'speaker';
    let deviceName: string | null = null;
    let codec: string | null = null;

    if (Platform.OS === 'android') {
      // Mock detection for simulation
      // In real code, we'd call a native method here.
    }

    deviceStore.setAudioRoute(route, deviceName, codec);
    
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.info('[AUDIO ROUTE]', {
        Output: route.toUpperCase(),
        Device: deviceName || 'System',
        Codec: codec || 'N/A',
        Timestamp: new Date().toLocaleTimeString()
      });
    }
  }
}

export const audioRouteMonitor = AudioRouteMonitorService.getInstance();
