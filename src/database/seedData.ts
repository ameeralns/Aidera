import { supabaseAdmin } from '../config/supabase';
import { faker } from '@faker-js/faker';

type UserRole = 'admin' | 'agent' | 'customer';
type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type SLAPriority = 'p1' | 'p2' | 'p3' | 'p4';
type SubscriptionTier = 'enterprise' | 'pro' | 'free';

interface Organization {
  id: string;
  name: string;
  subscription_tier: SubscriptionTier;
  domain: string;
  settings: Record<string, any>;
  created_at: Date;
}

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id?: string;
}

async function seedDatabase() {
  try {
    // Step 1: Clear existing data
    console.log('Clearing existing data...');
    await supabaseAdmin.from('tickets').delete().neq('id', 0);
    await supabaseAdmin.from('comments').delete().neq('id', 0);
    await supabaseAdmin.from('profiles').delete().neq('id', 0);
    await supabaseAdmin.from('teams').delete().neq('id', 0);
    await supabaseAdmin.from('organizations').delete().neq('id', 0);
    await supabaseAdmin.from('sla_policies').delete().neq('id', 0);
    await supabaseAdmin.from('queue_configurations').delete().neq('id', 0);
    await supabaseAdmin.from('kb_categories').delete().neq('id', 0);
    await supabaseAdmin.from('kb_articles').delete().neq('id', 0);
    
    // Delete all existing users from auth.users
    console.log('Clearing existing auth users...');
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    for (const user of existingUsers.users) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }

    // Step 2: Create organizations first
    console.log('Creating organizations...');
    const organizations = await Promise.all(
      ['enterprise', 'pro', 'free'].map(async (tier, i) => {
        const org = {
          name: faker.company.name(),
          subscription_tier: tier as SubscriptionTier,
          domain: faker.internet.domainName(),
          settings: { theme: 'light', language: 'en' },
          created_at: faker.date.past(),
        };

        const { data: orgData, error: orgError } = await supabaseAdmin
          .from('organizations')
          .insert(org)
          .select()
          .single();

        if (orgError || !orgData) throw orgError;
        console.log(`Created organization ${i + 1} with ID: ${orgData.id}`);
        return orgData;
      })
    );

    // Step 3: Create all auth users first
    console.log('Creating users in authentication...');
    const authUsers: AuthUser[] = [];

    for (const org of organizations) {
      console.log(`Creating users for organization ${org.id}...`);

      // Create 1 admin
      const adminData = {
        email: faker.internet.email(),
        password: 'password123',
        email_confirm: true,
        user_metadata: {
          full_name: faker.person.fullName(),
          role: 'admin'
        }
      };

      const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser(adminData);
      if (adminError || !adminUser.user) {
        console.error('Error creating admin:', adminError);
        continue;
      }

      const admin: AuthUser = {
        id: adminUser.user.id,
        email: adminUser.user.email!,
        full_name: adminUser.user.user_metadata.full_name,
        role: 'admin',
        organization_id: org.id
      };
      authUsers.push(admin);
      console.log(`Created admin: ${admin.id} (${admin.email})`);

      // Create 3 agents
      for (let i = 0; i < 3; i++) {
        const agentData = {
          email: faker.internet.email(),
          password: 'password123',
          email_confirm: true,
          user_metadata: {
            full_name: faker.person.fullName(),
            role: 'agent'
          }
        };

        const { data: agentUser, error: agentError } = await supabaseAdmin.auth.admin.createUser(agentData);
        if (agentError || !agentUser.user) {
          console.error('Error creating agent:', agentError);
          continue;
        }

        const agent: AuthUser = {
          id: agentUser.user.id,
          email: agentUser.user.email!,
          full_name: agentUser.user.user_metadata.full_name,
          role: 'agent',
          organization_id: org.id
        };
        authUsers.push(agent);
        console.log(`Created agent: ${agent.id} (${agent.email})`);
      }

      // Create 5 customers
      for (let i = 0; i < 5; i++) {
        const customerData = {
          email: faker.internet.email(),
          password: 'password123',
          email_confirm: true,
          user_metadata: {
            full_name: faker.person.fullName(),
            role: 'customer'
          }
        };

        const { data: customerUser, error: customerError } = await supabaseAdmin.auth.admin.createUser(customerData);
        if (customerError || !customerUser.user) {
          console.error('Error creating customer:', customerError);
          continue;
        }

        const customer: AuthUser = {
          id: customerUser.user.id,
          email: customerUser.user.email!,
          full_name: customerUser.user.user_metadata.full_name,
          role: 'customer',
          organization_id: org.id
        };
        authUsers.push(customer);
        console.log(`Created customer: ${customer.id} (${customer.email})`);
      }
    }

    console.log(`Created ${authUsers.length} auth users`);

    // Step 4: Create profiles using exact auth user data
    console.log('Creating user profiles...');
    const profiles = authUsers.map(user => ({
      id: user.id,  // Use exact auth UID
      full_name: user.full_name,  // Use exact name from auth
      organization_id: user.organization_id,
      role: user.role,
      skills: user.role === 'admin' ? ['customer service', 'technical support', 'billing', 'sales'] :
             user.role === 'agent' ? Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => 
               faker.helpers.arrayElement(['customer service', 'technical support', 'billing', 'sales', 'product'])
             ) : undefined,
      settings: {
        theme: faker.helpers.arrayElement(['light', 'dark']),
        notifications: { 
          email: true, 
          push: user.role !== 'customer'
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert(profiles);

    if (profileError) {
      console.error('Error creating profiles:', profileError);
      throw profileError;
    }
    console.log(`Created ${profiles.length} profiles`);

    // Create teams for each organization
    const teams = organizations.flatMap(org => [
      {
        name: 'Customer Support',
        organization_id: org.id,
        description: 'Primary support team',
        skills: ['customer service', 'technical support', 'billing'],
        schedule: { timezone: 'UTC', working_hours: { start: '09:00', end: '17:00' } },
        created_at: faker.date.past(),
      },
      {
        name: 'Technical Support',
        organization_id: org.id,
        description: 'Technical issues team',
        skills: ['technical support', 'product', 'troubleshooting'],
        schedule: { timezone: 'UTC', working_hours: { start: '09:00', end: '17:00' } },
        created_at: faker.date.past(),
      }
    ]);

    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert(teams)
      .select();

    if (teamError) throw teamError;
    console.log('Created teams:', teamData.length);

    // Update team leads and members
    for (let i = 0; i < teamData.length; i++) {
      const team = teamData[i];
      const orgAgents = authUsers.filter(u => 
        u.organization_id === team.organization_id && 
        u.role === 'agent'
      );
      
      if (orgAgents.length > 0) {
        const { error: teamUpdateError } = await supabaseAdmin
          .from('teams')
          .update({ 
            lead_id: orgAgents[0].id,
            members: orgAgents.map(a => a.id)
          })
          .eq('id', team.id);

        if (teamUpdateError) console.error('Error updating team lead:', teamUpdateError);
      }
    }

    // Create SLA policies
    const slaPolicies = organizations.flatMap(org => [
      {
        organization_id: org.id,
        name: 'Urgent Issues',
        priority: 'p1' as SLAPriority,
        first_response_time: 1,
        resolution_time: 4,
        created_at: faker.date.past(),
      },
      {
        organization_id: org.id,
        name: 'High Priority',
        priority: 'p2' as SLAPriority,
        first_response_time: 4,
        resolution_time: 24,
        created_at: faker.date.past(),
      },
      {
        organization_id: org.id,
        name: 'Medium Priority',
        priority: 'p3' as SLAPriority,
        first_response_time: 8,
        resolution_time: 48,
        created_at: faker.date.past(),
      }
    ]);

    const { data: slaPolicyData, error: slaPolicyError } = await supabaseAdmin
      .from('sla_policies')
      .insert(slaPolicies)
      .select();

    if (slaPolicyError) throw slaPolicyError;
    console.log('Created SLA policies:', slaPolicyData.length);

    // Create queue configurations
    const queueConfigs = organizations.map(org => ({
      organization_id: org.id,
      name: 'Default Queue',
      description: 'Main support queue',
      rules: [{
        assignment_method: 'round_robin',
        skills_required: ['customer service']
      }],
      is_default: true,
      created_at: faker.date.past(),
    }));

    const { data: queueData, error: queueError } = await supabaseAdmin
      .from('queue_configurations')
      .insert(queueConfigs)
      .select();

    if (queueError) throw queueError;
    console.log('Created queue configurations:', queueData.length);

    // Create KB categories and articles
    const kbCategories = organizations.flatMap(org => [
      {
        organization_id: org.id,
        name: 'Getting Started',
        description: 'Basic guides and tutorials',
        slug: 'getting-started',
        position: 0,
        created_at: faker.date.past(),
      },
      {
        organization_id: org.id,
        name: 'Troubleshooting',
        description: 'Common issues and solutions',
        slug: 'troubleshooting',
        position: 1,
        created_at: faker.date.past(),
      }
    ]);

    const { data: categoryData, error: categoryError } = await supabaseAdmin
      .from('kb_categories')
      .insert(kbCategories)
      .select();

    if (categoryError) throw categoryError;
    console.log('Created KB categories:', categoryData.length);

    // Create KB articles
    const kbArticles = categoryData.flatMap(category => {
      const orgAgents = authUsers.filter(u => 
        u.organization_id === category.organization_id && 
        u.role === 'agent'
      );
      
      if (orgAgents.length === 0) return [];
      
      return Array.from({ length: 2 }, () => ({
        organization_id: category.organization_id,
        category_id: category.id,
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(3),
        status: 'published',
        author_id: orgAgents[0].id,
        slug: faker.helpers.slugify(faker.lorem.sentence()),
        tags: ['guide', 'help'],
        created_at: faker.date.past(),
      }));
    });

    if (kbArticles.length > 0) {
      const { data: articleData, error: articleError } = await supabaseAdmin
        .from('kb_articles')
        .insert(kbArticles)
        .select();

      if (articleError) throw articleError;
      console.log('Created KB articles:', articleData.length);
    }

    // Create tickets and comments
    console.log('Starting ticket creation...');
    let ticketCount = 0;

    for (const org of organizations) {
      const orgCustomers = authUsers.filter(u => 
        u.organization_id === org.id && 
        u.role === 'customer'
      );
      const orgAgents = authUsers.filter(u => 
        u.organization_id === org.id && 
        u.role === 'agent'
      );
      
      console.log(`Creating tickets for org ${org.id}:`);
      console.log(`- Found ${orgCustomers.length} customers`);
      console.log(`- Found ${orgAgents.length} agents`);
      
      const orgTeams = teamData.filter(t => t.organization_id === org.id);
      const orgSLAPolicies = slaPolicyData.filter(s => s.organization_id === org.id);
      const orgQueue = queueData.find(q => q.organization_id === org.id);

      // Create 3 tickets per customer with different statuses
      for (const customer of orgCustomers) {
        console.log(`Creating tickets for customer ${customer.id}`);
        const ticketStatuses: TicketStatus[] = ['open', 'pending', 'resolved'];
        const ticketPriorities: TicketPriority[] = ['low', 'medium', 'high'];

        for (let i = 0; i < 3; i++) {
          const status = ticketStatuses[i];
          const priority = ticketPriorities[i];
          const assignedAgent = orgAgents[faker.number.int({ min: 0, max: orgAgents.length - 1 })];
          const team = orgTeams[faker.number.int({ min: 0, max: orgTeams.length - 1 })];
          const slaPolicy = orgSLAPolicies[faker.number.int({ min: 0, max: orgSLAPolicies.length - 1 })];

          const ticket = {
            title: faker.lorem.sentence(),
            description: faker.lorem.paragraph(),
            status,
            priority,
            created_by: customer.id,
            assigned_to: status !== 'open' ? assignedAgent.id : null,
            organization_id: org.id,
            team_id: team.id,
            queue_id: orgQueue?.id,
            sla_policy_id: slaPolicy.id,
            tags: [faker.helpers.arrayElement(['bug', 'feature', 'question', 'billing'])],
            created_at: faker.date.past(),
            updated_at: faker.date.recent(),
            first_response_at: status !== 'open' ? faker.date.recent() : null,
            resolved_at: status === 'resolved' ? faker.date.recent() : null,
            satisfaction_rating: status === 'resolved' ? faker.number.int({ min: 1, max: 5 }) : null,
          };

          const { data: ticketData, error: ticketError } = await supabaseAdmin
            .from('tickets')
            .insert(ticket)
            .select()
            .single();

          if (ticketError) {
            console.error('Error creating ticket:', ticketError);
            continue;
          }

          ticketCount++;
          console.log(`Created ticket ${ticketData.id} with status ${status}`);

          // Add 2-4 comments per ticket
          const commentCount = faker.number.int({ min: 2, max: 4 });
          const comments = Array.from({ length: commentCount }, () => ({
            ticket_id: ticketData.id,
            content: faker.lorem.paragraph(),
            created_by: assignedAgent ? faker.helpers.arrayElement([customer.id, assignedAgent.id]) : customer.id,
            internal_only: faker.datatype.boolean(),
            created_at: faker.date.recent(),
          }));

          const { error: commentError } = await supabaseAdmin
            .from('comments')
            .insert(comments);

          if (commentError) {
            console.error('Error creating comments:', commentError);
          } else {
            console.log(`Added ${commentCount} comments to ticket ${ticketData.id}`);
          }
        }
      }
    }
    
    console.log(`Total tickets created: ${ticketCount}`);
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Run the seeding
seedDatabase(); 