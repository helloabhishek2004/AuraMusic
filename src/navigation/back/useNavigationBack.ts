/**
 * useNavigationBack — Navigation-level back handlers for the centralized system.
 */

import { useCallback, useRef, useEffect } from 'react';
import { ToastAndroid, Platform, BackHandler } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useBackHandler } from './useBackHandler';
import { BackPriority } from './back.types';

function isHomeRoot(path: string): boolean {
  return path === '/' || path === '/index' || path === '/(tabs)' || path === '/(tabs)/index';
}

function isOtherTabRoot(path: string): boolean {
  return (
    path === '/search' ||
    path === '/(tabs)/search' ||
    path === '/library' ||
    path === '/(tabs)/library' ||
    path === '/settings' ||
    path === '/(tabs)/settings'
  );
}

export function useNavigationBack(): void {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef<string>('/');
  const lastBackPressRef = useRef<number | null>(null);
  const lastPopTimeRef = useRef<number>(0);

  // Track pathname changes via usePathname, store in ref only
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const handler = useCallback(() => {
    const currentPath = pathnameRef.current || '/';

    // ── STEP 1: Historical Stack Pop ───────────────────────────────────────
    // If the navigation container has history, pop it. Never replace with Home.
    if (router.canGoBack()) {
      const now = Date.now();
      if (now - lastPopTimeRef.current < 250) {
        // Debounce rapid back taps to prevent double pops
        return true;
      }
      lastPopTimeRef.current = now;
      console.log(`[useNavigationBack] STEP 1: router.back() popped from ${currentPath}`);
      router.back();
      return true;
    }

    // ── STEP 2: Non-Home Tab Fallback ─────────────────────────────────────
    // If on a secondary tab (Search, Library, Settings) with empty tab history,
    // navigate back to the Home tab.
    if (isOtherTabRoot(currentPath)) {
      console.log(`[useNavigationBack] STEP 2: tab fallback from ${currentPath} to /(tabs)`);
      router.navigate('/(tabs)');
      return true;
    }

    // ── STEP 3: Deep-Link Orphan Fallback ─────────────────────────────────
    // If router.canGoBack() is false on a child detail screen (cold start deep link),
    // navigate to Home instead of terminating the application immediately.
    if (!isHomeRoot(currentPath)) {
      console.log(`[useNavigationBack] STEP 3: deep link fallback from ${currentPath} to /(tabs)`);
      router.replace('/(tabs)');
      return true;
    }

    // ── STEP 4: Application Root Exit Policy ──────────────────────────────
    // User is genuinely at the application Home root and no transient UI is active.
    // Double-back to exit within 2000ms window.
    const now = Date.now();
    if (lastBackPressRef.current !== null && now - lastBackPressRef.current < 2000) {
      console.log('[useNavigationBack] STEP 4: Double back -> exitApp()');
      lastBackPressRef.current = null;
      BackHandler.exitApp();
      return true;
    }

    console.log('[useNavigationBack] STEP 4: First back on root -> Toast');
    lastBackPressRef.current = now;
    if (Platform.OS === 'android') {
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
    }
    return true;
  }, [router]);

  useBackHandler({
    id: 'navigation-back-handler',
    enabled: true,
    priority: BackPriority.STACK_POP,
    onBack: handler,
  });
}
