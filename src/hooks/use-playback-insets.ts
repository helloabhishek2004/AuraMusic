import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomOffset } from '../constants/navigation';

export function usePlaybackInsets() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const isTabScreen = segments[0] === '(tabs)';
  const miniPlayerHeight = 68;
  const extraSpace = 24;

  const tabOffset = getBottomOffset(isTabScreen, insets);

  return {
    bottomPadding: tabOffset + miniPlayerHeight + extraSpace,
    bottomOffset: tabOffset,
  };
}
