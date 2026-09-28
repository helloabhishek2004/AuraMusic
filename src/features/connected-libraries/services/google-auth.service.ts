import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

/**
 * Google Web Client ID configuration.
 * Read strictly from EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in environment.
 * NEVER requires end-user manual configuration or insecure persistence.
 */
export function getGoogleWebClientId(): string | null {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '304304144156-i3tgl5dpjs02gbuoghcl653l6np89oc5.apps.googleusercontent.com'
  );
}

export interface GoogleAuthResult {
  success: boolean;
  cancelled?: boolean;
  accountName?: string;
  error?: string;
}

export class GoogleAuthService {
  private static isConfigured = false;

  /**
   * Initializes GoogleSignin with required YouTube scopes and Web Client ID
   */
  static configure(): void {
    if (this.isConfigured) return;

    const webClientId = getGoogleWebClientId();
    GoogleSignin.configure({
      webClientId: webClientId || undefined,
      scopes: [YOUTUBE_READONLY_SCOPE],
      offlineAccess: false,
    });

    this.isConfigured = true;
  }

  /**
   * Verifies Google Play Services availability
   */
  static async hasPlayServices(): Promise<boolean> {
    try {
      return await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[GoogleAuth] Google Play Services check failed:', err?.message || err);
      }
      return false;
    }
  }

  /**
   * Initiates native Google Sign-In with Play Services dialog
   */
  static async signIn(): Promise<GoogleAuthResult> {
    this.configure();

    const playServicesOk = await this.hasPlayServices();
    if (!playServicesOk) {
      return {
        success: false,
        error: 'Google Play Services is not available or outdated on this device.',
      };
    }

    try {
      const response = await GoogleSignin.signIn();

      if (response.type === 'cancelled') {
        if (__DEV__) {
          console.log('[GoogleAuth] User cancelled Google sign-in dialog');
        }
        return { success: false, cancelled: true };
      }

      const user = response.data?.user;
      const accountName = user?.name || user?.email || 'YouTube User';

      // Retrieve tokens to verify authorization
      const tokens = await GoogleSignin.getTokens();
      if (!tokens?.accessToken) {
        return {
          success: false,
          error: 'Failed to retrieve access token from Google Play Services.',
        };
      }

      // Verify the youtube.readonly scope was actually granted by the user
      const isScopeGranted = await this.verifyYouTubeScope(tokens.accessToken);
      if (!isScopeGranted) {
        if (__DEV__) {
          console.warn('[GoogleAuth] youtube.readonly scope was not granted by the user');
        }
        return {
          success: false,
          error:
            'YouTube permission (youtube.readonly) was not granted. Please allow access to your YouTube library.',
        };
      }

      if (__DEV__) {
        console.log('[GoogleAuth] Successfully authenticated and verified youtube.readonly permission');
      }

      return {
        success: true,
        accountName,
      };
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        if (__DEV__) {
          console.log('[GoogleAuth] Sign in cancelled by user');
        }
        return { success: false, cancelled: true };
      }

      if (err.code === statusCodes.IN_PROGRESS) {
        return {
          success: false,
          error: 'Google Sign-In is already in progress.',
        };
      }

      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          success: false,
          error: 'Google Play Services is not available on this device.',
        };
      }

      if (__DEV__) {
        console.warn('[GoogleAuth] Native Sign-in error:', err?.message || err);
      }
      return {
        success: false,
        error: err?.message || 'Google authorization failed.',
      };
    }
  }

  /**
   * Authoritatively verifies that the required youtube.readonly scope is granted
   * by issuing a lightweight probe request to the YouTube Data API.
   */
  private static async verifyYouTubeScope(accessToken: string): Promise<boolean> {
    try {
      const probeUrl = 'https://www.googleapis.com/youtube/v3/playlists?part=id&mine=true&maxResults=1';
      const res = await fetch(probeUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (res.status === 403) {
        return false;
      }

      return res.ok;
    } catch (err) {
      if (__DEV__) {
        console.warn('[GoogleAuth] Scope verification network probe failed:', err);
      }
      return false;
    }
  }

  /**
   * Retrieves a valid access token directly from Google Play Services.
   * NO TOKENS ARE EVER STORED IN ZUSTAND OR ASYNCSTORAGE.
   */
  static async getValidAccessToken(): Promise<string | null> {
    this.configure();

    try {
      const tokens = await GoogleSignin.getTokens();
      return tokens?.accessToken || null;
    } catch (err) {
      // If no active session, attempt silent sign in first
      try {
        const silent = await GoogleSignin.signInSilently();
        if (silent.type === 'success') {
          const freshTokens = await GoogleSignin.getTokens();
          return freshTokens?.accessToken || null;
        }
      } catch (_silentErr) {
        // Expected when no active session exists
      }
      return null;
    }
  }

  /**
   * Invalidates a stale access token in Android's native cache upon 401 Unauthorized
   */
  static async clearCachedAccessToken(staleToken: string): Promise<void> {
    try {
      await GoogleSignin.clearCachedAccessToken(staleToken);
      if (__DEV__) {
        console.log('[GoogleAuth] Cleared stale access token from Android Play Services cache');
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[GoogleAuth] Failed to clear cached access token:', err);
      }
    }
  }

  /**
   * Signs out from Google Play Services without revoking user's Google Cloud consent grant.
   */
  static async signOut(): Promise<void> {
    this.configure();
    try {
      await GoogleSignin.signOut();
      if (__DEV__) {
        console.log('[GoogleAuth] Signed out from Google Play Services');
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[GoogleAuth] Error signing out from Google:', err);
      }
    }
  }

  /**
   * Checks if an authenticated session exists
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }
}
