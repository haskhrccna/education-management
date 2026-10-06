import { prisma } from '../prisma/client';
import { logger } from '../lib/logger';
import { config } from '../config';

// firebase-admin is loaded lazily via dynamic import. The package is optional —
// if it's not installed (or credentials are missing), push notifications are a
// no-op and the server still runs. To enable real FCM delivery, run:
//   npm install firebase-admin
// and set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
type AdminMessaging = {
  send: (msg: {
    token: string;
    notification: { title: string; body: string };
    data?: Record<string, string>;
  }) => Promise<string>;
};

let messaging: AdminMessaging | null = null;
let initAttempted = false;

const hasCredentials = (): boolean =>
  !!(config.firebaseProjectId && config.firebaseClientEmail && config.firebasePrivateKey);

export const initFCM = async (): Promise<void> => {
  if (initAttempted) return;
  initAttempted = true;

  if (!hasCredentials()) {
    logger.info(
      'FCM not configured — push notifications disabled. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.'
    );
    return;
  }

  try {
    // Dynamic imports so the server still boots if firebase-admin isn't installed.
    //
    // These are the modular entry points ('firebase-admin/app',
    // 'firebase-admin/messaging'). The old code used the root namespace —
    // admin.credential.cert() and admin.messaging() — which firebase-admin 14
    // no longer exposes on the CJS root export: both read as undefined, the
    // TypeError lands in the catch below, and push turns itself off with only
    // a log line. The modular form works on 12, 13 and 14.
    // @ts-ignore — firebase-admin is an optional dependency; install it to enable real FCM.
    const appModule: any = await import('firebase-admin/app').catch(() => null);
    // @ts-ignore — optional dependency, see above.
    const messagingModule: any = await import('firebase-admin/messaging').catch(() => null);
    if (!appModule || !messagingModule) {
      logger.warn(
        'firebase-admin package not installed — push notifications disabled. Run: npm install firebase-admin'
      );
      return;
    }
    const { initializeApp, getApps, cert } = appModule;
    const { getMessaging } = messagingModule;

    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential: cert({
              projectId: config.firebaseProjectId,
              clientEmail: config.firebaseClientEmail,
              // Private keys in env vars commonly arrive with literal "\n" — normalize.
              privateKey: config.firebasePrivateKey.replace(/\\n/g, '\n'),
            }),
          });
    messaging = getMessaging(app);
    logger.info('FCM initialized');
  } catch (err) {
    logger.error({ err }, 'FCM init failed — push notifications disabled');
    messaging = null;
  }
};

// Save device token mapping

/**
 * Send a push notification to a single device token via FCM.
 * Returns gracefully (no throw) if FCM is not initialized or the token is empty.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const isExpoToken = (token: string) => /^Expo(nent)?PushToken\[.+\]$/.test(token);

/**
 * The app registers with `getExpoPushTokenAsync`, which yields an Expo token
 * that Firebase Admin rejects. Those go through Expo's push service, which
 * relays to FCM (Android) and APNs (iOS) using the credentials stored in EAS.
 * EXPO_ACCESS_TOKEN is optional: needed only if "enhanced push security" is on.
 */
async function sendViaExpo(token: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (config.expoAccessToken) headers.Authorization = `Bearer ${config.expoAccessToken}`;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: 'default' }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { status?: string; message?: string; details?: { error?: string } };
    };
    const ticket = json.data;
    if (ticket?.status === 'error') {
      // The app was uninstalled or the token rotated: stop sending to it.
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await prisma.user.updateMany({ where: { deviceToken: token }, data: { deviceToken: null } });
      }
      logger.warn({ title, error: ticket.details?.error, message: ticket.message }, 'Expo push rejected');
      return;
    }
    logger.info({ title }, 'Push notification sent (Expo)');
  } catch (err) {
    logger.error({ err, title }, 'Expo push failed');
  }
}

export const sendPushNotification = async (
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> => {
  if (!deviceToken) {
    logger.debug('sendPushNotification called without a deviceToken — skipping');
    return;
  }
  if (isExpoToken(deviceToken)) {
    await sendViaExpo(deviceToken, title, body, data);
    return;
  }
  if (!messaging) {
    logger.debug({ title }, 'FCM not initialized — push skipped');
    return;
  }

  try {
    await messaging.send({
      token: deviceToken,
      notification: { title, body },
      data: data ?? {},
    });
    logger.info({ title }, 'Push notification sent');
  } catch (err) {
    logger.error({ err, title }, 'Push notification failed');
  }
};

/**
 * Convenience helper: look up a user's stored device token and send a push.
 * Used by the unified notification.service.
 */
export const sendPushToUser = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { deviceToken: true },
    });
    if (!user?.deviceToken) {
      logger.debug({ userId }, 'No device token for user — push skipped');
      return;
    }
    await sendPushNotification(user.deviceToken, title, body, data);
  } catch (err) {
    logger.error({ err, userId }, 'sendPushToUser failed');
  }
};

export const sendScheduleNotification = async (userId: string, appointmentInfo: { date: string; status: string }) => {
  await sendPushToUser(
    userId,
    `Appointment ${appointmentInfo.status}`,
    `Your appointment on ${appointmentInfo.date} has been ${appointmentInfo.status}`,
    { date: appointmentInfo.date, status: appointmentInfo.status }
  );
};
