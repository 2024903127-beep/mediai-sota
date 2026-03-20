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
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

export class AppError extends Error {
  constructor(public message: string, public status: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}
