import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: any;
  isAdmin?: boolean;
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AppError('No authorization header', 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new AppError('Invalid authentication token', 401);
    }

    // Get user's full profile including role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new AppError('Error fetching user profile', 500);
    }

    req.user = {
      ...user,
      ...profile
    };
    req.isAdmin = profile.role === 'admin';
    
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.isAdmin) {
    throw new AppError('Unauthorized - Admin access required', 403);
  }
  next();
}; 