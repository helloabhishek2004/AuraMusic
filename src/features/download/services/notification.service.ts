import { useDownloadStore } from "../store/download.store";

export class DownloadNotificationService {
  private static lastUpdate = 0;
  private static UPDATE_THROTTLE = 3000;
  private static activeDownloads: Map<string, { title: string; progress: number }> = new Map();

  static async updateProgress(title: string, progress: number, remaining: number) {
    const now = Date.now();
    const pct = Math.round(progress * 100);

    if (now - this.lastUpdate < this.UPDATE_THROTTLE && pct < 100 && pct % 10 !== 0) {
      return;
    }

    this.lastUpdate = now;
    this.activeDownloads.set('current', { title, progress });

    const store = useDownloadStore.getState();
    const activeCount = Object.keys(store.activeTasks).filter(
      id => store.activeTasks[id]?.status === 'downloading'
    ).length;

    store.setDownloadNotification({
      isVisible: true,
      title,
      progress: pct,
      activeCount: activeCount + 1,
      remaining,
    });
  }

  static async clear() {
    this.activeDownloads.clear();
    useDownloadStore.getState().setDownloadNotification(null);
  }

  static async showCompleted(count: number) {
    useDownloadStore.getState().setDownloadNotification({
      isVisible: true,
      title: `${count} track${count > 1 ? 's' : ''} downloaded`,
      progress: 100,
      activeCount: 0,
      remaining: 0,
      isComplete: true,
    });

    setTimeout(() => {
      useDownloadStore.getState().setDownloadNotification(null);
    }, 3000);
  }
}