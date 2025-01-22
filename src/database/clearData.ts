import { supabaseAdmin } from '../config/supabase';

async function clearDatabase() {
  console.log('Starting database cleanup...');

  try {
    // First disable audit triggers
    await supabaseAdmin.rpc('disable_audit_triggers');

    // Delete auth users since they have references in profiles
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
    } else {
      for (const user of users.users) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(user.id);
        } catch (error) {
          console.error(`Error deleting user ${user.id}:`, error);
        }
      }
      console.log('Deleted all auth users');
    }

    // Delete data in the correct order
    const tables = [
      'audit_logs',
      'comments',
      'kb_article_feedback',
      'kb_article_stats',
      'kb_article_versions',
      'sla_breach_logs',
      'tickets',
      'kb_articles',
      'kb_categories',
      'queue_configurations',
      'sla_policies',
      'workload_rules',
      'webhook_configs',
      'profiles',
      'teams',
      'organizations'
    ];

    for (const table of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.error(`Error deleting ${table}:`, error);
      } else {
        console.log(`Deleted all ${table}`);
      }
    }

    // Re-enable audit triggers
    await supabaseAdmin.rpc('enable_audit_triggers');

    console.log('Database cleanup completed successfully!');
  } catch (error) {
    console.error('Error during database cleanup:', error);
  }
}

clearDatabase(); 