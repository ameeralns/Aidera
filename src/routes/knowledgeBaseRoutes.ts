import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateUser } from '../middleware/auth';
import {
  createCategory,
  getCategoryHierarchy,
  createArticle,
  updateArticle,
  searchArticles,
  viewArticle,
  submitFeedback,
  getArticleVersions
} from '../controllers/knowledgeBaseController';
import {
  createCategorySchema,
  createArticleSchema,
  updateArticleSchema,
  searchArticlesSchema,
  articleFeedbackSchema
} from '../schemas/knowledgeBaseSchemas';

const router = Router();

router.use(authenticateUser);

router.post('/categories', validateRequest({ body: createCategorySchema }), createCategory);
router.get('/categories/hierarchy', getCategoryHierarchy);

router.post('/articles', validateRequest({ body: createArticleSchema }), createArticle);
router.patch('/articles/:id', validateRequest({ body: updateArticleSchema }), updateArticle);
router.get('/articles/search', validateRequest({ query: searchArticlesSchema }), searchArticles);
router.post('/articles/:id/view', viewArticle);
router.post('/articles/:id/feedback', validateRequest({ body: articleFeedbackSchema }), submitFeedback);
router.get('/articles/:id/versions', getArticleVersions);

export default router; 