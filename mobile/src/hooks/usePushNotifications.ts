import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { usersApi } from '../api/users';

// Push is phone-only: Expo push tokens don't exist on web, and simulators
// can't receive pushes.
const PUSH_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

if (PUSH_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/** The EAS project ID the Expo push service needs (set by `eas init`). */
function easProjectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
}

async function registerForPush(): Promise<string | null> {
  if (!PUSH_SUPPORTED || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    // Android 13+ asks for permission only after a channel exists.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1B5E20',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;

  const projectId = easProjectId();
  if (!projectId) {
    console.warn('[Push] No EAS projectId (run `eas init`); push registration skipped.');
    return null;
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/**
 * Registers this device for push once a user is signed in, and opens the
 * notifications screen when a push is tapped. Mounted from the root layout.
 * The server moves the token to whoever signed in last and clears it on logout.
 */
export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId || !PUSH_SUPPORTED) return;
    let cancelled = false;

    registerForPush()
      .then((token) => {
        if (token && !cancelled) return usersApi.saveDeviceToken(token);
      })
      .catch((err) => {
        // Push is an enhancement: a failed registration must never break the app.
        console.warn('[Push] registration failed:', err instanceof Error ? err.message : err);
      });

    const tapped = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/notifications');
    });

    return () => {
      cancelled = true;
      tapped.remove();
    };
  }, [userId]);
}
