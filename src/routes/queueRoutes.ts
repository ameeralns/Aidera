import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateUser } from '../middleware/auth';
import {
  createQueueConfiguration,
  getQueueConfigurations,
  createSLAPolicy,
  getSLAPolicies,
  createWorkloadRule,
  getWorkloadRules,
  assignTicketToQueue,
  assignTicketToAgent
} from '../controllers/queueController';
import {
  createQueueConfigurationSchema,
  createSLAPolicySchema,
  createWorkloadRuleSchema
} from '../schemas/queueSchemas';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Queue Configuration Routes
router.post(
  '/configurations',
  validateRequest({ body: createQueueConfigurationSchema.shape.body }),
  createQueueConfiguration
);
router.get('/configurations', getQueueConfigurations);

// SLA Policy Routes
router.post(
  '/sla-policies',
  validateRequest({ body: createSLAPolicySchema.shape.body }),
  createSLAPolicy
);
router.get('/sla-policies', getSLAPolicies);

// Workload Rule Routes
router.post(
  '/workload-rules',
  validateRequest({ body: createWorkloadRuleSchema.shape.body }),
  createWorkloadRule
);
router.get('/workload-rules', getWorkloadRules);

// Queue Assignment Routes
router.post('/tickets/:ticketId/assign-queue', assignTicketToQueue);
router.post('/tickets/:ticketId/assign-agent', assignTicketToAgent);

export default router; 