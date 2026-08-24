/**
 * useBackHandler — Hook for registering a back handler with the centralized system.
 *
 * Usage:
 *   useBackHandler({
 *     id: 'player-queue',
 *     enabled: isQueueOpen,
 *     priority: BackPriority.PLAYER_SUB_SURFACE,
 *     onBack: () => { closeQueue(); return true; },
 *   });
 *
 * Notes:
 *  - Registers on mount, unregisters on unmount
 *  - Updates enabled/onBack via context.update() when dependencies change
 *  - Uses useRef for the callback to prevent stale closure issues
 */

import { useEffect, useRef } from 'react';
import { useBackPriorityContext } from './BackPriorityProvider';

interface UseBackHandlerOptions {
  /** Unique identifier for this handler */
  id: string;
  /** Whether this handler is currently active */
  enabled: boolean;
  /** Priority level — higher values are checked first */
  priority: number;
  /** Callback invoked on back press. Return true to consume the event. */
  onBack: () => boolean;
}

export function useBackHandler({ id, enabled, priority, onBack }: UseBackHandlerOptions): void {
  const ctx = useBackPriorityContext();
  const onBackRef = useRef(onBack);

  // Keep the callback ref current to avoid stale closures
  onBackRef.current = onBack;

  // Register on mount, unregister on unmount
  useEffect(() => {
    const unsubscribe = ctx.register({
      id,
      priority,
      enabled,
      onBack: () => onBackRef.current(),
    });

    return unsubscribe;
  }, [id]); // Only re-register if id changes (shouldn't happen in practice)

  // Update enabled and priority when they change
  useEffect(() => {
    ctx.update(id, { enabled, priority });
  }, [id, enabled, priority, ctx]);
}
