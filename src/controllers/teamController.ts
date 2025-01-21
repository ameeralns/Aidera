import { Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { Team, User } from '../types';
import { cacheService } from '../services/cacheService';

export const createTeam = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, lead_id, members, skills, schedule } = req.body;

    const team: Partial<Team> = {
      name,
      description,
      organization_id: req.user.organization_id,
      lead_id,
      members: members || [],
      skills: skills || [],
      schedule
    };

    const { data, error } = await supabase
      .from('teams')
      .insert(team)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);

    // Invalidate relevant caches
    await cacheService.invalidate(`org:${req.user.organization_id}:teams:*`);

    res.status(201).json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error creating team', 500);
  }
};

export const getTeam = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { team_id } = req.params;
    const cacheKey = `team:${team_id}`;
    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', team_id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (error) throw new AppError(error.message, 400);
    if (!data) throw new AppError('Team not found', 404);

    // Cache for 5 minutes
    await cacheService.set(cacheKey, data, 300);

    res.json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error fetching team', 500);
  }
};

export const getTeamPerformance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { team_id } = req.params;
    const { start_date, end_date } = req.query;

    const cacheKey = `team:${team_id}:performance:${start_date}:${end_date}`;
    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const { data, error } = await supabaseAdmin.rpc('calculate_team_performance', {
      p_team_id: team_id,
      p_start_date: start_date,
      p_end_date: end_date
    });

    if (error) throw new AppError(error.message, 400);

    // Cache results
    await cacheService.set(cacheKey, data, 300); // Cache for 5 minutes

    res.json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error fetching team performance', 500);
  }
};

export const getOrganizationWorkload = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cacheKey = `org:${req.user.organization_id}:workload`;
    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const { data, error } = await supabaseAdmin.rpc('get_team_workload', {
      p_organization_id: req.user.organization_id
    });

    if (error) throw new AppError(error.message, 400);

    // Cache results
    await cacheService.set(cacheKey, data, 60); // Cache for 1 minute due to frequent updates

    res.json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error fetching organization workload', 500);
  }
};

export const updateTeamMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { team_id } = req.params;
    const { members_to_add, members_to_remove } = req.body;

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('members')
      .eq('id', team_id)
      .single();

    if (teamError) throw new AppError(teamError.message, 400);

    const currentMembers = new Set(team.members);
    
    // Add new members
    members_to_add?.forEach((id: string) => currentMembers.add(id));
    
    // Remove members
    members_to_remove?.forEach((id: string) => currentMembers.delete(id));

    const { error: updateError } = await supabase
      .from('teams')
      .update({ members: Array.from(currentMembers) })
      .eq('id', team_id);

    if (updateError) throw new AppError(updateError.message, 400);

    // Invalidate relevant caches
    await cacheService.invalidate(`team:${team_id}:*`);

    res.json({ success: true, members: Array.from(currentMembers) });
  } catch (error: any) {
    throw new AppError(error?.message || 'Error updating team members', 500);
  }
};

export const deleteTeam = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { team_id } = req.params;

    // Verify team exists and belongs to user's organization
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', team_id)
      .eq('organization_id', req.user.organization_id)
      .single();

    if (teamError || !team) throw new AppError('Team not found', 404);

    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', team_id);

    if (deleteError) throw new AppError(deleteError.message, 400);

    // Invalidate relevant caches
    await cacheService.invalidate(`team:${team_id}:*`);
    await cacheService.invalidate(`org:${req.user.organization_id}:teams:*`);

    res.status(204).send();
  } catch (error: any) {
    throw new AppError(error?.message || 'Error deleting team', 500);
  }
}; 