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
import { errorHandler } from './middleware/error.middleware';
import { requestId } from './middleware/request-id.middleware';
import { timeout } from './middleware/timeout.middleware';
import { sanitizeRequestBody, sanitizeResponse } from './middleware/sanitize.middleware';
import { standardLimiter, authLimiter, adminLimiter, uploadLimiter } from './middleware/rate-limit.middleware';
import { requestLogger } from './lib/logger';
import { config } from './config';
import { getHealthStatus } from './lib/health';
import { successResponse } from './lib/response';

const app: Application = express();

// Request ID + Timeout
app.use(requestId);
app.use(timeout());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.env === 'production',
  crossOriginEmbedderPolicy: config.env === 'production',
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
app.use(cors({
  origin: config.env === 'production' ? process.env.CLIENT_URL || false : '*',
  credentials: true,
}));

// Rate limiting
app.use(standardLimiter);
app.use(requestLogger);
app.use(express.json({ limit: '50mb' }));
app.use(sanitizeRequestBody);
app.use(sanitizeResponse);

// API Docs & Metrics
app.use('/api/docs', docsRoutes);
app.use('/metrics', metricsRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(successResponse(health));
});

// API v1 Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/grades', gradeRoutes);
app.use('/api/v1/recordings', uploadLimiter, recordingRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', adminLimiter, adminRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/exports', exportRoutes);

// Legacy redirects (optional - remove after mobile update)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/exports', exportRoutes);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Centralized error handler
app.use(errorHandler);

export default app;
