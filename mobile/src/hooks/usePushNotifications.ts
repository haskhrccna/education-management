import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

let Device: any = null;
try {
  Device = require('expo-device');
} catch {
  // expo-device not installed
}

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }) as any,
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Device && !Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }

  return token;
}

export function usePushNotifications() {
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        // Send token to backend
        apiClient.post('/users/device-token', { deviceToken: token }).catch(() => {
          // Token will be sent on next API call if this fails
        });
      }
    });

    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response.notification.request.content);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);
}
