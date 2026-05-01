import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(style).catch(() => undefined);
}

export function notify(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(type).catch(() => undefined);
}
