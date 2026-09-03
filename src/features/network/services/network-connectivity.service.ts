import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useNetworkStore, NetworkStatus, ConnectionType } from '../store/network.store';
import { useDeviceStateStore } from '../../device/store/device-state.store';

type ReconnectionListener = () => void;

class NetworkConnectivityService {
  private isInitialized = false;
  private isProbing = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectionListeners = new Set<ReconnectionListener>();

  private cancelDisconnection(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  /**
   * Initialize global connectivity monitoring
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen to network state changes
    NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetworkChange(state);
    });

    // Initial fetch
    try {
      const initialState = await NetInfo.fetch();
      await this.handleNetworkChange(initialState);
    } catch (e) {
      console.warn('[NetworkService] Failed to fetch initial network state:', e);
      useNetworkStore.getState().setNetworkState({
        status: 'unknown',
        connectionType: 'unknown',
      });
    }
  }

  /**
   * Evaluates network state with reachability verification
   */
  private async handleNetworkChange(state: NetInfoState): Promise<void> {
    const store = useNetworkStore.getState();
    const prevStatus = store.status;

    let connectionType: ConnectionType = 'unknown';
    if (state.type === 'wifi') {
      connectionType = 'wifi';
    } else if (state.type === 'cellular') {
      connectionType = 'cellular';
    } else if (state.type === 'ethernet') {
      connectionType = 'ethernet';
    } else if (state.type === 'bluetooth') {
      connectionType = 'bluetooth';
    } else {
      connectionType = 'other';
    }

    // 1. Definitively Disconnected (Debounced by 450ms to allow smooth Wi-Fi <-> Cellular handoff without flapping)
    if (!state.isConnected) {
      this.cancelReconnection();
      this.cancelDisconnection();
      this.disconnectTimer = setTimeout(() => {
        useNetworkStore.getState().setNetworkState({
          status: 'offline',
          connectionType: 'none',
          isInternetReachable: false,
          lastOfflineAt: Date.now(),
        });
        // Sync legacy device state
        useDeviceStateStore.getState().setConnection('none');
      }, 450);
      return;
    }

    // 2. Connected but confirmed NO internet (Captive Portal / Wi-Fi without WAN)
    if (state.isInternetReachable === false) {
      this.cancelReconnection();
      this.cancelDisconnection();
      this.disconnectTimer = setTimeout(() => {
        useNetworkStore.getState().setNetworkState({
          status: 'offline',
          connectionType,
          isInternetReachable: false,
          lastOfflineAt: Date.now(),
        });
        // Sync legacy device state as 'none' because there is no actual internet
        useDeviceStateStore.getState().setConnection('none');
      }, 450);
      return;
    }

    // Connected with active internet -> Cancel any pending disconnect
    this.cancelDisconnection();

    // 3. Connected and confirmed internet reachable
    if (state.isInternetReachable === true) {
      this.applyOnlineState(connectionType, prevStatus);
      return;
    }

    // 4. Connected but reachability is ambiguous (null on some platforms)
    // Run a lightweight reachability probe (2.5s bounded timeout)
    this.probeReachability(connectionType, prevStatus);
  }

  /**
   * Lightweight probe to confirm internet access when NetInfo isInternetReachable is null
   */
  private async probeReachability(connectionType: ConnectionType, prevStatus: NetworkStatus): Promise<void> {
    if (this.isProbing) return;
    this.isProbing = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      // Fast Google/Cloudflare 204 probe
      const response = await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (response && (response.status === 204 || (response.status >= 200 && response.status < 400))) {
        this.applyOnlineState(connectionType, prevStatus);
      } else {
        // Probe failed -> Treat as offline (Captive portal / No WAN)
        this.cancelReconnection();
        useNetworkStore.getState().setNetworkState({
          status: 'offline',
          connectionType,
          isInternetReachable: false,
          lastOfflineAt: Date.now(),
        });
        useDeviceStateStore.getState().setConnection('none');
      }
    } catch {
      this.cancelReconnection();
      useNetworkStore.getState().setNetworkState({
        status: 'offline',
        connectionType,
        isInternetReachable: false,
        lastOfflineAt: Date.now(),
      });
      useDeviceStateStore.getState().setConnection('none');
    } finally {
      this.isProbing = false;
    }
  }

  private applyOnlineState(connectionType: ConnectionType, prevStatus: NetworkStatus): void {
    const isRestoration = prevStatus === 'offline';

    useNetworkStore.getState().setNetworkState({
      status: 'online',
      connectionType,
      isInternetReachable: true,
      lastOnlineAt: Date.now(),
    });

    // Sync legacy device state store
    const legacyType = connectionType === 'wifi' ? 'wifi' : connectionType === 'cellular' ? 'cellular' : 'unknown';
    useDeviceStateStore.getState().setConnection(legacyType);

    // Coordinated Reconnection Trigger (Debounced 1500ms to avoid flapping storms)
    if (isRestoration) {
      this.scheduleReconnection();
    }
  }

  private scheduleReconnection(): void {
    this.cancelReconnection();

    this.reconnectTimer = setTimeout(async () => {
      console.log('[NetworkService] Reconnection confirmed: triggering coordinated background refresh.');

      // 1. Refresh trending seeds in recommendations store
      try {
        const { useRecommendationsStore } = await import('../../recommendations/store/recommendations.store');
        useRecommendationsStore.getState().refreshTrendingIfNeeded();
      } catch (e) {
        console.warn('[NetworkService] Failed to refresh trending seeds on reconnect:', e);
      }

      // 2. Resume pending download tasks if any are waiting
      try {
        const { DownloadQueueManager } = await import('../../download/services/download-queue-manager');
        DownloadQueueManager.processQueue();
      } catch (e) {
        console.warn('[NetworkService] Failed to resume download queue on reconnect:', e);
      }

      // 3. Notify custom subscribers
      this.reconnectionListeners.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          console.warn('[NetworkService] Reconnection listener error:', e);
        }
      });
    }, 1500);
  }

  private cancelReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Register a callback for coordinated network restoration
   */
  onReconnected(listener: ReconnectionListener): () => void {
    this.reconnectionListeners.add(listener);
    return () => this.reconnectionListeners.delete(listener);
  }
}

export const networkConnectivityService = new NetworkConnectivityService();
