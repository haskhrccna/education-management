import './types/express';
import app from './app';
import { config } from './config';
import { setupSocketIO, closeSocketIO } from './services/socket.service';
import { closeQueues } from './lib/queue';
import { initFCM } from './services/fcm.service';
import { prisma } from './prisma/client';
import { logger } from './lib/logger';
import { verifyMushafAssets, getMushafPagesDir, TOTAL_MUSHAF_PAGES } from './lib/mushaf-assets';
import http from 'http';

// Mushaf pages are core content: refuse to serve a production API that would
// 404 the Quran. Override consciously with ALLOW_MISSING_MUSHAF_PAGES=1.
const mushafAssets = verifyMushafAssets(getMushafPagesDir());
if (mushafAssets.present < TOTAL_MUSHAF_PAGES) {
  const msg = `mushaf-pages incomplete: ${mushafAssets.present}/${TOTAL_MUSHAF_PAGES} present (first missing: ${mushafAssets.missing[0]})`;
  if (config.env === 'production' && !config.allowMissingMushafPages) {
    logger.error(
      msg + ' — refusing to start. Populate with scripts/extract_mushaf_pages.py or set ALLOW_MISSING_MUSHAF_PAGES=1.'
    );
    process.exit(1);
  }
  logger.warn(msg);
}

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

  // Close Socket.IO connections
  try {
    await closeSocketIO();
  } catch (err) {
    logger.error({ err }, 'Socket.IO close failed');
  }

  // Close BullMQ queues and workers
  try {
    await closeQueues();
  } catch (err) {
    logger.error({ err }, 'BullMQ close failed');
  }

  // Close database connection
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (err) {
    logger.error({ err }, 'Database disconnect failed');
  }

  // Stop accepting new connections and exit
  httpServer.close((err) => {
    if (err) {
      logger.error({ err }, 'HTTP server close failed');
      process.exit(1);
    }
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
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
  shutdown('unhandledRejection');
});

export default httpServer;
