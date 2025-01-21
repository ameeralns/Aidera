import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { AppError } from '../middleware/errorHandler';

export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  const category = await KnowledgeBaseService.createCategory(
    req.body,
    req.user.organization_id
  );
  res.status(201).json(category);
};

export const getCategoryHierarchy = async (req: AuthenticatedRequest, res: Response) => {
  const categories = await KnowledgeBaseService.getCategoryHierarchy(
    req.user.organization_id
  );
  res.json(categories);
};

export const createArticle = async (req: AuthenticatedRequest, res: Response) => {
  const article = await KnowledgeBaseService.createArticle(
    req.body,
    req.user.id,
    req.user.organization_id
  );
  res.status(201).json(article);
};

export const updateArticle = async (req: AuthenticatedRequest, res: Response) => {
  const article = await KnowledgeBaseService.updateArticle(
    req.params.id,
    req.body,
    req.user.id
  );
  res.json(article);
};

export const searchArticles = async (req: AuthenticatedRequest, res: Response) => {
  const { query, category_id, tags, page, limit } = req.query;

  if (!query || typeof query !== 'string') {
    throw new AppError('Search query is required', 400);
  }

  const results = await KnowledgeBaseService.searchArticles(
    query,
    req.user.organization_id,
    {
      categoryId: category_id as string,
      tags: typeof tags === 'string' ? tags.split(',') : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    }
  );
  res.json(results);
};

export const viewArticle = async (req: AuthenticatedRequest, res: Response) => {
  await KnowledgeBaseService.recordView(req.params.id);
  res.status(204).send();
};

export const submitFeedback = async (req: AuthenticatedRequest, res: Response) => {
  const { is_helpful, comment } = req.body;
  await KnowledgeBaseService.submitFeedback(
    req.params.id,
    req.user?.id,
    is_helpful,
    comment
  );
  res.status(204).send();
};

export const getArticleVersions = async (req: AuthenticatedRequest, res: Response) => {
  const versions = await KnowledgeBaseService.getArticleVersions(req.params.id);
  res.json(versions);
}; 