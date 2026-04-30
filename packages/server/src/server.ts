import app from './app';
import { config } from './config';
import { setupSocketIO, sendPushNotification } from './services/socket.service';
import { initFCM } from './services/fcm.service';
import { prisma } from './prisma/client';
import http from 'http';

const server = http.createServer(app);
setupSocketIO(server);

// Initialize FCM (non-blocking — works offline if no credentials)
initFCM().catch(console.error);

const httpServer = server.listen(config.port, () => {
  console.log(`Education Management API running on port ${config.port} [${config.env}]`);
});

const shutdown = async () => {
  console.log('\nShutting down...');
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default httpServer;
export { sendPushNotification };
