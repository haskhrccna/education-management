import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import appointmentRoutes from './routes/appointment.routes';
import gradeRoutes from './routes/grade.routes';
import recordingRoutes from './routes/recording.routes';
import reportRoutes from './routes/report.routes';
import adminRoutes from './routes/admin.routes';
import messageRoutes from './routes/message.routes';
import fileRoutes from './routes/file.routes';
import docsRoutes from './routes/docs.routes';
import metricsRoutes from './routes/metrics.routes';
import { errorHandler } from './middleware/error.middleware';
import { requestId } from './middleware/request-id.middleware';
import { timeout } from './middleware/timeout.middleware';
import { requestLogger } from './lib/logger';
import { config } from './config';

const app: Application = express();

// Request ID + Timeout
app.use(requestId);
app.use(timeout());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.env === 'production',
  crossOriginEmbedderPolicy: config.env === 'production',
}));
app.use(cors({
  origin: config.env === 'production' ? process.env.CLIENT_URL || false : '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts, please try again later' },
});

app.use(limiter);
app.use(requestLogger);
app.use(express.json({ limit: '50mb' }));

// API Docs & Metrics
app.use('/api/docs', docsRoutes);
app.use('/metrics', metricsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API v1 Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/grades', gradeRoutes);
app.use('/api/v1/recordings', recordingRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/files', fileRoutes);

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

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler
app.use(errorHandler);

export default app;
