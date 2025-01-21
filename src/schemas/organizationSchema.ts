import { z } from 'zod';

export const organizationSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    domain: z.string().optional(),
    settings: z.record(z.any()).optional(),
    subscription_tier: z.enum(['free', 'pro', 'enterprise']).optional()
  })
});

export type OrganizationInput = z.infer<typeof organizationSchema>['body']; 