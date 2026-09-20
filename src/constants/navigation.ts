/**
 * Navigation layout constants — single source of truth for bottom navigation
 * inset calculations used by PlayerOverlay, MiniPlayer, and scrollable lists.
 *
 * Coordinates positioning for the floating pill navigation bar and MiniPlayer.
 */

import type { EdgeInsets } from 'react-native-safe-area-context';

/**
 * Physical height of the floating pill navigation bar and search circle button.
 */
export const FLOATING_BAR_HEIGHT = 64;

/**
 * Minimum bottom margin separating the floating bar from the screen bottom / home indicator.
 */
export const FLOATING_BAR_MIN_BOTTOM = 16;

/**
 * Breathing gap between the MiniPlayer's bottom edge and the floating navigation bar's top edge.
 */
export const MINI_PLAYER_TAB_GAP = 10;

/**
 * Computes the exact `bottom` style position for the floating navigation bar.
 */
export function getFloatingBarBottom(insets: EdgeInsets): number {
  return Math.max(insets.bottom, FLOATING_BAR_MIN_BOTTOM) + 10;
}

/**
 * Calculate the exact bottom offset for MiniPlayer and list padding.
 *
 * On tab screens: positions the MiniPlayer and list padding cleanly above the floating bar.
 * On stack screens: positions content above the system gesture / nav area.
 *
 * @param isTabScreen - whether the current screen is inside the (tabs) navigator
 * @param insets - safe area insets from react-native-safe-area-context
 */
export function getBottomOffset(isTabScreen: boolean, insets: EdgeInsets): number {
  if (isTabScreen) {
    const barBottom = getFloatingBarBottom(insets);
    return barBottom + FLOATING_BAR_HEIGHT + MINI_PLAYER_TAB_GAP;
  }
  return Math.max(insets.bottom + 8, 12);
}
