import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { consentMiddleware } from './middleware/consent';

// Routes
import authRoutes from './routes/auth';
import scanRoutes from './routes/scan';
import aiRoutes from './routes/ai';
import riskRoutes from './routes/risk';
import chatRoutes from './routes/chat';
import reminderRoutes from './routes/reminders';
import lockerRoutes from './routes/locker';
import hospitalRoutes from './routes/hospital';
import prescriptionRoutes from './routes/prescriptions';
import userRoutes from './routes/users';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', '*.googleapis.com'],
    },
  },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d{4}$/.test(origin)) {
      callback(null, true);
    } else if (origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,
  message: { success: false, error: 'AI rate limit reached. Please wait a moment.' },
});

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'MediAI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Public Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Protected Routes ─────────────────────────────────────────────────────────
app.use('/api', authMiddleware);
app.use('/api', consentMiddleware);

app.use('/api/users', userRoutes);
app.use('/api/scan', aiLimiter, scanRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/chat', aiLimiter, chatRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/locker', lockerRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/hospital', hospitalRoutes);

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 MediAI Backend running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
});

export default app;
