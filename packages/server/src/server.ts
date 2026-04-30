import app from './app';
import { config } from './config';
import { setupSocketIO } from './services/socket.service';
import { initFCM } from './services/fcm.service';
import { prisma } from './prisma/client';
import { logger } from './lib/logger';
import http from 'http';

const server = http.createServer(app);
setupSocketIO(server);

// Initialize FCM (non-blocking — works offline if no credentials)
initFCM().catch((err) => logger.error({ err }, 'FCM init failed'));

const httpServer = server.listen(config.port, () => {
  logger.info(`Education Management API running on port ${config.port} [${config.env}]`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully...');

  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connection
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (err) {
    logger.error({ err }, 'Database disconnect failed');
  }

  // Force exit after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

export default httpServer;
