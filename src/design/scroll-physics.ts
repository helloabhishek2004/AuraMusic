/**
 * AuraMusic Unified Scroll Physics
 * 
 * Centralized deceleration and momentum configuration for consistent feel.
 */

export const ScrollPhysics = {
  // iOS-style standard momentum
  STANDARD: {
    decelerationRate: 0.998 as const,
    scrollEventThrottle: 16,
    showsVerticalScrollIndicator: false,
    showsHorizontalScrollIndicator: false,
    removeClippedSubviews: true,
  },
  // Snappy for carousels or cards
  SNAPPY: {
    decelerationRate: 'fast' as const,
    snapToAlignment: 'start' as const,
    scrollEventThrottle: 16,
    showsHorizontalScrollIndicator: false,
  },
  // High friction for precise settings/pickers
  PICKER: {
    decelerationRate: 0.985 as const,
    scrollEventThrottle: 8,
  }
};
