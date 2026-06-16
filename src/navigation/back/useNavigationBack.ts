/**
 * useNavigationBack — Navigation-level back handlers for the centralized system.
 */

import { useCallback, useRef, useEffect } from 'react';
import { ToastAndroid, Platform, BackHandler } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useBackHandler } from './useBackHandler';
import { BackPriority } from './back.types';

export function useNavigationBack(): void {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef<string>('/');
  const lastBackPressRef = useRef<number | null>(null);

  // Track pathname changes via usePathname, store in ref only
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const handler = useCallback(() => {
    // Read everything fresh at press time, not from stale render-time state
    const currentPathname = router.canGoBack() 
      ? undefined 
      : pathnameRef.current; // read from ref, not state
    
    const isOnTabRoot = ['/search', '/library', '/settings', '/'].includes(currentPathname ?? '/');
    const isOnHomeRoot = currentPathname === '/' || currentPathname === '/index' || currentPathname === '/(tabs)' || currentPathname === '/(tabs)/index';
    
    // Priority 1: player sub-surface — handled by PlayerOverlay, skip here
    
    // Priority 2: tab fallback
    if (!isOnHomeRoot && isOnTabRoot) {
      router.replace('/');
      return true;
    }
    
    // Priority 3: stack pop
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    
    // Priority 4: double back to exit
    const now = Date.now();
    if (lastBackPressRef.current !== null && now - lastBackPressRef.current < 2000) {
      BackHandler.exitApp();
      return true;
    }
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
