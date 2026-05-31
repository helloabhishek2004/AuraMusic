/**
 * back.types.ts — Type definitions for the centralized back priority system.
 *
 * This module defines the handler registration contract and priority constants
 * used by BackPriorityProvider to resolve hardware back presses deterministically.
 */

/**
 * A single back handler registration.
 * - `id`: unique identifier for this handler (used for update/unregister)
 * - `priority`: higher values are checked first
 * - `enabled`: whether this handler is currently active
 * - `onBack`: callback returning `true` if the back press was consumed
 */
export interface BackHandlerRegistration {
  id: string;
  priority: number;
  enabled: boolean;
  onBack: () => boolean;
}

/**
 * Context value provided by BackPriorityProvider.
 */
export interface BackPriorityContextValue {
  register: (handler: BackHandlerRegistration) => () => void;
  unregister: (id: string) => void;
  update: (id: string, updates: Partial<Omit<BackHandlerRegistration, 'id'>>) => void;
}

/**
 * Priority constants — higher values are resolved first.
 *
 * Order:
 *   1. NATIVE_MODAL / ACTION_SHEET / BOTTOM_SHEET  (overlay dismissals)
 *   2. KEYBOARD_DISMISS / SEARCH_FOCUSED           (input state)
 *   3. PLAYER_SUB_SURFACE                          (lyrics, queue, devices, menu)
 *   4. EXPANDED_PLAYER                             (collapse player)
 *   5. STACK_POP                                   (navigation back)
 *   6. TAB_FALLBACK                                (go to Home tab)
 *   7. EXIT_APP                                    (double-back to exit)
 */
export const BackPriority = {
  NATIVE_MODAL: 900,
  ACTION_SHEET: 850,
  KEYBOARD_DISMISS: 800,
  BOTTOM_SHEET: 700,
  SEARCH_FOCUSED: 600,
  PLAYER_SUB_SURFACE: 500,
  EXPANDED_PLAYER: 400,
  STACK_POP: 200,
  TAB_FALLBACK: 100,
  EXIT_APP: 0,
} as const;
