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
  private static UPDATE_THROTTLE = 1000; // 1-second throttle is perfect for system notifications
  private static categoryRegistered = false;

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

  static async updateProgress(title: string, progress: number, remaining: number) {
    const now = Date.now();
    const pct = Math.round(progress * 100);

    // Throttle progress triggers to not overload the phone notification thread
    if (now - this.lastUpdate < this.UPDATE_THROTTLE && pct < 100 && pct % 10 !== 0) {
      return;
    }

    this.lastUpdate = now;
    await this.registerCategory();

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'aura-download-noti', // Static ID overwrites previous frame smoothly
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
      await Notifications.dismissNotificationAsync('aura-download-noti');
    } catch (e) {
      console.warn("[DownloadNotification] Failed to clear", e);
    }
  }

  static async showCompleted(count: number) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'aura-download-noti',
        content: {
          title: 'Aura Music',
          body: `${count} track${count > 1 ? 's' : ''} downloaded successfully`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null,
      });
      
      // Auto-clear success banner after 4 seconds
      setTimeout(async () => {
        try {
          await Notifications.dismissNotificationAsync('aura-download-noti');
        } catch {}
      }, 4000);
    } catch (e) {
      console.warn("[DownloadNotification] Failed to show completed", e);
    }
  }
}