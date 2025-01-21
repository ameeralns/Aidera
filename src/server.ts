import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimiter';
import ticketRoutes from './routes/ticketRoutes';
import userRoutes from './routes/userRoutes';
import organizationRoutes from './routes/organizationRoutes';
import teamRoutes from './routes/teamRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import knowledgeBaseRoutes from './routes/knowledgeBaseRoutes';
import queueRoutes from './routes/queueRoutes';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './middleware/errorHandler';
import { supabase, supabaseAdmin } from './config/supabase';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Health check route
app.get('/', async (req: Request, res: Response) => {
  try {
    // Test database connection with a simple query
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1);
    
    res.json({
      status: 'success',
      message: 'Server is running',
      database: error ? 'disconnected' : 'connected',
      database_error: error ? error.message : null,
      supabase_url: process.env.SUPABASE_URL,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error checking database connection',
      error: err instanceof Error ? err.message : 'Unknown error',
      supabase_url: process.env.SUPABASE_URL
    });
  }
});

// Rate limiting
const apiLimiter = createRateLimiter();
app.use('/api/', apiLimiter);

// Routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/kb', knowledgeBaseRoutes);
app.use('/api/queues', queueRoutes);

// Error handling - must be last
app.use((err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  return errorHandler(err, req, res, next);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// For testing
export default app; 