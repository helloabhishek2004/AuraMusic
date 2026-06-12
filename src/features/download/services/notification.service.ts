import { useDownloadStore } from "../store/download.store";
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification category and listener once
let isListenerSet = false;

// Request notification options when foregrounded/backgrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export class DownloadNotificationService {
  private static lastUpdate = 0;
  private static UPDATE_THROTTLE = 1000;
  private static categoryRegistered = false;

  private static completedCountAccumulator = 0;
  private static completedTimeout: NodeJS.Timeout | null = null;

  private static async registerCategory() {
    if (this.categoryRegistered) return;
    try {
      await Notifications.setNotificationCategoryAsync('aura-download-category', [
        {
          identifier: 'cancel-download',
          buttonTitle: 'Cancel Download',
          options: {
            isDestructive: true,
            opensAppToForeground: false,
          },
        },
      ]);
      
      if (!isListenerSet) {
        Notifications.addNotificationResponseReceivedListener(response => {
          if (response.actionIdentifier === 'cancel-download') {
            const store = useDownloadStore.getState();
            const downloadingTrackId = Object.keys(store.activeTasks).find(
              id => store.activeTasks[id]?.status === 'downloading'
            );
            if (downloadingTrackId) {
              const { DownloadManager } = require('./download.manager');
              DownloadManager.cancelDownload(downloadingTrackId);
            }
          }
        });
        isListenerSet = true;
      }
      
      this.categoryRegistered = true;
    } catch (e) {
      console.warn("[DownloadNotification] Failed to register category", e);
    }
  }

  static async showStarted(title: string) {
    try {
      useDownloadStore.getState().setDownloadNotification({
        isVisible: true,
        title: title,
        progress: 0,
        activeCount: 1,
        remaining: useDownloadStore.getState().queue.filter(q => q.status === 'queued').length,
        isComplete: false,
      });
    } catch {}

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'aura-download-noti',
        content: {
          title: 'Aura Music',
          body: `Started downloading: ${title}`,
          sound: false,
          vibrate: [],
          sticky: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null,
      });
    } catch (e) {
      console.warn("[DownloadNotification] Failed to show started", e);
    }
  }

  static async showFailed(title: string, reason: string) {
    try {
      await Notifications.dismissNotificationAsync('aura-download-noti');
    } catch {}

    try {
      useDownloadStore.getState().setDownloadNotification(null);
    } catch {}

    try {
      const notiId = `aura-download-failed-${Date.now()}`;
      await Notifications.scheduleNotificationAsync({
        identifier: notiId,
        content: {
          title: 'Aura Music',
          body: `Download failed: ${title}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null,
      });

      // Auto-expire the failure notification after 6 seconds
      setTimeout(async () => {
        try {
          await Notifications.dismissNotificationAsync(notiId);
        } catch {}
      }, 6000);
    } catch (e) {
      console.warn("[DownloadNotification] Failed to show failed", e);
    }
  }

  static async updateProgress(title: string, progress: number, remaining: number) {
    const now = Date.now();
    const pct = Math.round(progress * 100);

    try {
      useDownloadStore.getState().setDownloadNotification({
        isVisible: true,
        title: title,
        progress: pct,
        activeCount: 1,
        remaining: remaining,
        isComplete: false,
      });
    } catch {}

    if (now - this.lastUpdate < this.UPDATE_THROTTLE && pct < 100 && pct % 10 !== 0) {
      return;
    }

    this.lastUpdate = now;
    await this.registerCategory();

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'aura-download-noti',
        content: {
          title: 'Aura Music',
          body: `Downloading: ${title} (${pct}%) · ${remaining} remaining`,
          sound: false,
          vibrate: [],
          sticky: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'aura-download-category',
        },
        trigger: null,
      });
    } catch (e) {
      console.warn("[DownloadNotification] Failed to update progress", e);
    }
  }

  static async clear() {
    try {
      useDownloadStore.getState().setDownloadNotification(null);
    } catch {}
    try {
      await Notifications.dismissNotificationAsync('aura-download-noti');
    } catch (e) {
      console.warn("[DownloadNotification] Failed to clear", e);
    }
  }

  static async showCompleted(count: number) {
    this.completedCountAccumulator += count;

    if (this.completedTimeout) {
      clearTimeout(this.completedTimeout);
    }

    this.completedTimeout = setTimeout(async () => {
      const finalCount = this.completedCountAccumulator;
      this.completedCountAccumulator = 0;
      this.completedTimeout = null;

      try {
        try {
          useDownloadStore.getState().setDownloadNotification({
            isVisible: true,
            title: finalCount > 1 
              ? `${finalCount} tracks downloaded` 
              : 'Download complete',
            progress: 100,
            activeCount: 0,
            remaining: 0,
            isComplete: true,
          });
        } catch {}

        await Notifications.scheduleNotificationAsync({
          identifier: 'aura-download-noti',
          content: {
            title: 'Aura Music',
            body: finalCount > 1 
              ? `${finalCount} tracks downloaded successfully` 
              : 'Download complete',
            sound: true,
            vibrate: [0, 250, 250, 250],
            sticky: false,
            priority: Notifications.AndroidNotificationPriority.DEFAULT,
          },
          trigger: null,
        });
        
        setTimeout(async () => {
          try {
            const currentNoti = useDownloadStore.getState().notification;
            if (currentNoti && currentNoti.isComplete) {
              useDownloadStore.getState().setDownloadNotification(null);
            }
            await Notifications.dismissNotificationAsync('aura-download-noti');
          } catch {}
        }, 6000);
      } catch (e) {
        console.warn("[DownloadNotification] Failed to show completed", e);
      }
    }, 1000);
  }
}