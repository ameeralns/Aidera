import { Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { updateProfileSchema } from '../schemas/userSchema';

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.userId;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Request body:', req.body);
    console.log('User ID:', req.user?.id);
    
    if (!req.user?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated'
      });
    }

    // Validate request body
    try {
      const validatedData = updateProfileSchema.parse(req.body);
      console.log('Validated data:', validatedData);

      // Try to update first
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          ...validatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.user.id)
        .select()
        .single();

      // If update fails because profile doesn't exist, create it
      if (updateError && updateError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: req.user.id,
            ...validatedData,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('Create profile error:', createError);
          return res.status(400).json({
            status: 'error',
            message: createError.message
          });
        }

        return res.status(201).json(newProfile);
      }

      if (updateError) {
        console.error('Update profile error:', updateError);
        return res.status(400).json({
          status: 'error',
          message: updateError.message
        });
      }
      
      return res.json(updatedProfile);
    } catch (validationError: any) {
      console.error('Validation error:', validationError);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request body',
        details: validationError.errors
      });
    }
  } catch (error: any) {
    console.error('Profile operation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

export const listUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('organization_id', req.user.organization_id);

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}; 