import NetInfo from '@react-native-community/netinfo';
import * as Network from 'expo-network';
import { useDeviceStateStore, ConnectionType, AudioRoute } from '../store/device-state.store';
import { Platform } from 'react-native';

class DeviceStateService {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    NetInfo.addEventListener(state => {
      const prevType = useDeviceStateStore.getState().connectionType;
      let type: ConnectionType = 'unknown';
      if (!state.isConnected) type = 'none';
      else if (state.type === 'wifi') type = 'wifi';
      else if (state.type === 'cellular') type = 'cellular';
      
      if (prevType !== type) {
        useDeviceStateStore.getState().setConnection(type);
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.info(`[DeviceState] Connection changed: ${type}`);
        }
      }

      if (prevType === 'none' && type !== 'none') {
        import('../../player/services/queue-repair.service').then(({ QueueRepairService }) => {
          QueueRepairService.repairQueue().catch(err => console.error(err));
        }).catch(err => console.warn(err));
      }
    });

    // Initial network check
    const netState = await NetInfo.fetch();
    let initialType: ConnectionType = 'unknown';
    if (!netState.isConnected) initialType = 'none';
    else if (netState.type === 'wifi') initialType = 'wifi';
    else if (netState.type === 'cellular') initialType = 'cellular';
    useDeviceStateStore.getState().setConnection(initialType);

    // 2. Monitor Audio Route (Simplified for now)
    // In a real production app with custom native modules, we'd get real codec info.
    // For now we hook into TrackPlayer events via the store or service.
    this.detectInitialAudioRoute();
  }

  private async detectInitialAudioRoute() {
    // Basic detection logic
    // On Android, we can't easily get the codec without a custom bridge or specific library.
    // We'll set it to 'speaker' as default and let events update it.
    useDeviceStateStore.getState().setAudioRoute('speaker');
  }

  /**
   * Called by PlaybackService when RemoteDuck (becoming noisy) occurs
   */
  handleAudioBecomingNoisy() {
    // This usually means headphones were unplugged
    useDeviceStateStore.getState().setAudioRoute('speaker');
    if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.info('[DeviceState] Audio became noisy (Headphones unplugged)');
    }
  }

  /**
   * Mock method for codec detection (to be replaced with real bridge if available)
   */
  async refreshAudioRoute() {
    // Logic to detect if Bluetooth is connected
    // This is a placeholder for real hardware integration
    if (Platform.OS === 'android') {
        // Implementation would use AudioManager.getDevices(GET_DEVICES_OUTPUTS)
    }
  }
}

export const deviceStateService = new DeviceStateService();
