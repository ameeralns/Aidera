import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import {
  getTicketMetrics,
  getAgentPerformance,
  getCustomerSatisfaction,
  getResponseMetrics
} from '../controllers/analyticsController';

const router = Router();

router.use(authenticateUser);

router.get('/tickets', getTicketMetrics);
router.get('/agent-performance', getAgentPerformance);
router.get('/customer-satisfaction', getCustomerSatisfaction);
router.get('/response-metrics', getResponseMetrics);

export default router; 