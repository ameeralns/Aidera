import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { AppError } from './errorHandler';
import { DatabaseService } from '../services/databaseService';
import { supabase } from '../config/supabase';

export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userRole = await DatabaseService.getUserRole(req.user.id);
      
      if (!allowedRoles.includes(userRole)) {
        throw new AppError('Insufficient permissions', 403);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireTeamMembership = (teamIdParam: string = 'team_id') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teamId = req.params[teamIdParam];
      const { data: team } = await supabase
        .from('teams')
        .select('members')
        .eq('id', teamId)
        .single();

      if (!team?.members.includes(req.user.id)) {
        throw new AppError('Not a team member', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireTicketAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const ticketId = req.params.ticket_id;
    const userRole = await DatabaseService.getUserRole(req.user.id);

    const { data: ticket } = await supabase
      .from('tickets')
      .select('created_by, assigned_to, organization_id')
      .eq('id', ticketId)
      .single();

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    const hasAccess = 
      userRole === 'admin' ||
      ticket.created_by === req.user.id ||
      ticket.assigned_to === req.user.id ||
      (userRole === 'agent' && ticket.organization_id === req.user.organization_id);

    if (!hasAccess) {
      throw new AppError('Insufficient permissions', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}; 