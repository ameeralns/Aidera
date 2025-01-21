import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { cacheService } from '../services/cacheService';

export const createOrganization = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, settings } = req.body;

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        description,
        settings,
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);

    res.status(201).json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error creating organization', 500);
  }
};

export const getOrganization = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cacheKey = `org:${id}`;
    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new AppError(error.message, 400);
    if (!data) throw new AppError('Organization not found', 404);

    // Cache for 5 minutes
    await cacheService.set(cacheKey, data, 300);

    res.json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error fetching organization', 500);
  }
};

export const updateOrganization = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, settings } = req.body;

    const { data, error } = await supabase
      .from('organizations')
      .update({
        name,
        description,
        settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);
    if (!data) throw new AppError('Organization not found', 404);

    // Invalidate cache
    await cacheService.invalidate(`org:${id}`);

    res.json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error updating organization', 500);
  }
};

export const deleteOrganization = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', id)
      .single();

    if (orgError || !org) throw new AppError('Organization not found', 404);

    // Delete organization
    const { error: deleteError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (deleteError) throw new AppError(deleteError.message, 400);

    // Invalidate cache
    await cacheService.invalidate(`org:${id}`);
    await cacheService.invalidate(`org:${id}:*`);

    res.status(204).send();
  } catch (error: any) {
    throw new AppError(error?.message || 'Error deleting organization', 500);
  }
}; 