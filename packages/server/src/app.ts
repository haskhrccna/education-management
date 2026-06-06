import './types/express';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import appointmentRoutes from './routes/appointment.routes';
import gradeRoutes from './routes/grade.routes';
import recordingRoutes from './routes/recording.routes';
import reportRoutes from './routes/report.routes';
import adminRoutes from './routes/admin.routes';
import messageRoutes from './routes/message.routes';
import fileRoutes from './routes/file.routes';
import exportRoutes from './routes/export.routes';
import docsRoutes from './routes/docs.routes';
import metricsRoutes from './routes/metrics.routes';
import { surahRouter, memorizationRouter } from './routes/memorization.routes';
import teacherChangeRoutes from './routes/teacherChange.routes';
import revisionRoutes from './routes/revision.routes';
import notificationRoutes from './routes/notification.routes';
import { errorHandler } from './middleware/error.middleware';
import { authenticate, authorize } from './middleware/auth.middleware';
import { UserRole } from '@quran-review/shared';
import { requestId } from './middleware/request-id.middleware';
import { timeout } from './middleware/timeout.middleware';
import { sanitizeRequestBody, sanitizeResponse } from './middleware/sanitize.middleware';
import { standardLimiter, authLimiter, adminLimiter, uploadLimiter } from './middleware/rate-limit.middleware';
import { requestLogger } from './lib/logger';
import { config } from './config';
import { getHealthStatus } from './lib/health';
import { successResponse, errorResponse } from './lib/response';

const app: Application = express();

// Request ID + Timeout
app.use(requestId);
app.use(timeout());

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: config.env === 'production',
    crossOriginEmbedderPolicy: config.env === 'production',
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
app.use(
  cors({
    origin: config.env === 'production' ? config.clientUrl : '*',
    credentials: true,
  })
);

// Rate limiting — authenticated routes get user-aware keys; auth routes stay IP-based
app.use(requestLogger);
app.use(express.json({ limit: '512kb' }));
app.use(sanitizeRequestBody);
app.use(sanitizeResponse);

// API Docs — admin-only outside development
if (config.env !== 'development') {
  app.use('/api/docs', authenticate, authorize(UserRole.ADMIN), docsRoutes);
} else {
  app.use('/api/docs', docsRoutes);
}
app.use('/metrics', authenticate, authorize(UserRole.ADMIN), metricsRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(successResponse(health));
});

// API v1 Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', authenticate, standardLimiter, userRoutes);
app.use('/api/v1/appointments', authenticate, standardLimiter, appointmentRoutes);
app.use('/api/v1/grades', authenticate, standardLimiter, gradeRoutes);
app.use('/api/v1/recordings', authenticate, uploadLimiter, recordingRoutes);
app.use('/api/v1/reports', authenticate, standardLimiter, reportRoutes);
app.use('/api/v1/admin', authenticate, adminLimiter, adminRoutes);
app.use('/api/v1/messages', authenticate, standardLimiter, messageRoutes);
app.use('/api/v1/surahs', authenticate, standardLimiter, surahRouter);
app.use('/api/v1/memorization', authenticate, standardLimiter, memorizationRouter);
app.use('/api/v1/files', standardLimiter, fileRoutes); // fileAuthenticate applied inside file.routes.ts
app.use('/api/v1/exports', authenticate, standardLimiter, exportRoutes);
app.use('/api/v1/teacher-changes', authenticate, standardLimiter, teacherChangeRoutes);
app.use('/api/v1/revisions', authenticate, standardLimiter, revisionRoutes);
app.use('/api/v1/notifications', authenticate, standardLimiter, notificationRoutes);

// Legacy redirects (optional - remove after mobile update)
// Mirroring exact same middleware stack as v1 for consistent protection
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', authenticate, standardLimiter, userRoutes);
app.use('/api/appointments', authenticate, standardLimiter, appointmentRoutes);
app.use('/api/grades', authenticate, standardLimiter, gradeRoutes);
app.use('/api/recordings', authenticate, uploadLimiter, recordingRoutes);
app.use('/api/reports', authenticate, standardLimiter, reportRoutes);
app.use('/api/admin', authenticate, adminLimiter, adminRoutes);
app.use('/api/messages', authenticate, standardLimiter, messageRoutes);
app.use('/api/files', standardLimiter, fileRoutes); // fileAuthenticate applied inside file.routes.ts
app.use('/api/exports', authenticate, standardLimiter, exportRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json(errorResponse('Not found'));
});

// Centralized error handler
app.use(errorHandler);

export default app;
