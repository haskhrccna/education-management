import './types/express';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import docsRoutes from './routes/docs.routes';
import metricsRoutes from './routes/metrics.routes';
import verifyRoutes from './routes/verify.routes';
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
import { recurringSlotsRouter } from './modules/recurring-slots/recurring-slots.module';
import { weakAyahsRouter } from './modules/weak-ayahs/weak-ayahs.module';
import { curriculumPlansRouter } from './modules/curriculum-plans/curriculum-plans.module';
import { milestonesRouter } from './modules/milestones/milestones.module';
import { ijazahsRouter } from './modules/ijazahs/ijazahs.module';
import { certificatesRouter } from './modules/certificates/certificates.module';
import { accountRouter } from './modules/account/account.module';
import { recordingsRouter } from './modules/recordings/recordings.module';
import { reportsRouter } from './modules/reports/reports.module';
import { filesRouter } from './modules/files/files.module';
import { exportsRouter } from './modules/exports/exports.module';
import { messagesRouter } from './modules/messages/messages.module';
import { notificationsRouter } from './modules/notifications/notifications.module';
import { gamificationRouter } from './modules/gamification/gamification.module';
import { analyticsRouter } from './modules/analytics/analytics.module';
import { parentsRouter } from './modules/parents/parents.module';
import { halaqaRouter } from './modules/halaqa/halaqa.module';
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
app.use('/api/v1/recordings', authenticate, uploadLimiter, recordingsRouter);
app.use('/api/v1/reports', authenticate, standardLimiter, reportsRouter);
app.use('/api/v1/admin', authenticate, adminLimiter, adminRouter);
app.use('/api/v1/messages', authenticate, standardLimiter, messagesRouter);
app.use('/api/v1/surahs', authenticate, standardLimiter, surahsRouter);
app.use('/api/v1/memorization', authenticate, standardLimiter, memorizationRouter);
app.use('/api/v1/mushaf', authenticate, standardLimiter, mushafRouter);
app.use('/api/v1/roster', authenticate, standardLimiter, rosterRouter);
app.use('/api/v1/parent-links', authenticate, standardLimiter, parentLinksRouter);
app.use('/api/v1/recurring-slots', authenticate, standardLimiter, recurringSlotsRouter);
app.use('/api/v1/weak-ayahs', authenticate, standardLimiter, weakAyahsRouter);
app.use('/api/v1/curriculum-plans', authenticate, standardLimiter, curriculumPlansRouter);
app.use('/api/v1/milestones', authenticate, standardLimiter, milestonesRouter);
app.use('/api/v1/ijazahs', authenticate, standardLimiter, ijazahsRouter);
app.use('/api/v1/files', standardLimiter, filesRouter); // fileAuthenticate applied per-contract (authVia)
app.use('/api/v1/exports', authenticate, standardLimiter, exportsRouter);
app.use('/api/v1/teacher-changes', authenticate, standardLimiter, teacherChangeRouter);
app.use('/api/v1/revisions', authenticate, standardLimiter, revisionsRouter);
app.use('/api/v1/notifications', authenticate, standardLimiter, notificationsRouter);
app.use('/api/v1/attendance', authenticate, standardLimiter, attendanceRouter);
app.use('/api/v1/parents', authenticate, standardLimiter, parentsRouter);
app.use('/api/v1/gamification', authenticate, standardLimiter, gamificationRouter);
app.use('/api/v1/analytics', authenticate, standardLimiter, analyticsRouter);
app.use('/api/v1/certificates', authenticate, standardLimiter, certificatesRouter);
app.use('/api/v1/account', authenticate, standardLimiter, accountRouter);
// Public, no-login verification page — deliberately NOT behind authenticate.
app.use('/api/v1/verify', standardLimiter, verifyRoutes);
app.use('/api/v1/halaqa', authenticate, standardLimiter, halaqaRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json(errorResponse('Not found'));
});

// Centralized error handler
app.use(errorHandler);

export default app;
