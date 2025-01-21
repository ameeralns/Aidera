import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  parent_id: z.string().uuid().optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  position: z.number().int().min(0).optional()
});

export const updateCategorySchema = createCategorySchema.partial();

export const createArticleSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  metadata: z.record(z.any()).optional().default({})
});

export const updateArticleSchema = createArticleSchema.partial();

export const createArticleVersionSchema = z.object({
  content: z.string().min(1),
  change_summary: z.string().optional()
});

export const articleFeedbackSchema = z.object({
  is_helpful: z.boolean(),
  comment: z.string().optional()
});

export const searchArticlesSchema = z.object({
  query: z.string().min(1),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20)
}); 