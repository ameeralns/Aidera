import { z } from 'zod';

export const workScheduleSchema = z.object({
  timezone: z.string().min(1),
  shifts: z.array(
    z.object({
      day: z.number().min(0).max(6),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    })
  ).min(1)
});

export const createTeamSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(500).optional(),
    lead_id: z.string().uuid(),
    members: z.array(z.string().uuid()),
    skills: z.array(z.string()),
    schedule: workScheduleSchema
  })
});

export const updateTeamMembersSchema = z.object({
  body: z.object({
    members: z.array(z.string().uuid())
  })
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>['body'];
export type UpdateTeamMembersInput = z.infer<typeof updateTeamMembersSchema>['body']; 