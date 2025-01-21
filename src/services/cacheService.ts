import { createClient } from 'redis';
import { env } from '../config/env';

interface CacheService {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttlSeconds: number) => Promise<void>;
  invalidate: (key: string) => Promise<void>;
}

// Simple in-memory cache implementation
class MemoryCacheService implements CacheService {
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

export const cacheService = new MemoryCacheService(); 