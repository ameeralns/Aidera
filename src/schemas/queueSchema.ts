import { z } from 'zod';

const queueRuleConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'in']),
  value: z.any()
});

const queueRuleActionSchema = z.object({
  type: z.enum(['assign_team', 'set_priority', 'set_sla_policy']),
  value: z.any()
});

const queueRuleSchema = z.object({
  condition: queueRuleConditionSchema,
  actions: z.array(queueRuleActionSchema)
});

export const createQueueConfigurationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  rules: z.array(queueRuleSchema).default([]),
  is_default: z.boolean().default(false)
});

export const updateQueueConfigurationSchema = createQueueConfigurationSchema.partial();

export const createSLAPolicySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(['p1', 'p2', 'p3', 'p4']),
  first_response_time: z.string().regex(/^(\d+\s*(minutes|hours|days))+$/),
  resolution_time: z.string().regex(/^(\d+\s*(minutes|hours|days))+$/),
  business_hours: z.boolean().default(true)
});

export const updateSLAPolicySchema = createSLAPolicySchema.partial();

const ticketWeightRuleSchema = z.object({
  condition: z.object({
    field: z.string(),
    operator: z.enum(['equals', 'contains']),
    value: z.any()
  }),
  weight: z.number().min(0).max(100)
});

export const createWorkloadRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  max_tickets_per_agent: z.number().int().min(1),
  ticket_weight_rules: z.array(ticketWeightRuleSchema).default([]),
  is_active: z.boolean().default(true)
});

export const updateWorkloadRuleSchema = createWorkloadRuleSchema.partial(); 