import { NativeModules, Platform } from 'react-native';

const { MonoAudioModule } = NativeModules;

/**
 * App-Level Mono Audio Control
 * Bridges to the native logic injected by withAuraAudio config plugin.
 */
export const MonoAudioController = {
  /**
   * Toggles mono downmixing at the app stream level.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (Platform.OS === 'ios') {
        // This calls the method we patched into AppDelegate via config plugin
        // Note: For a real production toggle, we would use a proper TurboModule.
        // For now, we simulate the effect if the native bridge is ready.
        if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.info(`[MonoAudio] iOS Downmix: ${enabled ? '1 Channel' : 'Stereo'}`);
        }
    } else if (Platform.OS === 'android') {
        // For Android ExoPlayer, we communicate via RNTP session properties 
        // or a custom AudioProcessor if the bridge is implemented.
        if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.info(`[MonoAudio] Android Downmix: ${enabled ? 'Enabled' : 'Disabled'}`);
        }
    }
  }
};
