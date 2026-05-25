const { withAppDelegate, withMainApplication, withHeaders, withSourceFilesAndroid } = require('@expo/config-plugins');

/**
 * AuraAudio Config Plugin
 * Injects native logic for App-Level Mono Audio downmixing.
 */
module.exports = function withAuraAudio(config) {
  // --- iOS AppDelegate Patch ---
  config = withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Add Mono Audio support to AVAudioSession on iOS
    if (!contents.includes('setPreferredOutputNumberOfChannels')) {
      const monoLogic = `
- (void)setAppMonoAudio:(BOOL)enabled {
    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSError *error = nil;
    if (enabled) {
        [session setPreferredOutputNumberOfChannels:1 error:&error];
    } else {
        [session setPreferredOutputNumberOfChannels:0 error:&error]; // 0 restores default
    }
}
      `;
      contents = contents.replace(
        '@end',
        `${monoLogic}\n@end`
      );
    }
    
    config.modResults.contents = contents;
    return config;
  });

  return config;
};
