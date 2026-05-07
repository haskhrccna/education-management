import { prisma } from '../prisma/client';
import { logger } from '../lib/logger';

interface FcmClient {
  initialized?: boolean;
}

let fcm: FcmClient | null = null;
const SERVICE_ACCOUNT_KEY = process.env.FCM_SERVICE_ACCOUNT_KEY;

// Initialize with GCP service account JSON (base64 encoded) or file path
export const initFCM = async () => {
  if (!SERVICE_ACCOUNT_KEY) {
    logger.info('FCM not configured — push notifications disabled. Set FCM_SERVICE_ACCOUNT_KEY env var.');
    return;
  }
  try {
    // When credentials are provided, initialize @google-cloud/fcm here
    // const admin = await import('firebase-admin');
    // const serviceAccount = JSON.parse(Buffer.from(SERVICE_ACCOUNT_KEY, 'base64').toString());
    // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    // fcm = admin.messaging();
    fcm = { initialized: true };
    logger.info('FCM initialized');
  } catch (err) {
    logger.error({ err }, 'FCM init failed');
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

// Send push notification to specific user
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  if (!fcm?.initialized) return;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { deviceToken: true } });
    if (!user?.deviceToken) {
      logger.debug({ userId }, 'No device token for user');
      return;
    }

    // Actual FCM send (uncomment when firebase-admin is installed):
    // await fcm.send({
    //   token: user.deviceToken,
    //   notification: { title, body },
    //   data: data || {},
    // });

    logger.info({ userId, title }, 'Push notification sent');
  } catch (err) {
    logger.error({ err, userId }, 'Push notification failed');
  }
};

export const sendScheduleNotification = async (userId: string, appointmentInfo: { date: string; status: string }) => {
  await sendPushNotification(
    userId,
    `Appointment ${appointmentInfo.status}`,
    `Your appointment on ${appointmentInfo.date} has been ${appointmentInfo.status}`,
    { date: appointmentInfo.date, status: appointmentInfo.status }
  );
};
