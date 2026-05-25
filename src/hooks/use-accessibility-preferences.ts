import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSettingsStore } from '../features/settings/store/settings.store';

export function useReducedMotionPreference() {
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const appReduceMotion = useSettingsStore((s) => s.reduceMotion);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setSystemReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReduceMotion
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return systemReduceMotion || appReduceMotion;
}
