import './types/express';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import recordingRoutes from './routes/recording.routes';
import reportRoutes from './routes/report.routes';
import messageRoutes from './routes/message.routes';
import fileRoutes from './routes/file.routes';
import exportRoutes from './routes/export.routes';
import docsRoutes from './routes/docs.routes';
import metricsRoutes from './routes/metrics.routes';
import notificationRoutes from './routes/notification.routes';
import parentRoutes from './routes/parent.routes';
import gamificationRoutes from './routes/gamification.routes';
import analyticsRoutes from './routes/analytics.routes';
import certificateRoutes from './routes/certificate.routes';
import halaqaRoutes from './routes/halaqa.routes';
import { errorHandler } from './middleware/error.middleware';
import { authenticate, authorize } from './middleware/auth.middleware';
import { UserRole } from '@quran-review/shared';
import { requestId } from './middleware/request-id.middleware';
import { timeout } from './middleware/timeout.middleware';
import { sanitizeRequestBody, sanitizeResponse } from './middleware/sanitize.middleware';
import { standardLimiter, authLimiter, adminLimiter, uploadLimiter } from './middleware/rate-limit.middleware';
import { requestLogger } from './lib/logger';
import { config } from './config';
import { healthRouter } from './modules/health/health.module';
import { authRouter } from './modules/auth/auth.module';
import { usersRouter } from './modules/users/users.module';
import { adminRouter } from './modules/admin/admin.module';
import { appointmentsRouter } from './modules/appointments/appointments.module';
import { attendanceRouter } from './modules/attendance/attendance.module';
import { teacherChangeRouter } from './modules/teacher-change/teacher-change.module';
import { gradesRouter } from './modules/grades/grades.module';
import { surahsRouter } from './modules/surahs/surahs.module';
import { memorizationRouter } from './modules/memorization/memorization.module';
import { revisionsRouter } from './modules/revisions/revisions.module';
import { mushafRouter } from './modules/mushaf/mushaf.module';
import { rosterRouter } from './modules/roster/roster.module';
import { parentLinksRouter } from './modules/parent-links/parent-links.module';
import { errorResponse } from './lib/response';

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

// Health check — first contract-driven route (M1 pilot)
app.use('/api', healthRouter);

// API v1 Routes
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/users', authenticate, standardLimiter, usersRouter);
app.use('/api/v1/appointments', authenticate, standardLimiter, appointmentsRouter);
app.use('/api/v1/grades', authenticate, standardLimiter, gradesRouter);
app.use('/api/v1/recordings', authenticate, uploadLimiter, recordingRoutes);
app.use('/api/v1/reports', authenticate, standardLimiter, reportRoutes);
app.use('/api/v1/admin', authenticate, adminLimiter, adminRouter);
app.use('/api/v1/messages', authenticate, standardLimiter, messageRoutes);
app.use('/api/v1/surahs', authenticate, standardLimiter, surahsRouter);
app.use('/api/v1/memorization', authenticate, standardLimiter, memorizationRouter);
app.use('/api/v1/mushaf', authenticate, standardLimiter, mushafRouter);
app.use('/api/v1/roster', authenticate, standardLimiter, rosterRouter);
app.use('/api/v1/parent-links', authenticate, standardLimiter, parentLinksRouter);
app.use('/api/v1/files', standardLimiter, fileRoutes); // fileAuthenticate applied inside file.routes.ts
app.use('/api/v1/exports', authenticate, standardLimiter, exportRoutes);
app.use('/api/v1/teacher-changes', authenticate, standardLimiter, teacherChangeRouter);
app.use('/api/v1/revisions', authenticate, standardLimiter, revisionsRouter);
app.use('/api/v1/notifications', authenticate, standardLimiter, notificationRoutes);
app.use('/api/v1/attendance', authenticate, standardLimiter, attendanceRouter);
app.use('/api/v1/parents', authenticate, standardLimiter, parentRoutes);
app.use('/api/v1/gamification', authenticate, standardLimiter, gamificationRoutes);
app.use('/api/v1/analytics', authenticate, standardLimiter, analyticsRoutes);
app.use('/api/v1/certificates', authenticate, standardLimiter, certificateRoutes);
app.use('/api/v1/halaqa', authenticate, standardLimiter, halaqaRoutes);

// Legacy redirects (optional - remove after mobile update)
// Mirroring exact same middleware stack as v1 for consistent protection
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/users', authenticate, standardLimiter, usersRouter);
app.use('/api/appointments', authenticate, standardLimiter, appointmentsRouter);
app.use('/api/grades', authenticate, standardLimiter, gradesRouter);
app.use('/api/recordings', authenticate, uploadLimiter, recordingRoutes);
app.use('/api/reports', authenticate, standardLimiter, reportRoutes);
app.use('/api/admin', authenticate, adminLimiter, adminRouter);
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
