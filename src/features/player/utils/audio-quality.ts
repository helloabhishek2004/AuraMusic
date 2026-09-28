import { useSettingsStore, AudioQuality } from '../../settings/store/settings.store';
import { useDeviceStateStore } from '../../device/store/device-state.store';

/**
 * Maps abstract quality levels to approximate bitrates or resolution hints.
 * Note: Actual mapping depends on the backend source (YTMusic, etc.)
 */
export const QUALITY_BITRATE_MAP = {
  low: '~96kbps',
  normal: '~128kbps',
  high: '~160kbps',
  best: 'original'
};

/**
 * Resolves the preferred audio quality based on user settings and current network state.
 */
export async function getPreferredStreamingQuality(): Promise<AudioQuality> {
  const settings = useSettingsStore.getState();
  const device = useDeviceStateStore.getState();

  const quality = device.isWifi ? settings.streamingQualityWifi : settings.streamingQualityCellular;

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info('[AUDIO QUALITY]', {
        Network: device.isWifi ? 'WIFI' : (device.isCellular ? 'CELLULAR' : 'OFFLINE'),
        Requested: quality.toUpperCase(),
        Resolved: QUALITY_BITRATE_MAP[quality],
        Timestamp: new Date().toLocaleTimeString()
    });
  }

  return quality;
}

/**
 * Resolves the preferred download quality based on user settings and current network state.
 */
export async function getPreferredDownloadQuality(): Promise<AudioQuality> {
  const settings = useSettingsStore.getState();
  const device = useDeviceStateStore.getState();

  return device.isWifi ? settings.downloadQualityWifi : settings.downloadQualityCellular;
}

/**
 * Checks if downloading is allowed based on wifi-only settings.
 */
export async function isDownloadAllowed(): Promise<boolean> {
  const settings = useSettingsStore.getState();
  if (!settings.downloadOnlyOnWifi) return true;

  const device = useDeviceStateStore.getState();
  
  const allowed = device.isWifi;
  
  if (!allowed && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn('[DOWNLOAD BLOCKED]', {
        Reason: 'Cellular Network (Wi-Fi Only enabled)',
        Timestamp: new Date().toLocaleTimeString()
    });
  }
  
  return allowed;
}

