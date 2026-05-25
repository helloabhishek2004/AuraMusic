import { NativeModules, Platform } from 'react-native';

const { AuraAudioSession } = NativeModules;

export interface EQResult {
  success: boolean;
  type: 'session_eq' | 'oem_eq' | 'sound_settings' | 'unavailable';
  packageName?: string;
  sessionId?: number;
}

/**
 * Android Audio Session & Equalizer Management
 */
export const AudioSessionController = {
  /**
   * Retrieves the active audio session ID from the native player.
   */
  async getAudioSessionId(): Promise<number> {
    if (Platform.OS !== 'android') return -1;
    try {
      return await AuraAudioSession.getAudioSessionId();
    } catch (e) {
      console.error('[AudioSession] Failed to get session ID:', e);
      return -1;
    }
  },

  /**
   * Opens the system equalizer and attaches it to the current playback session.
   */
  async openEqualizer(): Promise<EQResult> {
    if (Platform.OS !== 'android') {
      return { success: false, type: 'unavailable' };
    }

    try {
      const result: EQResult = await AuraAudioSession.openSystemEqualizer();
      
      if (result.success) {
        if (result.type === 'session_eq') {
          console.info(`[AuraEQ] Opened session-linked equalizer. Session: ${result.sessionId}`);
        } else if (result.type === 'oem_eq') {
          console.info(`[AuraEQ] Opened OEM equalizer: ${result.packageName}`);
        } else {
          console.info('[AuraEQ] Opened system sound settings');
        }
      } else {
        console.warn('[AuraEQ] No supported equalizer available');
      }

      return result;
    } catch (e) {
      console.error('[AuraEQ] Failed to launch equalizer:', e);
      return { success: false, type: 'unavailable' };
    }
  }
};
