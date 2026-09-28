import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { SecureTokenStorage, SpotifyAuthTokens } from './secure-token-storage';

export const SPOTIFY_REDIRECT_URI = 'auramusic://auth/spotify';
export const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

/**
 * Spotify Client ID configuration.
 * Checked strictly from EXPO_PUBLIC_SPOTIFY_CLIENT_ID or global configuration.
 * NEVER requires end-user input or insecure persistence.
 */
export function getSpotifyClientId(): string | null {
  const envId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
  if (envId && envId.trim()) {
    return envId.trim();
  }
  return 'badaaeb4665448c1b272ade8b80e2da7';
}

export interface AuthResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

export class SpotifyAuthService {
  /**
   * Generates a cryptographically random PKCE code verifier (64 chars, RFC 7636 unreserved)
   */
  private static async generateCodeVerifier(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomBytes = await Crypto.getRandomBytesAsync(64);
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Generates a SHA-256 base64url-encoded code challenge from the verifier
   */
  private static async generateCodeChallenge(verifier: string): Promise<string> {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    return digest
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Generates a random alphanumeric state string for CSRF mitigation
   */
  private static async generateState(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Verifies that the crypto subsystem accurately computes RFC 7636 test vectors
   */
  static async runSelfTest(): Promise<boolean> {
    try {
      const testVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const testChallenge = await this.generateCodeChallenge(testVerifier);
      const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const matches = testChallenge === expected;
      console.log('[SpotifyAuth] RFC 7636 Appendix B test vector:', matches ? 'PASS' : 'FAIL', {
        calculated: testChallenge,
        expected,
      });
      return matches;
    } catch (e) {
      console.error('[SpotifyAuth] RFC 7636 self-test error:', e);
      return false;
    }
  }

  private static inFlightExchanges = new Map<string, Promise<AuthResult>>();
  private static pendingSessions = new Map<
    string,
    {
      state: string;
      codeVerifier: string;
      clientId: string;
      resolveSession?: (result: AuthResult) => void;
    }
  >();

  /**
   * Safe, standalone extractor for query parameters that never fails on custom URL schemes
   */
  static extractQueryParams(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    if (!url) return params;

    try {
      const qIdx = url.indexOf('?');
      if (qIdx !== -1) {
        const queryString = url.slice(qIdx + 1).split('#')[0];
        const pairs = queryString.split('&');
        for (const pair of pairs) {
          if (!pair) continue;
          const eqIdx = pair.indexOf('=');
          if (eqIdx !== -1) {
            const key = decodeURIComponent(pair.slice(0, eqIdx));
            const val = decodeURIComponent(pair.slice(eqIdx + 1));
            params[key] = val;
          } else {
            params[decodeURIComponent(pair)] = '';
          }
        }
      }
    } catch (e) {
      console.warn('[SpotifyAuth] Error extracting query params:', e);
    }
    return params;
  }

  /**
   * Completes OAuth token exchange from deep link or browser redirect
   */
  static async handleAuthRedirect(urlOrCode: string, stateParam?: string): Promise<AuthResult> {
    try {
      let rawCode = typeof urlOrCode === 'string' ? urlOrCode : '';
      let rawState = typeof stateParam === 'string' ? stateParam : undefined;

      if (rawCode.includes('?') || rawCode.includes('://')) {
        const params = this.extractQueryParams(rawCode);
        if (params.error) {
          const desc = params.error_description || params.error;
          const errorMsg = desc === 'access_denied' ? 'Authorization was denied.' : desc;
          const stateKey = params.state || rawState;
          if (stateKey && this.pendingSessions.has(stateKey)) {
            this.pendingSessions.get(stateKey)?.resolveSession?.({ success: false, error: errorMsg });
            this.pendingSessions.delete(stateKey);
          }
          return { success: false, error: errorMsg };
        }
        rawCode = params.code || '';
        rawState = params.state || rawState;
      }

      const cleanCode = rawCode.trim();
      const cleanState = rawState?.trim();

      if (!cleanCode) {
        return {
          success: false,
          error: 'Missing authorization code from Spotify.',
        };
      }

      // SYNCHRONOUS MUTEX: If an exchange for this exact code is already in flight, return that promise directly!
      if (this.inFlightExchanges.has(cleanCode)) {
        console.log('[SpotifyAuth] Awaiting existing in-flight exchange for code:', cleanCode.slice(0, 8));
        return await this.inFlightExchanges.get(cleanCode)!;
      }

      // Immediately register the promise synchronously before ANY await!
      const exchangeTask = (async (): Promise<AuthResult> => {
        try {
          if (await this.isAuthenticated()) {
            return { success: true };
          }

          let codeVerifier: string | undefined;
          let clientId = getSpotifyClientId() || '';
          let matchedSession = cleanState ? this.pendingSessions.get(cleanState) : undefined;

          if (matchedSession) {
            codeVerifier = matchedSession.codeVerifier;
            clientId = matchedSession.clientId || clientId;
            console.log('[SpotifyAuth] Matched pending session in memory by state:', cleanState);
          }

          // Check persistent storage (AsyncStorage + SecureStore) by state
          if (!codeVerifier) {
            const persisted = await SecureTokenStorage.getPendingVerifier(cleanState);
            if (persisted?.verifier) {
              codeVerifier = persisted.verifier;
              console.log('[SpotifyAuth] Matched pending verifier in storage for state:', cleanState);
            }
          }

          // If not matched, try single in-memory session if only 1 exists
          if (!codeVerifier && this.pendingSessions.size === 1) {
            const onlySession = Array.from(this.pendingSessions.values())[0];
            codeVerifier = onlySession.codeVerifier;
            clientId = onlySession.clientId || clientId;
            console.log('[SpotifyAuth] Fallback: using solitary in-memory session verifier');
          }

          // If still not found, fallback to latest persisted verifier
          if (!codeVerifier) {
            const latest = await SecureTokenStorage.getLatestPendingVerifier();
            if (latest?.verifier) {
              codeVerifier = latest.verifier;
              console.warn('[SpotifyAuth] State did not match any session; using latest persisted verifier');
            }
          }

          if (!clientId || !codeVerifier) {
            if (await this.isAuthenticated()) {
              return { success: true };
            }
            console.error('[SpotifyAuth] Unable to locate verifier for auth code exchange, state:', cleanState);
            return {
              success: false,
              error: 'Authentication session expired or unavailable.',
            };
          }

          const tokenResult = await this.exchangeCodeForTokens(clientId, cleanCode, codeVerifier);

          // Always resolve any waiting sessionPromise (success or error)
          matchedSession?.resolveSession?.(tokenResult);
          if (cleanState) {
            this.pendingSessions.delete(cleanState);
          }

          if (tokenResult.success) {
            await SecureTokenStorage.clearPendingVerifier(cleanState);
          }

          return tokenResult;
        } catch (err: any) {
          console.error('[SpotifyAuth] handleAuthRedirect task error:', err);
          return {
            success: false,
            error: err?.message || 'Failed to complete Spotify authorization.',
          };
        }
      })();

      this.inFlightExchanges.set(cleanCode, exchangeTask);

      try {
        return await exchangeTask;
      } finally {
        this.inFlightExchanges.delete(cleanCode);
      }
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to complete Spotify authorization.',
      };
    }
  }

  /**
   * Initiates Authorization Code + PKCE OAuth flow
   */
  static async authenticate(): Promise<AuthResult> {
    const clientId = getSpotifyClientId();
    if (!clientId) {
      return {
        success: false,
        error:
          'Spotify integration is pending configuration. EXPO_PUBLIC_SPOTIFY_CLIENT_ID must be configured in environment.',
      };
    }

    try {
      console.log('[SpotifyAuth] Starting authorization session with PKCE');
      await this.runSelfTest();

      const codeVerifier = await this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      const state = await this.generateState();

      console.log('[SpotifyAuth] Created PKCE credentials:', {
        state,
        verifierLength: codeVerifier.length,
        verifierPreview: codeVerifier.slice(0, 6) + '...' + codeVerifier.slice(-6),
        challenge: codeChallenge,
      });

      // Persist verifier to dual storage (AsyncStorage + SecureStore)
      await SecureTokenStorage.savePendingVerifier(codeVerifier, state);

      let resolveSession: ((result: AuthResult) => void) | undefined;
      const sessionPromise = new Promise<AuthResult>((resolve) => {
        resolveSession = resolve;
      });

      this.pendingSessions.set(state, {
        state,
        codeVerifier,
        clientId: clientId.trim(),
        resolveSession,
      });

      const params = new URLSearchParams({
        client_id: clientId.trim(),
        response_type: 'code',
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        state,
        scope: SPOTIFY_SCOPES,
      });

      // Spotify OAuth requires %20 for space separation in scope, URLSearchParams defaults to '+'
      const authUrl = `${SPOTIFY_AUTH_ENDPOINT}?${params.toString().replace(/\+/g, '%20')}`;

      // Open browser session in parallel with deep link listener
      const browserPromise = WebBrowser.openAuthSessionAsync(
        authUrl,
        SPOTIFY_REDIRECT_URI
      ).then(async (browserResult) => {
        if (browserResult.type === 'success' && browserResult.url) {
          return await this.handleAuthRedirect(browserResult.url);
        }
        // Browser was dismissed/closed, which commonly happens when Android dispatches the deep link
        // Allow a grace window for the deep link route to exchange the token
        await new Promise((r) => setTimeout(r, 2000));
        if (await this.isAuthenticated()) {
          return { success: true };
        }
        return { success: false, cancelled: true };
      });

      const finalResult = await Promise.race([sessionPromise, browserPromise]);
      return finalResult;
    } catch (err: any) {
      console.warn('[SpotifyAuth] Authentication error:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'Network failure during authorization.',
      };
    }
  }

  /**
   * Exchanges authorization code for tokens using PKCE (NO CLIENT SECRET)
   */
  private static async exchangeCodeForTokens(
    clientId: string,
    code: string,
    codeVerifier: string
  ): Promise<AuthResult> {
    try {
      console.log('[SpotifyAuth] Exchanging code for tokens:', {
        clientId,
        codeLength: code.length,
        verifierLength: codeVerifier.length,
        verifierPreview: codeVerifier.slice(0, 6) + '...' + codeVerifier.slice(-6),
      });

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code.trim(),
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: clientId.trim(),
        code_verifier: codeVerifier.trim(),
      });

      const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[SpotifyAuth] Token exchange failed with status', response.status, 'body:', errText);
        let errorDetail = `Spotify token exchange failed (${response.status})`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error_description) {
            errorDetail = parsed.error_description;
          } else if (parsed.error) {
            errorDetail = parsed.error;
          }
        } catch {
          if (errText) errorDetail = errText;
        }
        return {
          success: false,
          error: errorDetail,
        };
      }

      const data = await response.json();
      const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

      await SecureTokenStorage.saveSpotifyTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        scope: data.scope,
      });

      console.log('[SpotifyAuth] Token exchange successful, stored securely in Keystore');
      return { success: true };
    } catch (err: any) {
      console.error('[SpotifyAuth] Network error exchanging code:', err);
      return {
        success: false,
        error: err?.message || 'Failed to exchange authorization code.',
      };
    }
  }

  /**
   * Refreshes the access token using the stored refresh token
   */
  static async refreshAccessToken(): Promise<boolean> {
    const clientId = getSpotifyClientId();
    if (!clientId) return false;

    const tokens = await SecureTokenStorage.getSpotifyTokens();
    if (!tokens?.refreshToken) return false;

    try {
      if (__DEV__) {
        console.log('[SpotifyAuth] Refreshing Spotify access token');
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: clientId,
      });

      const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        if (__DEV__) {
          console.warn('[SpotifyAuth] Token refresh failed with status', response.status);
        }
        return false;
      }

      const data = await response.json();
      const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

      await SecureTokenStorage.saveSpotifyTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || tokens.refreshToken, // Spotify may or may not return a new refresh token
        expiresAt,
        scope: data.scope || tokens.scope,
      });

      return true;
    } catch (err) {
      if (__DEV__) {
        console.warn('[SpotifyAuth] Token refresh network error');
      }
      return false;
    }
  }

  /**
   * Returns a valid access token, auto-refreshing if within 60s of expiration
   */
  static async getValidAccessToken(): Promise<string | null> {
    const tokens = await SecureTokenStorage.getSpotifyTokens();
    if (!tokens) return null;

    // Safety margin: 60 seconds before expiration
    const isExpiredOrExpiringSoon = Date.now() > tokens.expiresAt - 60_000;

    if (isExpiredOrExpiringSoon) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        return null;
      }
      const updated = await SecureTokenStorage.getSpotifyTokens();
      return updated?.accessToken || null;
    }

    return tokens.accessToken;
  }

  /**
   * Clears session from secure storage (Disconnect)
   */
  static async clearSession(): Promise<void> {
    await SecureTokenStorage.clearSpotifyTokens();
    if (__DEV__) {
      console.log('[SpotifyAuth] Cleared Spotify tokens from secure storage');
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
