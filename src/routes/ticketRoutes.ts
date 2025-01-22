import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateUser } from '../middleware/auth';
import { TicketService } from '../services/ticketService';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

// Define the AuthenticatedRequest type locally
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: 'customer' | 'agent' | 'admin';
    organization_id: string;
  };
}

const router = Router();

// Validation schema for ticket query parameters
const ticketQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sort_field: z.enum(['created_at', 'updated_at', 'status', 'priority', 'title']).default('created_at'),
  sort_direction: z.enum(['asc', 'desc']).default('desc'),
  customer_id: z.string().optional()
});

const createTicket: RequestHandler = async (req, res, next) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const ticket = await TicketService.create(authenticatedReq.body, authenticatedReq.user.id);
    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
};

const getTicketsByCustomerId: RequestHandler = async (req, res, next) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const validatedQuery = ticketQuerySchema.parse(req.query);
    
    console.log('Authenticated User:', authenticatedReq.user);
    console.log('Validated Query:', validatedQuery);
    
    // For customers, use their own ID. For agents/admins, allow querying other customers
    const customerId = authenticatedReq.user.role === 'customer' 
      ? authenticatedReq.user.id 
      : (validatedQuery.customer_id || authenticatedReq.user.id);
      
    console.log('Using Customer ID:', customerId);
    
    const result = await TicketService.getByCustomerId(
      customerId,
      authenticatedReq.user.organization_id,
      validatedQuery
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error in getTicketsByCustomerId:', error);
    next(error);
  }
};

// Apply authentication middleware to all routes
router.use(authenticateUser);

router.post('/', createTicket);
router.get('/', getTicketsByCustomerId);

export default router; 