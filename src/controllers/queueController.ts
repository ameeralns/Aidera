import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { QueueService } from '../services/queueService';
import { AppError } from '../middleware/errorHandler';
import {
  createQueueConfigurationSchema,
  createSLAPolicySchema,
  createWorkloadRuleSchema
} from '../schemas/queueSchemas';

export async function createQueueConfiguration(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const validatedData = createQueueConfigurationSchema.parse(req.body).body;
  const config = await QueueService.createQueueConfiguration(
    validatedData,
    req.user.organization_id
  );
  res.status(201).json(config);
}

export async function getQueueConfigurations(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const configs = await QueueService.getQueueConfigurations(
    req.user.organization_id
  );
  res.json(configs);
}

export async function createSLAPolicy(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const validatedData = createSLAPolicySchema.parse(req.body).body;
  const policy = await QueueService.createSLAPolicy(
    validatedData,
    req.user.organization_id
  );
  res.status(201).json(policy);
}

export async function getSLAPolicies(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const policies = await QueueService.getSLAPolicies(
    req.user.organization_id
  );
  res.json(policies);
}

export async function createWorkloadRule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const validatedData = createWorkloadRuleSchema.parse(req.body).body;
  const rule = await QueueService.createWorkloadRule(
    validatedData,
    req.user.organization_id
  );
  res.status(201).json(rule);
}

export async function getWorkloadRules(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const rules = await QueueService.getWorkloadRules(
    req.user.organization_id
  );
  res.json(rules);
}

export async function assignTicketToQueue(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { ticketId } = req.params;
  
  if (!ticketId) {
    throw new AppError('Ticket ID is required', 400);
  }

  await QueueService.assignTicketToQueue(
    ticketId,
    req.user.organization_id
  );
  res.status(204).send();
}

export async function assignTicketToAgent(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { ticketId } = req.params;
  
  if (!ticketId) {
    throw new AppError('Ticket ID is required', 400);
  }

  const assignedAgentId = await QueueService.assignTicketToAgent(
    ticketId,
    req.user.organization_id
  );

  if (!assignedAgentId) {
    throw new AppError('No available agents found', 404);
  }

  res.json({ assigned_to: assignedAgentId });
} 