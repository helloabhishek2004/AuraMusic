import { useNetworkStore } from '../store/network.store';

export function useNetworkState() {
  const status = useNetworkStore((s) => s.status);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isOffline = useNetworkStore((s) => s.isOffline);
  const isDegraded = useNetworkStore((s) => s.isDegraded);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const connectionType = useNetworkStore((s) => s.connectionType);

  return {
    status,
    isOnline,
    isOffline,
    isDegraded,
    isInternetReachable,
    connectionType,
  };
}
