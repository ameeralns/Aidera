import { Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest, ErrorLogData } from '../types';

export const errorTracker = async (
  error: Error | AppError,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const errorData: ErrorLogData = {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      path: req.path,
      method: req.method,
      query_params: req.query,
      body: req.body,
      user_id: req.user?.id,
      organization_id: req.user?.organization_id,
      timestamp: new Date().toISOString()
    };

    // Log error to Supabase
    await supabaseAdmin
      .from('error_logs')
      .insert(errorData);

  } catch (loggingError) {
    console.error('Error logging failed:', loggingError);
  }

  next(error);
}; 