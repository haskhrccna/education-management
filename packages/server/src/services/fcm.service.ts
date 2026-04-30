let fcm: any = null;
const SERVICE_ACCOUNT_KEY = process.env.FCM_SERVICE_ACCOUNT_KEY;

// Initialize with GCP service account JSON (base64 encoded) or file path
export const initFCM = async () => {
  if (!SERVICE_ACCOUNT_KEY) {
    console.log('[FCM] No credentials configured — push notifications disabled. Set FCM_SERVICE_ACCOUNT_KEY env var.');
    return;
   }
  try {
     // When credentials are provided, initialize @google-cloud/fcm here
     fcm = { initialized: true };
    console.log('[FCM] Initialized');
     } catch (err) {
    console.error('[FCM] Failed to initialize:', err);
     }
  };

// Save device token mapping
export const saveDeviceToken = async (userId: string, deviceToken: string) => {
   // TODO: Store in DB when FCM initialized
  console.log(`[FCM] Device token saved for user ${userId}: ${deviceToken.slice(0, 20)}...`);
 };

// Send push notification to specific user
export const sendPushNotification = async (deviceToken: string, title: string, body: string, data?: Record<string, string>) => {
   if (!fcm?.initialized) return;
   // TODO: fcm.send({ tokens: [deviceToken], notification: { title, body }, data })
  console.log(`[FCM] Push: ${title} — ${body}`);
 };

export const sendScheduleNotification = async (userId: string, appointmentInfo: { date: string; status: string }) => {
   // TODO: Implement when FCM configured
   console.log(`[FCM] Schedule update for ${userId}: ${appointmentInfo.status} @ ${appointmentInfo.date}`);
 };
