import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      details: err.details
    });
  }

  console.error('Error:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
}; 