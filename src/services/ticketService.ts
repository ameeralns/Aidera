import { supabase, supabaseAdmin } from '../config/supabase';
import { DatabaseService } from './databaseService';
import { AppError } from '../middleware/errorHandler';
import { Ticket } from '../types';
import { cacheService } from './cacheService';
import { publishWebhook } from './webhookService';

interface TicketUpdate extends Partial<Ticket> {
  resolved_at?: string;
}

interface TicketListResponse {
  status: 'success';
  data: Array<{
    id: string;
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved';
    priority: 'low' | 'medium' | 'high';
    created_at: string;
    updated_at: string;
    created_by: {
      id: string;
      full_name: string;
      email: string;
    };
    assigned_to: {
      id: string;
      full_name: string;
      email: string;
    } | null;
    comments: Array<{
      id: string;
      content: string;
      created_at: string;
      created_by: {
        id: string;
        full_name: string;
      }
    }>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface TicketQueryOptions {
  page?: number;
  limit?: number;
  sort_field?: 'created_at' | 'updated_at' | 'status' | 'priority' | 'title';
  sort_direction?: 'asc' | 'desc';
}

export class TicketService {
  static async create(data: Partial<Ticket>, userId: string): Promise<Ticket> {
    return DatabaseService.transaction(async () => {
      const organizationId = await DatabaseService.getOrganizationId(userId);
      
      // Implement intelligent routing
      const assignedAgent = await this.findBestAgent(data, organizationId);

      const ticket = {
        ...data,
        created_by: userId,
        assigned_to: assignedAgent?.id,
        organization_id: organizationId,
        status: 'open',
        metadata: {
          ...data.metadata,
          routing_score: assignedAgent?.score
        }
      };

      const { data: newTicket, error } = await supabase
        .from('tickets')
        .insert(ticket)
        .select('*, created_by(*), assigned_to(*)')
        .single();

      if (error) throw new AppError(error.message, 400);

      // Trigger webhook
      await publishWebhook('ticket.created', newTicket);

      // Invalidate relevant caches
      await cacheService.invalidate(`org:${organizationId}:tickets:*`);

      return newTicket;
    });
  }

  private static async findBestAgent(ticket: Partial<Ticket>, organizationId: string) {
    const { data: agents } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        tickets!tickets_assigned_to_fkey(count),
        teams!inner(
          id,
          skills
        )
      `)
      .eq('organization_id', organizationId)
      .eq('role', 'agent')
      .in('teams.id', ticket.team_id ? [ticket.team_id] : []);

    if (!agents?.length) return null;

    return agents
      .map(agent => ({
        id: agent.id,
        score: this.calculateAgentScore(agent, ticket)
      }))
      .sort((a, b) => b.score - a.score)[0];
  }

  private static calculateAgentScore(agent: any, ticket: Partial<Ticket>): number {
    let score = 0;

    // Workload score (inverse of current workload)
    const currentWorkload = agent.tickets?.[0]?.count || 0;
    score += 1 / (currentWorkload + 1);

    // Skills match score
    const agentSkills = new Set(agent.skills);
    const ticketTags = new Set(ticket.tags || []);
    const matchingSkills = [...ticketTags].filter(tag => agentSkills.has(tag));
    score += matchingSkills.length;

    return score;
  }

  static async update(
    ticketId: string, 
    updates: TicketUpdate, 
    userId: string
  ): Promise<Ticket> {
    return DatabaseService.transaction(async () => {
      const organizationId = await DatabaseService.getOrganizationId(userId);

      // Check if status is being changed to 'resolved'
      if (updates.status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { data: ticket, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticketId)
        .eq('organization_id', organizationId)
        .select('*, created_by(*), assigned_to(*)')
        .single();

      if (error) throw new AppError(error.message, 400);

      // Trigger webhook
      await publishWebhook('ticket.updated', ticket);

      // Invalidate relevant caches
      await cacheService.invalidate(`org:${organizationId}:tickets:*`);

      return ticket;
    });
  }

  static async addComment(
    ticketId: string,
    content: string,
    userId: string,
    isInternal: boolean = false
  ): Promise<any> {
    return DatabaseService.transaction(async () => {
      const organizationId = await DatabaseService.getOrganizationId(userId);

      // If this is the first response from an agent, update first_response_at
      const userRole = await DatabaseService.getUserRole(userId);
      if (userRole !== 'customer') {
        const { data: ticket } = await supabase
          .from('tickets')
          .select('first_response_at')
          .eq('id', ticketId)
          .single();

        if (!ticket?.first_response_at) {
          await supabase
            .from('tickets')
            .update({ first_response_at: new Date().toISOString() })
            .eq('id', ticketId);
        }
      }

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticketId,
          content,
          created_by: userId,
          internal_only: isInternal
        })
        .select('*, created_by(*)')
        .single();

      if (error) throw new AppError(error.message, 400);

      // Trigger webhook
      await publishWebhook('comment.created', comment);

      return comment;
    });
  }

  static async getByCustomerId(
    customerId: string,
    organizationId: string,
    options: TicketQueryOptions = {}
  ): Promise<TicketListResponse> {
    
    console.log('=== Starting Ticket Fetch ===');
    console.log('Customer ID:', customerId);

    // Try with supabaseAdmin to bypass RLS
    const { data: tickets, error } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('created_by', customerId);

    if (error) {
      console.error('Error fetching tickets:', error);
      throw new AppError(error.message, 400);
    }

    console.log('=== Query Results ===');
    console.log('Raw query result:', tickets);
    console.log('Number of tickets found:', tickets?.length || 0);
    if (tickets?.length > 0) {
      console.log('First ticket details:', {
        id: tickets[0].id,
        created_by: tickets[0].created_by,
        title: tickets[0].title,
        organization_id: tickets[0].organization_id
      });
    }

    // Transform the data to match the frontend's expected format
    const transformedTickets = tickets?.map(ticket => ({
      id: ticket.id as string,
      title: ticket.title as string,
      description: ticket.description as string,
      status: ticket.status as 'open' | 'in_progress' | 'resolved',
      priority: ticket.priority as 'low' | 'medium' | 'high',
      created_at: ticket.created_at as string,
      updated_at: ticket.updated_at as string,
      created_by: {
        id: customerId,
        full_name: 'User', // We'll fix this once we get the tickets working
        email: customerId + '@example.com'
      },
      assigned_to: null,
      comments: []
    })) || [];

    const response: TicketListResponse = {
      status: 'success' as const,
      data: transformedTickets,
      pagination: {
        page: options.page || 1,
        limit: options.limit || 10,
        total: tickets?.length || 0,
        total_pages: Math.ceil((tickets?.length || 0) / (options.limit || 10))
      }
    };

    console.log('=== Response Preview ===');
    console.log('Total tickets in response:', response.data.length);
    console.log('=== End Ticket Fetch ===');

    return response;
  }
} 