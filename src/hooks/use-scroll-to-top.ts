import { useNavigation } from 'expo-router';
import { useEffect } from 'react';

/**
 * Reusable hook to handle scroll to top when the active tab is pressed again.
 * Listens to the 'tabPress' event from the navigation controller.
 * 
 * Supports ScrollView, FlatList, FlashList, and other scrollable references.
 */
export function useScrollToTopOnTabPress(ref: React.RefObject<any>) {
  const navigation = useNavigation();

  useEffect(() => {
    if (!navigation) return;

    const handleTabPress = (e: any) => {
      // Check if the current screen is focused (active tab)
      const isFocused = navigation.isFocused();
      
      if (isFocused && ref.current) {
        // Run scroll to top with custom smooth physics
        if (typeof ref.current.scrollToOffset === 'function') {
          ref.current.scrollToOffset({ offset: 0, animated: true });
        } else if (typeof ref.current.scrollTo === 'function') {
          ref.current.scrollTo({ y: 0, animated: true });
        }
      }
    };

    // Listen on the current screen's navigation
    const unsubscribeCurrent = navigation.addListener('tabPress' as any, handleTabPress);

    // Also listen on the parent navigator (e.g. Tab Navigator) if nested inside a stack
    let unsubscribeParent: (() => void) | undefined;
    const parent = navigation.getParent();
    if (parent) {
      unsubscribeParent = parent.addListener('tabPress' as any, handleTabPress);
    }

    return () => {
      unsubscribeCurrent();
      if (unsubscribeParent) {
        unsubscribeParent();
      }
    };
  }, [navigation, ref]);
}
