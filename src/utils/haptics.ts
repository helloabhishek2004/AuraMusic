import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';
import { useSettingsStore } from '@/src/features/settings/store/settings.store';

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export type ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;

export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;
export type NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

export type ImpactFeedbackStyleType = ExpoHaptics.ImpactFeedbackStyle;
export type NotificationFeedbackTypeType = ExpoHaptics.NotificationFeedbackType;

let _cachedHapticsEnabled = true;

try {
  _cachedHapticsEnabled = useSettingsStore.getState().hapticsEnabled !== false;
  useSettingsStore.subscribe((state) => {
    _cachedHapticsEnabled = state.hapticsEnabled !== false;
  });
} catch (_) {}

export function isHapticsAllowed(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const fromStore = useSettingsStore.getState().hapticsEnabled;
    if (fromStore === false) return false;
  } catch (_) {}
  return _cachedHapticsEnabled;
}

export function impact(style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Light) {
  if (!isHapticsAllowed()) return;
  ExpoHaptics.impactAsync(style).catch(() => undefined);
}

export function notify(type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success) {
  if (!isHapticsAllowed()) return;
  ExpoHaptics.notificationAsync(type).catch(() => undefined);
}

export async function impactAsync(style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Light): Promise<void> {
  if (!isHapticsAllowed()) return;
  return ExpoHaptics.impactAsync(style).catch(() => undefined);
}

export async function notificationAsync(type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success): Promise<void> {
  if (!isHapticsAllowed()) return;
  return ExpoHaptics.notificationAsync(type).catch(() => undefined);
}

export async function selectionAsync(): Promise<void> {
  if (!isHapticsAllowed()) return;
  return ExpoHaptics.selectionAsync().catch(() => undefined);
}

export default {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impact,
  notify,
  impactAsync,
  notificationAsync,
  selectionAsync,
  isHapticsAllowed,
};
