import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'agent' | 'customer';
  organization_id: string;
  team_ids: string[];
  skills: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_by: string;
  assigned_to?: string;
  organization_id: string;
  team_id?: string;
  queue_id?: string;
  sla_policy_id?: string;
  first_response_due_at?: string;
  resolution_due_at?: string;
  sla_status: {
    first_response: 'pending' | 'met' | 'breached';
    resolution: 'pending' | 'met' | 'breached';
  };
  tags: string[];
  metadata: Record<string, any>;
  first_response_at?: string;
  resolved_at?: string;
  satisfaction_rating?: number;
  satisfaction_comment?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  organization_id: string;
  lead_id: string;
  members: string[];
  skills: string[];
  schedule: WorkSchedule;
  created_at: Date;
  updated_at: Date;
}

export interface WorkSchedule {
  timezone: string;
  shifts: {
    day: number;
    start: string;
    end: string;
  }[];
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    organization_id: string;
    role: string;
  };
}

export interface ErrorLogData {
  error_message: string;
  error_stack?: string;
  error_name: string;
  path: string;
  method: string;
  query_params: any;
  body: any;
  user_id?: string;
  organization_id?: string;
  timestamp: string;
}

export interface KnowledgeBaseCategory {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  slug: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseArticle {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  author_id: string;
  category_id?: string;
  slug: string;
  tags: string[];
  metadata: Record<string, any>;
  published_version_number?: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseArticleVersion {
  id: string;
  article_id: string;
  content: string;
  version_number: number;
  published_at?: string;
  created_by: string;
  change_summary?: string;
  created_at: string;
}

export interface KnowledgeBaseArticleStats {
  id: string;
  article_id: string;
  views_count: number;
  helpful_count: number;
  not_helpful_count: number;
  last_viewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseArticleFeedback {
  id: string;
  article_id: string;
  user_id?: string;
  is_helpful: boolean;
  comment?: string;
  created_at: string;
}

// Queue Management Types
export interface QueueConfiguration {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  rules: QueueRule[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueueRuleCondition {
  field: 'priority' | 'status' | 'tags' | 'category';
  operator: 'equals' | 'contains';
  value?: any;
}

export interface QueueRuleAction {
  type: 'assign_queue';
  value?: any;
}

export interface QueueRule {
  conditions: QueueRuleCondition[];
  actions: QueueRuleAction[];
}

export interface TicketWeightCondition {
  field: 'priority' | 'status' | 'category';
  operator: 'equals' | 'contains';
  value?: any;
}

export interface TicketWeightRule {
  condition: TicketWeightCondition;
  weight: number;
}

export interface SLAPolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  first_response_time: string;
  resolution_time: string;
  business_hours: boolean;
  created_at: string;
  updated_at: string;
}

export interface SLABreachLog {
  id: string;
  ticket_id: string;
  sla_policy_id: string;
  breach_type: 'first_response' | 'resolution';
  breached_at: string;
  time_to_breach: string;
  created_at: string;
}

export interface WorkloadRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  max_tickets_per_agent: number;
  ticket_weight_rules: TicketWeightRule[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
} 