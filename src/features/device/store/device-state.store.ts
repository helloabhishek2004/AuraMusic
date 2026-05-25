import { create } from 'zustand';

export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';
export type AudioRoute = 'speaker' | 'headphones' | 'bluetooth' | 'other' | 'unknown';

interface DeviceState {
  connectionType: ConnectionType;
  isWifi: boolean;
  isCellular: boolean;
  audioRoute: AudioRoute;
  deviceName: string | null;
  bluetoothCodec: string | null;
  
  // Actions
  setConnection: (type: ConnectionType) => void;
  setAudioRoute: (route: AudioRoute, deviceName?: string | null, codec?: string | null) => void;
}

export const useDeviceStateStore = create<DeviceState>((set) => ({
  connectionType: 'unknown',
  isWifi: false,
  isCellular: false,
  audioRoute: 'unknown',
  deviceName: null,
  bluetoothCodec: null,

  setConnection: (type) => set({ 
    connectionType: type,
    isWifi: type === 'wifi',
    isCellular: type === 'cellular'
  }),
  
  setAudioRoute: (route, deviceName, codec) => set({ 
    audioRoute: route,
    deviceName: deviceName || null,
    bluetoothCodec: codec || null
  }),
}));
