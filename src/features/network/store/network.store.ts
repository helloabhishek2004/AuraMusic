import { create } from 'zustand';

export type NetworkStatus = 'unknown' | 'online' | 'offline' | 'degraded';
export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'other' | 'none' | 'unknown';

export interface NetworkState {
  status: NetworkStatus;
  isOnline: boolean;
  isOffline: boolean;
  isDegraded: boolean;
  isInternetReachable: boolean | null;
  connectionType: ConnectionType;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;

  // Actions
  setNetworkState: (partial: Partial<Omit<NetworkState, 'setNetworkState' | 'reportDegraded'>>) => void;
  reportDegraded: (isDegraded: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  status: 'unknown',
  isOnline: false,
  isOffline: false,
  isDegraded: false,
  isInternetReachable: null,
  connectionType: 'unknown',
  lastOnlineAt: null,
  lastOfflineAt: null,

  setNetworkState: (partial) => {
    const current = get();
    const updated = { ...current, ...partial };
    
    // Explicit semantic evaluation:
    // Online ONLY if connected AND internet is reachable (not false)
    const isOnline = updated.status === 'online' || (updated.status === 'degraded' && updated.isInternetReachable === true);
    const isOffline = updated.status === 'offline';
    const isDegraded = updated.status === 'degraded';

    set({
      ...partial,
      isOnline,
      isOffline,
      isDegraded,
    });
  },

  reportDegraded: (isDegraded: boolean) => {
    const current = get();
    if (isDegraded && current.status === 'online') {
      set({ status: 'degraded', isDegraded: true });
    } else if (!isDegraded && current.status === 'degraded') {
      set({ status: 'online', isDegraded: false });
    }
  },
}));
