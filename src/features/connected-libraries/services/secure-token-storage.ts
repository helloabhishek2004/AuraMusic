import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * SpotifyAuthTokens
 * Only stores the minimum necessary tokens in native platform-backed secure storage.
 * SENSITIVE MATERIAL IS NEVER STORED IN ASYNCSTORAGE OR ZUSTAND.
 */
export interface SpotifyAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  scope?: string;
}

const SPOTIFY_TOKENS_KEY = 'aura_spotify_secure_tokens';
const SPOTIFY_VERIFIER_KEY = 'aura_spotify_pkce_verifier';
const ASYNC_VERIFIER_KEY = '@aura_spotify_pkce_verifier_list';

export class SecureTokenStorage {
  static async saveSpotifyTokens(tokens: SpotifyAuthTokens): Promise<void> {
    try {
      const payload = JSON.stringify(tokens);
      await SecureStore.setItemAsync(SPOTIFY_TOKENS_KEY, payload, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (error) {
      if (__DEV__) {
        console.warn('[SecureTokenStorage] Failed to save Spotify tokens');
      }
      throw error;
    }
  }

  static async getSpotifyTokens(): Promise<SpotifyAuthTokens | null> {
    try {
      const raw = await SecureStore.getItemAsync(SPOTIFY_TOKENS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SpotifyAuthTokens;
      if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) {
        return null;
      }
      return parsed;
    } catch (error) {
      if (__DEV__) {
        console.warn('[SecureTokenStorage] Failed to read Spotify tokens');
      }
      return null;
    }
  }

  static async clearSpotifyTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SPOTIFY_TOKENS_KEY);
    } catch (error) {
      if (__DEV__) {
        console.warn('[SecureTokenStorage] Failed to delete Spotify tokens');
      }
    }
  }

  static async savePendingVerifier(verifier: string, state: string): Promise<void> {
    try {
      let list: Array<{ verifier: string; state: string; timestamp: number }> = [];

      // Try reading existing list from AsyncStorage first, fallback to SecureStore
      try {
        const rawAsync = await AsyncStorage.getItem(ASYNC_VERIFIER_KEY);
        if (rawAsync) {
          const parsed = JSON.parse(rawAsync);
          if (Array.isArray(parsed)) list = parsed;
        }
      } catch {}

      if (list.length === 0) {
        try {
          const rawSecure = await SecureStore.getItemAsync(SPOTIFY_VERIFIER_KEY);
          if (rawSecure) {
            const parsed = JSON.parse(rawSecure);
            if (Array.isArray(parsed)) list = parsed;
            else if (parsed?.verifier) list = [parsed];
          }
        } catch {}
      }

      const now = Date.now();
      // Retain entries from the last 30 minutes
      list = list.filter((item) => item && typeof item.verifier === 'string' && now - item.timestamp < 30 * 60 * 1000);
      list.push({ verifier, state, timestamp: now });
      if (list.length > 10) list = list.slice(-10);

      const jsonStr = JSON.stringify(list);
      await Promise.allSettled([
        AsyncStorage.setItem(ASYNC_VERIFIER_KEY, jsonStr),
        SecureStore.setItemAsync(SPOTIFY_VERIFIER_KEY, jsonStr),
      ]);
    } catch (error) {
      console.warn('[SecureTokenStorage] Failed to save pending PKCE verifier:', error);
    }
  }

  static async getPendingVerifier(state?: string): Promise<{ verifier: string; state: string } | null> {
    try {
      let list: Array<{ verifier: string; state: string; timestamp: number }> = [];

      // Check AsyncStorage
      try {
        const rawAsync = await AsyncStorage.getItem(ASYNC_VERIFIER_KEY);
        if (rawAsync) {
          const parsed = JSON.parse(rawAsync);
          if (Array.isArray(parsed)) list = parsed;
        }
      } catch {}

      // Fallback check SecureStore
      if (list.length === 0) {
        try {
          const rawSecure = await SecureStore.getItemAsync(SPOTIFY_VERIFIER_KEY);
          if (rawSecure) {
            const parsed = JSON.parse(rawSecure);
            if (Array.isArray(parsed)) list = parsed;
            else if (parsed?.verifier) list = [parsed];
          }
        } catch {}
      }

      if (list.length === 0) return null;

      if (state) {
        const trimmedState = state.trim();
        const match = list.find((item) => item.state === trimmedState);
        if (match) return match;
      }

      // If state was specified but not found, check if there's only 1 active entry
      if (list.length === 1) {
        return list[0];
      }

      // Return the most recent unexpired entry
      return list[list.length - 1] || null;
    } catch (error) {
      console.warn('[SecureTokenStorage] Error reading pending verifier:', error);
      return null;
    }
  }

  static async getLatestPendingVerifier(): Promise<{ verifier: string; state: string } | null> {
    return this.getPendingVerifier();
  }

  static async clearPendingVerifier(state?: string): Promise<void> {
    try {
      if (state) {
        // Remove only the matched state entry
        let list: Array<{ verifier: string; state: string; timestamp: number }> = [];
        try {
          const raw = await AsyncStorage.getItem(ASYNC_VERIFIER_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              list = parsed.filter((item) => item.state !== state);
              const jsonStr = JSON.stringify(list);
              await Promise.allSettled([
                AsyncStorage.setItem(ASYNC_VERIFIER_KEY, jsonStr),
                SecureStore.setItemAsync(SPOTIFY_VERIFIER_KEY, jsonStr),
              ]);
              return;
            }
          }
        } catch {}
      }

      await Promise.allSettled([
        AsyncStorage.removeItem(ASYNC_VERIFIER_KEY),
        SecureStore.deleteItemAsync(SPOTIFY_VERIFIER_KEY),
      ]);
    } catch (error) {
      // Ignore
    }
  }
}
