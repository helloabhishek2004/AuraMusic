import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function usePlaybackInsets() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const isTabScreen = segments[0] === '(tabs)';
  const miniPlayerHeight = 68;
  const extraSpace = 24;

  const tabOffset = isTabScreen
    ? Math.max(insets.bottom + 14, 24) + 80
    : Math.max(insets.bottom + 8, 12);

  return {
    bottomPadding: tabOffset + miniPlayerHeight + extraSpace,
    bottomOffset: tabOffset,
  };
}
