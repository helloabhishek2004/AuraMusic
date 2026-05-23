export type IdleTaskCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

/**
 * Polyfill for requestIdleCallback in React Native / Hermes
 * If requestIdleCallback is unavailable, it falls back to a 16ms timeout.
 */
export const requestIdleTask = (cb: IdleTaskCallback, options?: { timeout: number }): number => {
    if (typeof global !== 'undefined' && (global as any).requestIdleCallback) {
        return (global as any).requestIdleCallback(cb, options);
    }
    if (typeof window !== 'undefined' && (window as any).requestIdleCallback) {
        return (window as any).requestIdleCallback(cb, options);
    }
    
    // Fallback: Use setTimeout to defer to next macrotask
    const start = Date.now();
    return setTimeout(() => {
        cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 16 - (Date.now() - start)),
        });
    }, 16) as unknown as number;
};

export const cancelIdleTask = (id: number): void => {
    if (typeof global !== 'undefined' && (global as any).cancelIdleCallback) {
        (global as any).cancelIdleCallback(id);
        return;
    }
    if (typeof window !== 'undefined' && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(id);
        return;
    }
    clearTimeout(id);
};
