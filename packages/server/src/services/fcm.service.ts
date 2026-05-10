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
    // Dynamic import so the server still boots if firebase-admin isn't installed.
    // @ts-ignore — firebase-admin is an optional dependency; install it to enable real FCM.
    const adminModule: any = await import('firebase-admin').catch(() => null);
    if (!adminModule) {
      logger.warn(
        'firebase-admin package not installed — push notifications disabled. Run: npm install firebase-admin'
      );
      return;
    }
    const admin = adminModule.default ?? adminModule;

    if (!admin.apps?.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebaseProjectId,
          clientEmail: config.firebaseClientEmail,
          // Private keys in env vars commonly arrive with literal "\n" — normalize.
          privateKey: config.firebasePrivateKey.replace(/\\n/g, '\n'),
        }),
      });
    }
    messaging = admin.messaging();
    logger.info('FCM initialized');
  } catch (err) {
    logger.error({ err }, 'FCM init failed — push notifications disabled');
    messaging = null;
  }
};

// Save device token mapping
export const saveDeviceToken = async (userId: string, deviceToken: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { deviceToken },
  });
  logger.info({ userId, token: deviceToken.slice(0, 20) }, 'Device token saved');
};

/**
 * Send a push notification to a single device token via FCM.
 * Returns gracefully (no throw) if FCM is not initialized or the token is empty.
 */
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
    logger.info({ title, token: deviceToken.slice(0, 12) }, 'Push notification sent');
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
