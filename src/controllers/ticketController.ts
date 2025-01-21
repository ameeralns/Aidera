import { Request, Response } from 'express';
import { ParsedQs } from 'qs';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { Ticket } from '../types';
import { publishWebhook } from '../services/webhookService';
import { cacheService } from '../services/cacheService';
import { AuthenticatedRequest } from '../middleware/auth';

export const createTicket = async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, priority, team_id, tags } = req.body;
  
  try {
    // Implement intelligent routing
    const assignedAgent = await routeTicketToAgent(req.body, req.user.organization_id);
    
    const ticket = {
      title,
      description,
      priority,
      team_id,
      tags,
      created_by: req.user.id,
      assigned_to: assignedAgent?.id,
      organization_id: req.user.organization_id,
      status: 'open',
      metadata: {}
    };

    const { data, error } = await supabase
      .from('tickets')
      .insert(ticket)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);

    // Trigger webhooks
    await publishWebhook('ticket.created', data);

    // Invalidate relevant caches
    await cacheService.invalidate(`org:${req.user.organization_id}:tickets`);

    res.status(201).json(data);
  } catch (error: any) {
    throw new AppError(error.message || 'Internal server error', 500);
  }
};

export const listTickets = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      status,
      priority,
      assigned_to,
      team_id,
      page = '1',
      limit = '20',
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    // Convert pagination params to numbers
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    // Try to get from cache first
    const cacheKey = `org:${req.user.organization_id}:tickets:${JSON.stringify(req.query)}`;
    const cachedResult = await cacheService.get(cacheKey);
    
    if (cachedResult) {
      return res.json(cachedResult);
    }

    let query = supabase
      .from('tickets')
      .select(`
        *,
        created_by:profiles!tickets_created_by_fkey(*),
        assigned_to:profiles!tickets_assigned_to_fkey(*),
        comments(*)
      `)
      .eq('organization_id', req.user.organization_id);

    // Apply filters
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (team_id) query = query.eq('team_id', team_id);

    // Apply pagination with proper types
    const offset = (pageNum - 1) * limitNum;
    query = query.order(sort as string, { ascending: order === 'asc' })
                 .range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) throw new AppError(error.message, 400);

    const result = {
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        pages: Math.ceil((count || 0) / limitNum)
      }
    };

    // Cache the result
    await cacheService.set(cacheKey, result, 300); // Cache for 5 minutes

    res.json(result);
  } catch (error: any) {
    throw new AppError(error.message || 'Internal server error', 500);
  }
};

// Implement intelligent routing logic
async function routeTicketToAgent(ticketData: Partial<Ticket>, orgId: string) {
  try {
    // Get available agents based on skills and workload
    const { data: agents } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        tickets!tickets_assigned_to_fkey(count)
      `)
      .eq('organization_id', orgId)
      .eq('role', 'agent')
      .contains('skills', ticketData.tags || []);

    if (!agents?.length) return null;

    // Sort agents by workload and skills match
    const sortedAgents = agents.sort((a, b) => {
      const aWorkload = a.tickets?.[0]?.count || 0;
      const bWorkload = b.tickets?.[0]?.count || 0;
      return aWorkload - bWorkload;
    });

    return sortedAgents[0];
  } catch (error) {
    console.error('Error routing ticket:', error);
    return null;
  }
} 