import { z } from 'zod';

const queueRuleConditionSchema = z.object({
  field: z.enum(['priority', 'tags', 'category', 'status']),
  operator: z.enum(['equals', 'contains']),
  value: z.any()
}).required();

const queueRuleActionSchema = z.object({
  type: z.enum(['assign_queue']),
  value: z.any()
}).required();

const queueRuleSchema = z.object({
  conditions: z.array(queueRuleConditionSchema),
  actions: z.array(queueRuleActionSchema)
}).required();

export const createQueueConfigurationSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    rules: z.array(queueRuleSchema),
    is_default: z.boolean().default(false),
    position: z.number().int().positive().optional()
  })
});

export const updateQueueConfigurationSchema = createQueueConfigurationSchema.partial();

export const createSLAPolicySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    priority: z.enum(['p1', 'p2', 'p3', 'p4']),
    first_response_time: z.string(),
    resolution_time: z.string(),
    business_hours: z.boolean().default(true)
  })
});

export const updateSLAPolicySchema = createSLAPolicySchema.partial();

const ticketWeightRuleSchema = z.object({
  condition: z.object({
    field: z.enum(['priority', 'status', 'category']),
    operator: z.enum(['equals', 'contains']),
    value: z.any()
  }).required(),
  weight: z.number().positive()
}).required();

export const createWorkloadRuleSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    max_tickets_per_agent: z.number().int().positive(),
    ticket_weight_rules: z.array(ticketWeightRuleSchema),
    is_active: z.boolean().default(true)
  })
});

export const updateWorkloadRuleSchema = createWorkloadRuleSchema.partial();