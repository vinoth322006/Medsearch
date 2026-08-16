import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/error';
import apiRoutes from './routes';
import { redis } from './cache';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true, allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'], methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

app.get('/', (_req, res) => res.json({ name: 'MedSearch API', status: 'ok', ts: new Date().toISOString() }));
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => logger.info(`MedSearch backend listening on :${config.port} (${config.nodeEnv})`));

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((sig) =>
  process.on(sig, () => {
    logger.info({ sig }, 'shutting down');
    server.close(() => {
      redis.quit().finally(() => process.exit(0));
    });
  })
);
