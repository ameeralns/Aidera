import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { Request } from 'express';
import { env } from '../config/env';

let store: RedisStore | undefined;

if (env.REDIS_URL) {
  try {
    const redisClient = createClient({
      url: env.REDIS_URL
    });

    redisClient.connect().catch(() => {
      console.warn('Redis connection failed, falling back to memory store for rate limiting');
      store = undefined;
    });

    store = new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    });
  } catch (error) {
    console.warn('Redis initialization failed, falling back to memory store for rate limiting');
    store = undefined;
  }
}

export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  max: number = 100 // limit each IP to 100 requests per windowMs
) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: store, // Will use memory store if Redis is not available
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      return user?.organization_id || req.ip;
    }
  });
}; 