import { supabase, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export class DatabaseService {
  static async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const { error: beginError } = await supabaseAdmin.rpc('begin_transaction');
    if (beginError) throw new AppError('Failed to begin transaction', 500);

    try {
      const result = await callback();
      const { error: commitError } = await supabaseAdmin.rpc('commit_transaction');
      if (commitError) throw new AppError('Failed to commit transaction', 500);
      return result;
    } catch (error) {
      const { error: rollbackError } = await supabaseAdmin.rpc('rollback_transaction');
      if (rollbackError) console.error('Failed to rollback transaction:', rollbackError);
      throw error;
    }
  }

  static async getOrganizationId(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (error) throw new AppError('Failed to get organization ID', 500);
    return data.organization_id;
  }

  static async checkUserAccess(userId: string, organizationId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (error) return false;
    return !!data;
  }

  static async getUserRole(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) throw new AppError('Failed to get user role', 500);
    return data.role;
  }
} 