import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { updateProfileSchema } from '../schemas/userSchema';

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) throw new AppError(error.message, 400);
  res.json(data);
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(req.body)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 400);
  res.json(data);
};

export const listUsers = async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', req.user.organization_id);

  if (error) throw new AppError(error.message, 400);
  res.json(data);
}; 