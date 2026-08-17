import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

// Never leak stack traces in prod; always log structured.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Validation errors → 400 with structured issues (never 500).
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }

  const status = (err as { status?: number }).status ?? 500;
  // 4xx are expected client errors — warn, don't pollute the error stream.
  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'unhandled error');
  } else {
    logger.warn({ err: { message: err.message, status }, path: req.path, method: req.method }, 'client error');
  }
  res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message ?? 'Internal server error',
  });
};

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};
