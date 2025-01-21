import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { DatabaseService } from './databaseService';
import { cacheService } from './cacheService';
import {
  KnowledgeBaseArticle,
  KnowledgeBaseCategory,
  KnowledgeBaseArticleVersion,
  KnowledgeBaseArticleStats,
  KnowledgeBaseArticleFeedback
} from '../types';

export class KnowledgeBaseService {
  // Category operations
  static async createCategory(data: Partial<KnowledgeBaseCategory>, organizationId: string): Promise<KnowledgeBaseCategory> {
    const category = {
      ...data,
      organization_id: organizationId
    };

    const { data: newCategory, error } = await supabase
      .from('kb_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);
    await cacheService.invalidate(`org:${organizationId}:kb:categories:*`);
    
    return newCategory;
  }

  static async getCategoryHierarchy(organizationId: string): Promise<KnowledgeBaseCategory[]> {
    const cacheKey = `org:${organizationId}:kb:categories:hierarchy`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const { data: categories, error } = await supabase
      .from('kb_categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('position');

    if (error) throw new AppError(error.message, 400);
    
    await cacheService.set(cacheKey, categories, 300); // Cache for 5 minutes
    return categories;
  }

  // Article operations
  static async createArticle(
    data: Partial<KnowledgeBaseArticle>,
    authorId: string,
    organizationId: string
  ): Promise<KnowledgeBaseArticle> {
    return await DatabaseService.transaction(async () => {
      // Create the article
      const article = {
        ...data,
        author_id: authorId,
        organization_id: organizationId,
        status: 'draft'
      };

      const { data: newArticle, error } = await supabase
        .from('kb_articles')
        .insert(article)
        .select()
        .single();

      if (error) throw new AppError(error.message, 400);

      // Create initial version
      const version = {
        article_id: newArticle.id,
        content: data.content,
        version_number: 1,
        created_by: authorId
      };

      const { error: versionError } = await supabase
        .from('kb_article_versions')
        .insert(version);

      if (versionError) throw new AppError(versionError.message, 400);

      // Initialize stats
      const { error: statsError } = await supabase
        .from('kb_article_stats')
        .insert({ article_id: newArticle.id });

      if (statsError) throw new AppError(statsError.message, 400);

      await cacheService.invalidate(`org:${organizationId}:kb:articles:*`);
      return newArticle;
    });
  }

  static async updateArticle(
    id: string,
    data: Partial<KnowledgeBaseArticle>,
    userId: string
  ): Promise<KnowledgeBaseArticle> {
    return await DatabaseService.transaction(async () => {
      // Get current article
      const { data: article, error: fetchError } = await supabase
        .from('kb_articles')
        .select()
        .eq('id', id)
        .single();

      if (fetchError) throw new AppError(fetchError.message, 400);

      // Create new version if content changed
      if (data.content) {
        const versionNumber = (article.published_version_number || 0) + 1;
        const version = {
          article_id: id,
          content: data.content,
          version_number: versionNumber,
          created_by: userId
        };

        const { error: versionError } = await supabase
          .from('kb_article_versions')
          .insert(version);

        if (versionError) throw new AppError(versionError.message, 400);

        data.published_version_number = versionNumber;
      }

      // Update article
      const { data: updatedArticle, error } = await supabase
        .from('kb_articles')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new AppError(error.message, 400);

      await cacheService.invalidate(`org:${article.organization_id}:kb:articles:*`);
      return updatedArticle;
    });
  }

  static async searchArticles(
    query: string,
    organizationId: string,
    options: {
      categoryId?: string;
      tags?: string[];
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ articles: KnowledgeBaseArticle[]; total: number }> {
    const {
      categoryId,
      tags,
      page = 1,
      limit = 20
    } = options;

    const offset = (page - 1) * limit;

    let queryBuilder = supabase
      .from('kb_articles')
      .select('*, kb_article_stats!inner(*)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('status', 'published')
      .textSearch('search_vector', query)
      .order('kb_article_stats(views_count)', { ascending: false })
      .range(offset, offset + limit - 1);

    if (categoryId) {
      queryBuilder = queryBuilder.eq('category_id', categoryId);
    }

    if (tags?.length) {
      queryBuilder = queryBuilder.contains('tags', tags);
    }

    const { data, error, count } = await queryBuilder;

    if (error) throw new AppError(error.message, 400);

    return {
      articles: data,
      total: count || 0
    };
  }

  static async recordView(articleId: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('increment_article_views', {
      p_article_id: articleId
    });

    if (error) throw new AppError(error.message, 400);
  }

  static async submitFeedback(
    articleId: string,
    userId: string | undefined,
    isHelpful: boolean,
    comment?: string
  ): Promise<void> {
    return await DatabaseService.transaction(async () => {
      // Record feedback
      const { error: feedbackError } = await supabase
        .from('kb_article_feedback')
        .insert({
          article_id: articleId,
          user_id: userId,
          is_helpful: isHelpful,
          comment
        });

      if (feedbackError) throw new AppError(feedbackError.message, 400);

      // Update stats
      const { error: statsError } = await supabaseAdmin.rpc(
        'update_article_feedback_stats',
        {
          p_article_id: articleId,
          p_is_helpful: isHelpful
        }
      );

      if (statsError) throw new AppError(statsError.message, 400);
    });
  }

  static async getArticleVersions(articleId: string): Promise<KnowledgeBaseArticleVersion[]> {
    const { data, error } = await supabase
      .from('kb_article_versions')
      .select('*')
      .eq('article_id', articleId)
      .order('version_number', { ascending: false });

    if (error) throw new AppError(error.message, 400);
    return data;
  }
} 