import { z } from 'zod';

export const updateProfileSchema = z.object({
  full_name: z.string().optional(),
  skills: z.array(z.string()).optional(),
  settings: z.record(z.any()).optional()
}); 