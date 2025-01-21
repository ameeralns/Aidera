-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable RLS (Row Level Security)
alter table public.profiles enable row level security;

-- Create custom types
create type ticket_status as enum ('open', 'pending', 'resolved', 'closed');
create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
create type user_role as enum ('admin', 'agent', 'customer');

-- Organizations table
create table public.organizations (
    id uuid default uuid_generate_v4() primary key,
    name varchar(255) not null,
    domain varchar(255),
    subscription_tier varchar(50),
    settings jsonb default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Extend Supabase auth.users with profiles
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    organization_id uuid references public.organizations,
    full_name varchar(255),
    role user_role default 'customer',
    skills text[] default '{}',
    settings jsonb default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Teams table
create table public.teams (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations not null,
    name varchar(255) not null,
    description text,
    lead_id uuid references public.profiles,
    members uuid[] default '{}',
    skills text[] default '{}',
    schedule jsonb default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tickets table with enhanced fields
create table public.tickets (
    id uuid default uuid_generate_v4() primary key,
    title varchar(255) not null,
    description text not null,
    status ticket_status default 'open',
    priority ticket_priority default 'medium',
    created_by uuid references public.profiles not null,
    assigned_to uuid references public.profiles,
    organization_id uuid references public.organizations not null,
    team_id uuid references public.teams,
    tags text[] default '{}',
    metadata jsonb default '{}',
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    satisfaction_rating integer check (satisfaction_rating between 1 and 5),
    satisfaction_comment text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    queue_id uuid references public.queue_configurations,
    sla_policy_id uuid references public.sla_policies,
    first_response_due_at timestamp with time zone,
    resolution_due_at timestamp with time zone,
    sla_status jsonb default '{"first_response": "pending", "resolution": "pending"}'::jsonb
);

-- Comments table
create table public.comments (
    id uuid default uuid_generate_v4() primary key,
    ticket_id uuid references public.tickets on delete cascade not null,
    content text not null,
    created_by uuid references public.profiles not null,
    internal_only boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Knowledge Base Articles
create table public.kb_articles (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations not null,
    title varchar(255) not null,
    content text not null,
    status varchar(50) default 'draft',
    author_id uuid references public.profiles not null,
    category varchar(100),
    tags text[] default '{}',
    metadata jsonb default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Webhook Configurations
create table public.webhook_configs (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations not null,
    url text not null,
    events text[] not null,
    secret text not null,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Audit Log
create table public.audit_logs (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations not null,
    actor_id uuid references public.profiles,
    event_type varchar(100) not null,
    resource_type varchar(100) not null,
    resource_id uuid not null,
    changes jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Knowledge Base Categories
create table public.kb_categories (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations not null,
    name varchar(255) not null,
    description text,
    parent_id uuid references public.kb_categories,
    slug varchar(255) not null,
    position integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(organization_id, slug)
);

-- Knowledge Base Article Versions
create table public.kb_article_versions (
    id uuid default uuid_generate_v4() primary key,
    article_id uuid references public.kb_articles on delete cascade not null,
    content text not null,
    version_number integer not null,
    published_at timestamp with time zone,
    created_by uuid references public.profiles not null,
    change_summary text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(article_id, version_number)
);

-- Knowledge Base Article Stats
create table public.kb_article_stats (
    id uuid default uuid_generate_v4() primary key,
    article_id uuid references public.kb_articles on delete cascade not null,
    views_count integer default 0,
    helpful_count integer default 0,
    not_helpful_count integer default 0,
    last_viewed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(article_id)
);

-- Knowledge Base Article Feedback
create table public.kb_article_feedback (
    id uuid default uuid_generate_v4() primary key,
    article_id uuid references public.kb_articles on delete cascade not null,
    user_id uuid references public.profiles,
    is_helpful boolean not null,
    comment text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Modify kb_articles table to add category support and search fields
alter table public.kb_articles 
    add column category_id uuid references public.kb_categories,
    add column slug varchar(255),
    add column search_vector tsvector,
    add column published_version_number integer,
    add constraint unique_org_slug unique(organization_id, slug);

-- Create search index
create index kb_articles_search_idx on public.kb_articles using gin(search_vector);

-- Create indexes for performance
create index idx_kb_categories_org on public.kb_categories(organization_id);
create index idx_kb_categories_parent on public.kb_categories(parent_id);
create index idx_kb_article_versions_article on public.kb_article_versions(article_id);
create index idx_kb_article_stats_article on public.kb_article_stats(article_id);
create index idx_kb_article_feedback_article on public.kb_article_feedback(article_id);

-- Update trigger for search vector
create or replace function kb_articles_search_trigger() returns trigger as $$
begin
    new.search_vector :=
        setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(new.content, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(new.tags, ' ')), 'C');
    return new;
end
$$ language plpgsql;

create trigger kb_articles_search_update
    before insert or update
    on public.kb_articles
    for each row
    execute function kb_articles_search_trigger();

-- RLS Policies for new tables
alter table kb_categories enable row level security;
alter table kb_article_versions enable row level security;
alter table kb_article_stats enable row level security;
alter table kb_article_feedback enable row level security;

-- Categories policies
create policy "Users can view categories in their organization"
    on kb_categories for select
    using (organization_id in (
        select organization_id from profiles
        where id = auth.uid()
    ));

create policy "Agents can manage categories"
    on kb_categories for all
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and organization_id = kb_categories.organization_id
            and role in ('admin', 'agent')
        )
    );

-- Article versions policies
create policy "Users can view article versions in their organization"
    on kb_article_versions for select
    using (
        article_id in (
            select id from kb_articles
            where organization_id in (
                select organization_id from profiles
                where id = auth.uid()
            )
        )
    );

create policy "Agents can manage article versions"
    on kb_article_versions for all
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and role in ('admin', 'agent')
        )
    );

-- Stats policies
create policy "Users can view article stats in their organization"
    on kb_article_stats for select
    using (
        article_id in (
            select id from kb_articles
            where organization_id in (
                select organization_id from profiles
                where id = auth.uid()
            )
        )
    );

-- Feedback policies
create policy "Users can view and create feedback in their organization"
    on kb_article_feedback for select
    using (
        article_id in (
            select id from kb_articles
            where organization_id in (
                select organization_id from profiles
                where id = auth.uid()
            )
        )
    );

create policy "Users can create feedback"
    on kb_article_feedback for insert
    with check (
        article_id in (
            select id from kb_articles
            where organization_id in (
                select organization_id from profiles
                where id = auth.uid()
            )
        )
    );

-- Create indexes
create index idx_tickets_organization on public.tickets(organization_id);
create index idx_tickets_created_by on public.tickets(created_by);
create index idx_tickets_assigned_to on public.tickets(assigned_to);
create index idx_tickets_team on public.tickets(team_id);
create index idx_tickets_status on public.tickets(status);
create index idx_tickets_priority on public.tickets(priority);
create index idx_comments_ticket on public.comments(ticket_id);
create index idx_kb_articles_org on public.kb_articles(organization_id);
create index idx_profiles_organization on public.profiles(organization_id);
create index idx_teams_organization on public.teams(organization_id);
create index idx_audit_logs_org on public.audit_logs(organization_id);
create index idx_audit_logs_resource on public.audit_logs(resource_type, resource_id);

-- Add RLS policies
create policy "Users can view their organization's tickets"
    on tickets for select
    using (organization_id in (
        select organization_id from profiles
        where id = auth.uid()
    ));

create policy "Agents can create tickets"
    on tickets for insert
    with check (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and role in ('agent', 'admin')
        )
    );

-- Update timestamps trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

-- Apply update timestamp triggers
create trigger update_organization_timestamp before update on organizations
    for each row execute function update_updated_at_column();
create trigger update_profile_timestamp before update on profiles
    for each row execute function update_updated_at_column();
create trigger update_team_timestamp before update on teams
    for each row execute function update_updated_at_column();
create trigger update_ticket_timestamp before update on tickets
    for each row execute function update_updated_at_column();
create trigger update_comment_timestamp before update on comments
    for each row execute function update_updated_at_column();
create trigger update_kb_article_timestamp before update on kb_articles
    for each row execute function update_updated_at_column();
create trigger update_webhook_config_timestamp before update on webhook_configs
    for each row execute function update_updated_at_column();

-- RLS Policies
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table teams enable row level security;
alter table tickets enable row level security;
alter table comments enable row level security;
alter table kb_articles enable row level security;
alter table webhook_configs enable row level security;
alter table audit_logs enable row level security;

-- Organization access policy
create policy "Users can view their own organization"
    on organizations for select
    using (id in (
        select organization_id from profiles
        where id = auth.uid()
    ));

-- Drop existing profiles policies first
drop policy if exists "Users can view profiles in their organization" on profiles;

-- Create new non-recursive policies
create policy "Users can view their own profile"
    on profiles for select
    using (auth.uid() = id);

create policy "Users can view profiles in same organization"
    on profiles for select
    using (
        auth.uid() != id 
        and organization_id = (
            select p.organization_id 
            from profiles p 
            where p.id = auth.uid()
            limit 1
        )
    );

-- Team access policies
create policy "Users can view teams in their organization"
    on teams for select
    using (organization_id in (
        select organization_id from profiles
        where id = auth.uid()
    ));

-- Ticket access policies
create policy "Users can view tickets in their organization"
    on tickets for select
    using (organization_id in (
        select organization_id from profiles
        where id = auth.uid()
    ));

-- Audit logging function
create or replace function log_audit_event()
returns trigger as $$
declare
    changes_json jsonb;
    org_id uuid;
begin
    -- Get organization_id based on the table
    case TG_TABLE_NAME
        when 'tickets' then org_id := new.organization_id;
        when 'teams' then org_id := new.organization_id;
        when 'profiles' then org_id := new.organization_id;
        else org_id := null;
    end case;

    -- Calculate changes for UPDATE operations
    if (TG_OP = 'UPDATE') then
        changes_json := jsonb_build_object(
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW)
        );
    elsif (TG_OP = 'INSERT') then
        changes_json := jsonb_build_object(
            'new', to_jsonb(NEW)
        );
    elsif (TG_OP = 'DELETE') then
        changes_json := jsonb_build_object(
            'old', to_jsonb(OLD)
        );
    end if;

    -- Insert audit log
    insert into audit_logs (
        organization_id,
        actor_id,
        event_type,
        resource_type,
        resource_id,
        changes
    ) values (
        org_id,
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        case 
            when TG_OP = 'DELETE' then OLD.id
            else NEW.id
        end,
        changes_json
    );

    return null;
end;
$$ language plpgsql SECURITY DEFINER;

-- Apply audit logging triggers
create trigger audit_tickets
    after insert or update or delete on tickets
    for each row execute function log_audit_event();

create trigger audit_teams
    after insert or update or delete on teams
    for each row execute function log_audit_event();

create trigger audit_profiles
    after insert or update or delete on profiles
    for each row execute function log_audit_event();

-- Queue Configuration
create type sla_priority as enum ('p1', 'p2', 'p3', 'p4');

create table public.queue_configurations (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations not null,
    name varchar(255) not null,
    description text,
    rules jsonb default '[]',
    is_default boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(organization_id, name)
);

-- SLA Configuration
create table public.sla_policies (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations not null,
    name varchar(255) not null,
    description text,
    priority sla_priority not null,
    first_response_time interval not null,
    resolution_time interval not null,
    business_hours boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- SLA Breach Logs
create table public.sla_breach_logs (
    id uuid default uuid_generate_v4() primary key,
    ticket_id uuid references public.tickets not null,
    sla_policy_id uuid references public.sla_policies not null,
    breach_type varchar(50) not null,
    breached_at timestamp with time zone not null,
    time_to_breach interval not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Workload Rules
create table public.workload_rules (
    id uuid default uuid_generate_v4() primary key,
    organization_id uuid references public.organizations not null,
    name varchar(255) not null,
    description text,
    max_tickets_per_agent integer not null,
    ticket_weight_rules jsonb default '[]',
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes
create index idx_tickets_queue on public.tickets(queue_id);
create index idx_tickets_sla_policy on public.tickets(sla_policy_id);
create index idx_sla_breach_logs_ticket on public.sla_breach_logs(ticket_id);
create index idx_queue_config_org on public.queue_configurations(organization_id);
create index idx_sla_policies_org on public.sla_policies(organization_id);
create index idx_workload_rules_org on public.workload_rules(organization_id);

-- Enable RLS
alter table queue_configurations enable row level security;
alter table sla_policies enable row level security;
alter table sla_breach_logs enable row level security;
alter table workload_rules enable row level security;

-- RLS Policies
create policy "Users can view queue configurations in their organization"
    on queue_configurations for select
    using (organization_id in (
        select organization_id from profiles
        where id = auth.uid()
    ));

create policy "Agents can manage queue configurations"
    on queue_configurations for all
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and organization_id = queue_configurations.organization_id
            and role in ('admin', 'agent')
        )
    );

create policy "Users can view SLA policies in their organization"
    on sla_policies for select
    using (organization_id in (
        select organization_id from profiles
        where id = auth.uid()
    ));

create policy "Agents can manage SLA policies"
    on sla_policies for all
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and organization_id = sla_policies.organization_id
            and role in ('admin', 'agent')
        )
    );

create policy "Users can view SLA breach logs in their organization"
    on sla_breach_logs for select
    using (
        ticket_id in (
            select id from tickets
            where organization_id in (
                select organization_id from profiles
                where id = auth.uid()
            )
        )
    );

create policy "Users can view workload rules in their organization"
    on workload_rules for select
    using (organization_id in (
        select organization_id from profiles
        where id = auth.uid()
    ));

create policy "Agents can manage workload rules"
    on workload_rules for all
    using (
        exists (
            select 1 from profiles
            where id = auth.uid()
            and organization_id = workload_rules.organization_id
            and role in ('admin', 'agent')
        )
    );

-- Function to calculate SLA due dates
create or replace function calculate_sla_due_dates(
    p_ticket_id uuid,
    p_sla_policy_id uuid
) returns void as $$
declare
    v_policy sla_policies%rowtype;
begin
    -- Get the SLA policy
    select * into v_policy
    from sla_policies
    where id = p_sla_policy_id;

    -- Update the ticket with calculated due dates
    update tickets
    set
        first_response_due_at = case
            when v_policy.business_hours then
                calculate_business_hours_deadline(now(), v_policy.first_response_time)
            else
                now() + v_policy.first_response_time
            end,
        resolution_due_at = case
            when v_policy.business_hours then
                calculate_business_hours_deadline(now(), v_policy.resolution_time)
            else
                now() + v_policy.resolution_time
            end
    where id = p_ticket_id;
end;
$$ language plpgsql security definer;

-- Function to check SLA breaches
create or replace function check_sla_breaches() returns void as $$
declare
    v_ticket record;
    v_breach_type text;
begin
    -- Check for first response breaches
    for v_ticket in
        select t.id, t.sla_policy_id, t.first_response_due_at
        from tickets t
        where t.status != 'closed'
        and t.first_response_due_at < now()
        and t.sla_status->>'first_response' = 'pending'
    loop
        insert into sla_breach_logs (
            ticket_id,
            sla_policy_id,
            breach_type,
            breached_at,
            time_to_breach
        ) values (
            v_ticket.id,
            v_ticket.sla_policy_id,
            'first_response',
            v_ticket.first_response_due_at,
            now() - v_ticket.first_response_due_at
        );

        update tickets
        set sla_status = jsonb_set(
            sla_status,
            '{first_response}',
            '"breached"'
        )
        where id = v_ticket.id;
    end loop;

    -- Check for resolution breaches
    for v_ticket in
        select t.id, t.sla_policy_id, t.resolution_due_at
        from tickets t
        where t.status != 'closed'
        and t.resolution_due_at < now()
        and t.sla_status->>'resolution' = 'pending'
    loop
        insert into sla_breach_logs (
            ticket_id,
            sla_policy_id,
            breach_type,
            breached_at,
            time_to_breach
        ) values (
            v_ticket.id,
            v_ticket.sla_policy_id,
            'resolution',
            v_ticket.resolution_due_at,
            now() - v_ticket.resolution_due_at
        );

        update tickets
        set sla_status = jsonb_set(
            sla_status,
            '{resolution}',
            '"breached"'
        )
        where id = v_ticket.id;
    end loop;
end;
$$ language plpgsql security definer;

-- Function to assign ticket to queue based on rules
create or replace function assign_ticket_to_queue(
    p_ticket_id uuid,
    p_organization_id uuid
) returns uuid as $$
declare
    v_queue_id uuid;
    v_queue record;
    v_matches boolean;
begin
    -- Try to find a matching queue based on rules
    for v_queue in
        select id, rules
        from queue_configurations
        where organization_id = p_organization_id
        order by is_default desc
    loop
        v_matches := evaluate_queue_rules(p_ticket_id, v_queue.rules::jsonb);
        if v_matches then
            v_queue_id := v_queue.id;
            exit;
        end if;
    end loop;

    -- Update the ticket with the queue assignment
    update tickets
    set queue_id = v_queue_id
    where id = p_ticket_id;

    return v_queue_id;
end;
$$ language plpgsql security definer; 