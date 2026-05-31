/**
 * BackPriorityProvider — Single root BackHandler authority.
 *
 * Architecture:
 *  - ONE BackHandler.addEventListener at root level
 *  - Child components register callbacks with priorities via context
 *  - On back press, the highest-priority enabled handler executes first
 *  - If none consume the event, system default (exit app) runs
 *
 * Implementation notes:
 *  - Uses Map<string, Registration> in a ref to avoid stale closures
 *  - register() returns an unsubscribe function for cleanup
 *  - update() allows toggling enabled/onBack without re-registration
 *  - Sorting by priority DESC on each back press (handler count is small, O(n log n) is fine)
 */

import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import type { BackHandlerRegistration, BackPriorityContextValue } from './back.types';

const BackPriorityContext = createContext<BackPriorityContextValue | null>(null);

export function useBackPriorityContext(): BackPriorityContextValue {
  const ctx = useContext(BackPriorityContext);
  if (!ctx) {
    throw new Error('useBackPriorityContext must be used within <BackPriorityProvider>');
  }
  return ctx;
}

interface Props {
  children: React.ReactNode;
}

export function BackPriorityProvider({ children }: Props) {
  // Ref-based map avoids stale closure issues — the back handler callback
  // always reads the latest registrations without needing useEffect re-subscriptions.
  const handlersRef = useRef<Map<string, BackHandlerRegistration>>(new Map());

  const register = useCallback((handler: BackHandlerRegistration): (() => void) => {
    handlersRef.current.set(handler.id, handler);
    return () => {
      handlersRef.current.delete(handler.id);
    };
  }, []);

  const unregister = useCallback((id: string) => {
    handlersRef.current.delete(id);
  }, []);

  const update = useCallback((id: string, updates: Partial<Omit<BackHandlerRegistration, 'id'>>) => {
    const existing = handlersRef.current.get(id);
    if (existing) {
      handlersRef.current.set(id, { ...existing, ...updates });
    }
  }, []);

  useEffect(() => {
    console.log('[BACK PROVIDER MOUNTED]');
  }, []);

  // Single root BackHandler — registered once on mount, removed on unmount
  useEffect(() => {
    console.log('[BACK PROVIDER REGISTERING LISTENER]');
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('[ROOT BACK EVENT RECEIVED]');
      console.log('[BackPriority] ===== HARDWARE BACK PRESS TRIGGERED =====');
      
      const handlers = Array.from(handlersRef.current.values());
      console.log('[BACK HANDLERS]', handlers);

      // Filter to enabled handlers, sort by priority descending
      const active = handlers
        .filter(h => h.enabled)
        .sort((a, b) => b.priority - a.priority);

      // Execute highest-priority handler first; stop if consumed
      for (const handler of active) {
        try {
          console.log('[EXECUTING]', {
            id: handler.id,
            priority: handler.priority,
            enabled: handler.enabled,
          });
          const consumed = handler.onBack();
          if (consumed) {
            console.log(`[BackPriority] Handler "${handler.id}" returned TRUE`);
            return true;
          }
          console.log(`[BackPriority] Handler "${handler.id}" returned FALSE`);
        } catch (err) {
          if (__DEV__) {
            console.warn(`[BackPriorityProvider] Handler "${handler.id}" threw:`, err);
          }
        }
      }

      console.log('[BackPriority] No active handler consumed the event. Allowing system default (exit app).');
      // No handler consumed — allow system default (exit app)
      return false;
    });

    return () => {
      console.log('[BACK PROVIDER UNMOUNTED]');
      subscription.remove();
    };
  }, []);

  const contextValue = useRef<BackPriorityContextValue>({ register, unregister, update }).current;

  return (
    <BackPriorityContext.Provider value={contextValue}>
      {children}
    </BackPriorityContext.Provider>
  );
}
