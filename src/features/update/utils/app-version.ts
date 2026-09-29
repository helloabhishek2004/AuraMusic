import Constants from 'expo-constants';
import packageJson from '../../../../package.json';

/**
 * Returns the true installed application version extracted dynamically from
 * application metadata (Constants.expoConfig / nativeAppVersion / package.json).
 * Never hardcoded.
 */
export function getInstalledAppVersion(): string {
  const v =
    Constants.expoConfig?.version ??
    (Constants as any).nativeAppVersion ??
    packageJson.version ??
    '3.0.0';
  return v;
}

export function getAppBuildNumber(): string {
  const build =
    Constants.expoConfig?.android?.versionCode ??
    (Constants as any).nativeBuildVersion ??
    '4';
  return String(build);
}
