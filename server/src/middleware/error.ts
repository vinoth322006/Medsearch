import { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../utils/logger';

// Never leak stack traces in prod; always log structured.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = (err as { status?: number }).status ?? 500;
  logger.error({ err, path: req.path, method: req.method }, 'unhandled error');
  res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message ?? 'Internal server error',
  });
};

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};
