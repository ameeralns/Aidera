import { Router, RequestHandler } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateUser } from '../middleware/auth';
import { TicketService } from '../services/ticketService';
import { AuthenticatedRequest } from '../types';
import { Response, NextFunction } from 'express';

const router = Router();

router.use(authenticateUser);

// Properly type the request handler
const createTicket: RequestHandler = async (req, res, next) => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const ticket = await TicketService.create(authenticatedReq.body, authenticatedReq.user.id);
    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
};

router.post('/', createTicket);

export default router; 