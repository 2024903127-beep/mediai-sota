import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(err.message, { stack: err.stack });
  const status = (err as { status?: number }).status || 500;
  const code = (err as { code?: string }).code;
  const details = (err as { details?: unknown }).details;
  const payload: Record<string, unknown> = {
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  };
  if (code) payload.code = code;
  if (details !== undefined && process.env.NODE_ENV !== 'production') payload.details = details;
  res.status(status).json(payload);
};

export class AppError extends Error {
  constructor(
    public message: string,
    public status: number = 400,
    public code: string = 'APP_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}
