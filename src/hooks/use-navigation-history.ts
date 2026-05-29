import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { BackHandler } from 'react-native';

type NavigationEntry = {
  pathname: string;
  timestamp: number;
  fromTab?: string;
};

const MAX_HISTORY = 15;

export function useSmartBackNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const historyRef = useRef<NavigationEntry[]>([]);
  const lastPathRef = useRef<string>('');
  const isNavigatingRef = useRef<boolean>(false);

  // Track navigation to avoid duplicates
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    const currentPath = pathname;
    if (currentPath !== lastPathRef.current) {
      lastPathRef.current = currentPath;
      
      // Detect if coming from a tab
      const isFromTab = segments[0] === '(tabs)';
      const currentTab = isFromTab ? segments[1] : null;
      
      // If we're returning to a tab root, don't add duplicate entries
      const lastEntry = historyRef.current[historyRef.current.length - 1];
      const isTabRoot = isFromTab && (segments.length === 1 || segments[1] === 'index' || segments[1] === '(index)');
      
      // Don't create duplicate entries for tab navigation
      if (lastEntry && lastEntry.pathname === currentPath) {
        return;
      }
      
      // If going to a tab root from a sub-page, keep the history but mark tab origin
      if (isTabRoot && historyRef.current.length > 1) {
        const prevFromTab = historyRef.current[historyRef.current.length - 2]?.fromTab;
        if (prevFromTab && prevFromTab === currentTab) {
          // Clean up history to avoid stacking duplicates
          const tabIndex = historyRef.current.findIndex(h => h.fromTab === currentTab);
          if (tabIndex !== -1) {
            historyRef.current = historyRef.current.slice(tabIndex);
          }
        }
      }

      historyRef.current.push({ 
        pathname: currentPath, 
        timestamp: Date.now(),
        fromTab: isFromTab ? currentTab || undefined : undefined
      });
      
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current = historyRef.current.slice(-MAX_HISTORY);
      }
    }
  }, [pathname, segments]);

  // Mark navigation start to prevent history duplication
  const markNavigation = useCallback(() => {
    isNavigatingRef.current = true;
  }, []);

  const handleBack = useCallback(() => {
    const isTabScreen = segments[0] === '(tabs)';
    const isTabRoot = isTabScreen && (segments.length === 1 || segments[1] === 'index' || segments[1] === '(index)');
    const isNowPlaying = pathname === '/now_playing';
    const isSpecialPage = ['/artist/', '/album/', '/playlist/', '/downloads/', '/local_library/', '/create_playlist/'].some(p => pathname.startsWith(p));

    // 2. Now Playing -> Go back to previous page (not tab root)
    if (isNowPlaying) {
      const history = historyRef.current;
      if (history.length >= 2) {
        const prev = history[history.length - 2];
        // If previous was a detail page, go back normally
        if (prev.pathname.includes('artist') || prev.pathname.includes('album') || prev.pathname.includes('playlist')) {
          router.back();
          return true;
        }
        // If previous is a tab, don't exit app, just go back to that tab
        if (prev.pathname.startsWith('/(tabs)')) {
          router.back();
          return true;
        }
      }
      // Default: go back normally
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    }

    // 3. Nested subpages -> Return to parent route
    if (isSpecialPage && isTabScreen) {
      router.back();
      return true;
    }

    // 4. Tab root -> Exit app only from Home tab
    if (isTabRoot) {
      const currentTab = segments[1] || 'index';
      // Only exit from Home tab
      if (currentTab === 'index' || currentTab === '(index)') {
        return false; // Allow default behavior (exit app)
      }
      // For other tabs, go to home instead of exiting
      router.push('/(tabs)');
      return true;
    }

    // 5. Default: use native back
    if (router.canGoBack()) {
      router.back();
      return true;
    }

    return false;
  }, [pathname, segments, router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backHandler.remove();
  }, [handleBack]);

  return { 
    history: historyRef.current,
    markNavigation 
  };
}