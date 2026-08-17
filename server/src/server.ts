import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/error';
import apiRoutes from './routes';
import { redis } from './cache';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true, allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'], methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// ── API routes (always first priority) ──────────────────────────────
app.use('/api', apiRoutes);

// ── Production: serve React SPA from /app/public ────────────────────
const CLIENT_DIR = path.join(__dirname, '..', 'public');
if (config.isProd) {
  // Serve static assets (JS, CSS, images) with long-term caching
  app.use(express.static(CLIENT_DIR, {
    maxAge: '1y',
    immutable: true,
    index: false, // don't auto-serve index.html for "/" yet
  }));

  // SPA fallback: any non-API route → index.html (React Router handles it)
  app.get('*', (_req, res, next) => {
    // Don't catch /api routes that fell through
    if (_req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIR, 'index.html'));
  });
} else {
  // Dev mode: simple health check at root
  app.get('/', (_req, res) => res.json({ name: 'MedSearch API', status: 'ok', ts: new Date().toISOString() }));
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => logger.info(`MedSearch backend listening on :${config.port} (${config.nodeEnv})`));

// Fail fast on unhandled rejections / uncaught exceptions so process managers
// restart us cleanly instead of running in an inconsistent state.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  process.exit(1);
});

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((sig) =>
  process.on(sig, () => {
    logger.info({ sig }, 'shutting down');
    server.closeAllConnections();
    server.close(() => {
      redis.quit().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 5000).unref();
  })
);
