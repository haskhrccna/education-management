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
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { config } from './config';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.env === 'production' ? process.env.CLIENT_URL || false : '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
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
