import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { DatabaseService } from './databaseService';
import { cacheService } from './cacheService';
import {
  QueueConfiguration,
  SLAPolicy,
  WorkloadRule,
  Ticket,
  QueueRule
} from '../types';

export class QueueService {
  // Queue Configuration
  static async createQueueConfiguration(
    data: Partial<QueueConfiguration>,
    organizationId: string
  ): Promise<QueueConfiguration> {
    const config = {
      ...data,
      organization_id: organizationId
    };

    const { data: newConfig, error } = await supabase
      .from('queue_configurations')
      .insert(config)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);
    await cacheService.invalidate(`org:${organizationId}:queues:*`);
    
    return newConfig;
  }

  static async getQueueConfigurations(organizationId: string): Promise<QueueConfiguration[]> {
    const cacheKey = `org:${organizationId}:queues:list`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('queue_configurations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    if (error) throw new AppError(error.message, 400);
    
    await cacheService.set(cacheKey, data, 300);
    return data;
  }

  // SLA Policies
  static async createSLAPolicy(
    data: Partial<SLAPolicy>,
    organizationId: string
  ): Promise<SLAPolicy> {
    const policy = {
      ...data,
      organization_id: organizationId
    };

    const { data: newPolicy, error } = await supabase
      .from('sla_policies')
      .insert(policy)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);
    await cacheService.invalidate(`org:${organizationId}:sla:*`);
    
    return newPolicy;
  }

  static async getSLAPolicies(organizationId: string): Promise<SLAPolicy[]> {
    const cacheKey = `org:${organizationId}:sla:policies`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('sla_policies')
      .select('*')
      .eq('organization_id', organizationId)
      .order('priority');

    if (error) throw new AppError(error.message, 400);
    
    await cacheService.set(cacheKey, data, 300);
    return data;
  }

  // Workload Rules
  static async createWorkloadRule(
    data: Partial<WorkloadRule>,
    organizationId: string
  ): Promise<WorkloadRule> {
    const rule = {
      ...data,
      organization_id: organizationId
    };

    const { data: newRule, error } = await supabase
      .from('workload_rules')
      .insert(rule)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);
    await cacheService.invalidate(`org:${organizationId}:workload:*`);
    
    return newRule;
  }

  static async getWorkloadRules(organizationId: string): Promise<WorkloadRule[]> {
    const { data, error } = await supabase
      .from('workload_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at');

    if (error) throw new AppError(error.message, 400);
    return data;
  }

  // Queue Assignment
  static async assignTicketToQueue(ticketId: string, organizationId: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('assign_ticket_to_queue', {
      p_ticket_id: ticketId,
      p_organization_id: organizationId
    });

    if (error) throw new AppError(error.message, 400);
  }

  // SLA Management
  static async calculateSLADueDates(ticketId: string, slaPolicyId: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('calculate_sla_due_dates', {
      p_ticket_id: ticketId,
      p_sla_policy_id: slaPolicyId
    });

    if (error) throw new AppError(error.message, 400);
  }

  static async checkSLABreaches(): Promise<void> {
    const { error } = await supabaseAdmin.rpc('check_sla_breaches');
    if (error) throw new AppError(error.message, 400);
  }

  // Ticket Assignment
  static async assignTicketToAgent(
    ticketId: string,
    organizationId: string
  ): Promise<string | null> {
    // Get workload rules
    const rules = await this.getWorkloadRules(organizationId);
    if (!rules.length) return null;

    // Get available agents
    const { data: agents } = await supabase
      .from('profiles')
      .select(`
        id,
        tickets!tickets_assigned_to_fkey (
          id,
          title,
          description,
          status,
          priority,
          created_by,
          organization_id,
          team_id,
          queue_id,
          sla_policy_id,
          first_response_due_at,
          resolution_due_at,
          sla_status,
          tags,
          metadata,
          first_response_at,
          resolved_at,
          satisfaction_rating,
          satisfaction_comment,
          created_at,
          updated_at
        )
      `)
      .eq('organization_id', organizationId)
      .eq('role', 'agent');

    if (!agents?.length) return null;

    // Calculate agent workloads
    const agentWorkloads = agents.map(agent => {
      const activeTickets = agent.tickets.filter(
        (t) => t.status !== 'closed'
      ) as Ticket[];
      
      const workload = this.calculateAgentWorkload(
        activeTickets,
        rules[0].ticket_weight_rules
      );

      return {
        id: agent.id,
        workload
      };
    });

    // Find agent with lowest workload
    const selectedAgent = agentWorkloads.reduce((prev, current) => 
      prev.workload < current.workload ? prev : current
    );

    if (selectedAgent.workload >= rules[0].max_tickets_per_agent) {
      return null;
    }

    // Assign ticket to selected agent
    const { error } = await supabase
      .from('tickets')
      .update({ assigned_to: selectedAgent.id })
      .eq('id', ticketId);

    if (error) throw new AppError(error.message, 400);
    return selectedAgent.id;
  }

  private static calculateAgentWorkload(
    tickets: Ticket[],
    weightRules: any[]
  ): number {
    return tickets.reduce((total, ticket) => {
      const weight = weightRules.reduce((acc, rule) => {
        if (this.evaluateCondition(ticket, rule.condition)) {
          return acc + rule.weight;
        }
        return acc;
      }, 1); // Base weight of 1

      return total + weight;
    }, 0);
  }

  private static evaluateCondition(
    ticket: any,
    condition: { field: string; operator: string; value: any }
  ): boolean {
    const ticketValue = ticket[condition.field];
    
    switch (condition.operator) {
      case 'equals':
        return ticketValue === condition.value;
      case 'contains':
        return Array.isArray(ticketValue) 
          ? ticketValue.includes(condition.value)
          : String(ticketValue).includes(condition.value);
      default:
        return false;
    }
  }
} 