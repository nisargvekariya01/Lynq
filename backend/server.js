import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import redisClient, { connectRedis } from './config/redis.js';
import pool, { initDb } from './config/db.js';
import env from './config/env.js';
import urlRoutes from './routes/urlRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { handleRedirect } from './controllers/urlController.js';
import { createLimiters } from './middlewares/rateLimiter.js';
import { enforceHttps } from './middlewares/security.js';
import errorHandler from './middlewares/errorHandler.js';
import { startAnalyticsWorker } from './workers/analyticsWorker.js';

const app = express();
app.set('trust proxy', 1); // Crucial for Render/Vercel Load Balancers (fixes IP rate limiting!)

// ── Security & Performance Middleware ────────────────────────────────────────
app.use(enforceHttps);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      env.baseUrl,
      env.frontendUrl, // Crucial for Vercel deployment!
    ],
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  let redisStatus = 'disconnected';

  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'error';
  }

  try {
    const ping = await redisClient.ping();
    if (ping === 'PONG') redisStatus = 'connected';
  } catch (e) {
    redisStatus = 'error';
  }

  res.json({
    status: dbStatus === 'connected' && redisStatus === 'connected' ? 'ok' : 'degraded',
    db: dbStatus,
    redis: redisStatus,
    ts: new Date().toISOString()
  });
});

const start = async () => {
  try {
    // ── Connect Redis + PostgreSQL in parallel for faster startup ──────────────
    await Promise.all([connectRedis(), initDb()]);

    // ── Start Background Workers ──────────────────────────────────────────────
    startAnalyticsWorker();

    // ── Register rate limiters AFTER Redis is connected ───────────────────────
    // (RedisStore init requires an active Redis client)
    const { apiLimiter, shortenLimiter, bulkLimiter } = createLimiters();
    app.use('/api', apiLimiter);
    app.use('/api/shorten', shortenLimiter);      // 10 shortens per minute
    app.use('/api/bulk-shorten', bulkLimiter);    // 1 bulk upload per hour

    // ── API Routes ───────────────────────────────────────────────────────────
    app.use('/api', urlRoutes);
    app.use('/api/ai', aiRoutes);

    // ── Short Code Redirect ──────────────────────────────────────────────────
    // Must come AFTER /api/* routes to avoid conflicts
    app.get('/:shortCode', handleRedirect);

    // ── 404 Handler ─────────────────────────────────────────────────────────
    app.use((_req, res) => {
      res.status(404).json({ success: false, error: 'Route not found.' });
    });

    // ── Centralised Error Handler ────────────────────────────────────────────
    app.use(errorHandler);

    app.listen(env.port, () => {
      console.log(`🚀 Lynq backend running on http://localhost:${env.port}`);
      console.log(`   BASE_URL → ${env.baseUrl}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();

