import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export function useResponsiveMetrics() {
  const { width, height, fontScale } = useWindowDimensions();

  return useMemo(() => {
    const isLandscape = width > height;
    const isSmallPhone = Math.min(width, height) < 380 || height < 700;
    const isTablet = Math.min(width, height) >= 720;
    const isFoldable = !isTablet && Math.max(width, height) >= 760 && Math.min(width, height) >= 540;
    const horizontalPadding = isTablet ? 34 : isFoldable ? 28 : isSmallPhone ? 18 : 22;
    const contentMaxWidth = isTablet ? 920 : isLandscape ? 760 : width;
    const contentWidth = Math.min(width - horizontalPadding * 2, contentMaxWidth);
    const navWidth = Math.min(width - 32, isTablet ? 620 : isLandscape ? 560 : width - 32);

    return {
      width,
      height,
      fontScale,
      isLandscape,
      isSmallPhone,
      isTablet,
      isFoldable,
      horizontalPadding,
      contentMaxWidth,
      contentWidth,
      navWidth,
      density: isTablet ? 'comfortable' : isSmallPhone ? 'compact' : 'standard',
    };
  }, [fontScale, height, width]);
}

export const minimumHitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
