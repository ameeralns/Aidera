-- Team performance metrics
CREATE OR REPLACE FUNCTION calculate_team_performance(
  p_team_id UUID,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH team_metrics AS (
    SELECT
      t.id as ticket_id,
      t.status,
      t.priority,
      t.created_at,
      t.updated_at,
      p.id as agent_id,
      p.full_name as agent_name
    FROM tickets t
    JOIN profiles p ON t.assigned_to = p.id
    WHERE 
      t.team_id = p_team_id
      AND t.created_at BETWEEN p_start_date AND p_end_date
  )
  SELECT json_build_object(
    'team_id', p_team_id,
    'period', json_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'metrics', json_build_object(
      'total_tickets', COUNT(*),
      'avg_resolution_time', AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600),
      'by_priority', (
        SELECT json_object_agg(priority, count)
        FROM (
          SELECT priority, COUNT(*) as count
          FROM team_metrics
          GROUP BY priority
        ) p
      ),
      'by_agent', (
        SELECT json_agg(json_build_object(
          'agent_id', agent_id,
          'agent_name', agent_name,
          'tickets_handled', COUNT(*),
          'avg_resolution_time', AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)
        ))
        FROM team_metrics
        GROUP BY agent_id, agent_name
      )
    )
  ) INTO result
  FROM team_metrics;

  RETURN result;
END;
$$;

-- Workload distribution function
CREATE OR REPLACE FUNCTION get_team_workload(
  p_organization_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH team_load AS (
    SELECT
      t.team_id,
      tm.name as team_name,
      COUNT(CASE WHEN t.status = 'open' THEN 1 END) as open_tickets,
      COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tickets,
      COUNT(DISTINCT t.assigned_to) as active_agents,
      ARRAY_AGG(DISTINCT t.assigned_to) as agent_ids
    FROM tickets t
    JOIN teams tm ON t.team_id = tm.id
    WHERE t.organization_id = p_organization_id
    GROUP BY t.team_id, tm.name
  )
  SELECT json_agg(json_build_object(
    'team_id', team_id,
    'team_name', team_name,
    'workload', json_build_object(
      'open_tickets', open_tickets,
      'pending_tickets', pending_tickets,
      'active_agents', active_agents,
      'tickets_per_agent', (open_tickets + pending_tickets)::float / NULLIF(active_agents, 0)
    )
  )) INTO result
  FROM team_load;

  RETURN COALESCE(result, '[]'::json);
END;
$$; 