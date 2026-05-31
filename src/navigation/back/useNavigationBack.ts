/**
 * useNavigationBack — Navigation-level back handlers for the centralized system.
 *
 * Registers three handlers:
 *   1. STACK_POP (priority 200): Pop the navigation stack if possible
 *   2. TAB_FALLBACK (priority 100): Navigate to Home tab from other tab roots
 *   3. EXIT_APP (priority 0): Double-back-to-exit from Home tab
 *
 * This replaces the monolithic useSmartBackNavigation hook with discrete,
 * priority-aware handlers that cooperate with the player overlay handlers.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { ToastAndroid, Platform } from 'react-native';
import { useRouter, usePathname, useNavigationContainerRef } from 'expo-router';
import { useBackHandler } from './useBackHandler';
import { BackPriority } from './back.types';
import { usePlayerUIStore } from '@/src/features/player/store/player-ui.store';

export function useNavigationBack(): void {
  const router = useRouter();
  const pathname = usePathname();
  const playerSurface = usePlayerUIStore((s) => s.surface);
  const lastBackPressRef = useRef<number>(0);
  const navigationRef = useNavigationContainerRef();

  // Reactive state to track if the global navigator can go back
  const [obsCanGoBack, setObsCanGoBack] = useState(false);

  useEffect(() => {
    if (!navigationRef) return;

    const syncNavigationState = () => {
      const isReady = navigationRef.isReady?.() ?? false;
      const canGoBackVal = isReady ? (navigationRef.canGoBack?.() ?? false) : false;
      
      console.log('[NAV REF]', {
        isReady,
        canGoBack: canGoBackVal,
      });

      setObsCanGoBack(canGoBackVal);
    };

    // Initial check
    syncNavigationState();

    // Subscribe to state change events
    const unsubscribe = navigationRef.addListener('state', () => {
      console.log('[NAV REF] State listener fired');
      syncNavigationState();
    });

    return unsubscribe;
  }, [navigationRef]);

  // Derived state from pathname for tab-root detection
  // Expo Router paths for tabs
  const isSearchRoot = pathname === '/search';
  const isLibraryRoot = pathname === '/library';
  const isSettingsRoot = pathname === '/settings';
  const isHomeRoot = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
  
  const isAnyTabRoot = isHomeRoot || isSearchRoot || isLibraryRoot || isSettingsRoot;
  
  const canGoBack = obsCanGoBack;
  const isPlayerExpanded = playerSurface !== 'mini';

  const stackPopEnabled = canGoBack;
  const tabFallbackEnabled = isAnyTabRoot && !isHomeRoot && !canGoBack;
  const isExitAppEnabled = isHomeRoot && !canGoBack && !isPlayerExpanded;

  // Print exact [BACK STATE] logs for the audit
  useEffect(() => {
    console.log('[BACK STATE]', {
      pathname,
      canGoBack,
      stackPopEnabled,
      tabFallbackEnabled,
      exitAppEnabled: isExitAppEnabled,
    });
  }, [pathname, canGoBack, stackPopEnabled, tabFallbackEnabled, isExitAppEnabled]);

  const wasExitAppEnabled = useRef(false);

  // Log every time EXIT_APP becomes enabled or disabled
  useEffect(() => {
    if (isExitAppEnabled && !wasExitAppEnabled.current) {
      console.log('[useNavigationBack] EXIT_APP handler is now ENABLED');
    } else if (!isExitAppEnabled && wasExitAppEnabled.current) {
      console.log('[useNavigationBack] EXIT_APP handler is now DISABLED');
    }
    wasExitAppEnabled.current = isExitAppEnabled;
  }, [isExitAppEnabled]);

  // ── Handler 1: Stack Pop (priority 200) ──────────────────────────────
  // Primary source of truth: if navigator can go back, we pop the stack.
  const handleStackPop = useCallback(() => {
    console.log('[useNavigationBack] handleStackPop triggered');
    if (navigationRef.current?.canGoBack()) {
      console.log('[useNavigationBack] handleStackPop: executing navigationRef.current.goBack()');
      navigationRef.current.goBack();
      return true;
    }
    console.log('[useNavigationBack] handleStackPop: navigationRef.current?.canGoBack() returned false');
    return false;
  }, [navigationRef]);

  useBackHandler({
    id: 'navigation-stack-pop',
    enabled: stackPopEnabled,
    priority: BackPriority.STACK_POP,
    onBack: handleStackPop,
  });

  // ── Handler 2: Tab Fallback (priority 100) ───────────────────────────
  // When at a tab root that is NOT Home, jump to Home instead of exiting.
  const handleTabFallback = useCallback(() => {
    console.log('[useNavigationBack] handleTabFallback triggered: navigating to /(tabs)');
    router.navigate('/(tabs)');
    return true;
  }, [router]);

  useBackHandler({
    id: 'navigation-tab-fallback',
    enabled: tabFallbackEnabled,
    priority: BackPriority.TAB_FALLBACK,
    onBack: handleTabFallback,
  });

  // ── Handler 3: Exit App (priority 0) ─────────────────────────────────
  // Absolute final fallback. Double-back-to-exit.
  const handleExitApp = useCallback(() => {
    console.log('[useNavigationBack] EXIT_APP handler EXECUTING');
    const now = Date.now();
    const timeSinceLastPress = now - lastBackPressRef.current;

    if (timeSinceLastPress < 2000) {
      console.log('[useNavigationBack] EXIT_APP executing: double press detected within 2s, allowing exit');
      // Second press within 2 seconds — allow system exit
      return false;
    }

    console.log('[useNavigationBack] EXIT_APP executing: single press detected, preventing exit and showing Toast');
    // First press — show toast and prevent exit
    lastBackPressRef.current = now;
    if (Platform.OS === 'android') {
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
    }
    
    return true;
  }, []);

  useBackHandler({
    id: 'navigation-exit-app',
    // Must ONLY be enabled when it's safe to exit (no modals, no player surfaces, at home root, no history)
    enabled: isExitAppEnabled,
    priority: BackPriority.EXIT_APP,
    onBack: handleExitApp,
  });
}
