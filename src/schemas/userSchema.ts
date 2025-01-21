import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string()
  })
}); 