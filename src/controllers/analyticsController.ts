import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { cacheService } from '../services/cacheService';

export const getTicketMetrics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const timeframeStr = (req.query.timeframe || '7d') as string;
    const orgId = req.user.organization_id;

    const cacheKey = `analytics:${orgId}:tickets:${timeframeStr}`;
    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Calculate time range
    const now = new Date();
    const startDate = new Date(now.getTime() - getTimeframeInMs(timeframeStr));

    // Get ticket metrics
    const { data: metrics, error } = await supabaseAdmin.rpc('calculate_ticket_metrics', {
      p_organization_id: orgId,
      p_start_date: startDate.toISOString(),
      p_end_date: now.toISOString()
    });

    if (error) throw new AppError(error.message, 400);

    const result = {
      timeframe: timeframeStr,
      metrics,
      generated_at: now
    };

    // Cache results
    await cacheService.set(cacheKey, result, 300); // Cache for 5 minutes

    res.json(result);
  } catch (error: any) {
    throw new AppError(error?.message || 'An error occurred', 500);
  }
};

export const getAgentPerformance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const timeframeStr = (req.query.timeframe || '7d') as string;
    const agentId = req.query.agent_id as string;
    const orgId = req.user.organization_id;

    const { data, error } = await supabaseAdmin.rpc('calculate_agent_performance', {
      p_agent_id: agentId,
      p_organization_id: orgId,
      p_timeframe: timeframeStr
    });

    if (error) throw new AppError(error.message, 400);

    res.json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'An error occurred', 500);
  }
};

export const getCustomerSatisfaction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query as { start_date: string; end_date: string };
    const orgId = req.user.organization_id;

    const cacheKey = `analytics:${orgId}:satisfaction:${start_date}:${end_date}`;
    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const { data, error } = await supabaseAdmin.rpc('calculate_customer_satisfaction', {
      p_organization_id: orgId,
      p_start_date: start_date,
      p_end_date: end_date
    });

    if (error) throw new AppError(error.message, 400);

    // Cache results
    await cacheService.set(cacheKey, data, 300); // Cache for 5 minutes

    res.json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error fetching customer satisfaction metrics', 500);
  }
};

export const getResponseMetrics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query as { start_date: string; end_date: string };
    const orgId = req.user.organization_id;

    const cacheKey = `analytics:${orgId}:response:${start_date}:${end_date}`;
    const cachedData = await cacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const { data, error } = await supabaseAdmin.rpc('calculate_response_metrics', {
      p_organization_id: orgId,
      p_start_date: start_date,
      p_end_date: end_date
    });

    if (error) throw new AppError(error.message, 400);

    // Cache results
    await cacheService.set(cacheKey, data, 300); // Cache for 5 minutes

    res.json(data);
  } catch (error: any) {
    throw new AppError(error?.message || 'Error fetching response metrics', 500);
  }
};

function getTimeframeInMs(timeframe: string): number {
  const units: Record<string, number> = {
    h: 3600000,
    d: 86400000,
    w: 604800000,
    m: 2592000000
  };

  const value = parseInt(timeframe);
  const unit = timeframe.slice(-1);

  return value * (units[unit] || units.d);
} 