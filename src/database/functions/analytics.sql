-- Ticket metrics calculation function
CREATE OR REPLACE FUNCTION calculate_ticket_metrics(
  p_organization_id UUID,
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
  WITH metrics AS (
    SELECT
      COUNT(*) as total_tickets,
      COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
      COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
      AVG(EXTRACT(EPOCH FROM (
        CASE 
          WHEN status = 'resolved' 
          THEN updated_at 
          ELSE CURRENT_TIMESTAMP 
        END - created_at
      ))/3600)::numeric(10,2) as avg_resolution_time_hours,
      priority,
      status
    FROM tickets
    WHERE 
      organization_id = p_organization_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
    GROUP BY priority, status
  )
  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'total_tickets', SUM(total_tickets),
        'open_tickets', SUM(open_tickets),
        'resolved_tickets', SUM(resolved_tickets),
        'avg_resolution_time', AVG(avg_resolution_time_hours)
      )
      FROM metrics
    ),
    'by_priority', (
      SELECT json_object_agg(priority, json_build_object(
        'count', total_tickets,
        'resolution_time', avg_resolution_time_hours
      ))
      FROM metrics
      GROUP BY priority
    ),
    'by_status', (
      SELECT json_object_agg(status, count)
      FROM (
        SELECT status, SUM(total_tickets) as count
        FROM metrics
        GROUP BY status
      ) s
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Agent performance metrics
CREATE OR REPLACE FUNCTION calculate_agent_performance(
  p_agent_id UUID,
  p_organization_id UUID,
  p_timeframe TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  start_date TIMESTAMP;
BEGIN
  -- Calculate start date based on timeframe
  start_date := CASE
    WHEN p_timeframe LIKE '%d' THEN NOW() - (p_timeframe::integer || ' days')::INTERVAL
    WHEN p_timeframe LIKE '%w' THEN NOW() - (p_timeframe::integer || ' weeks')::INTERVAL
    WHEN p_timeframe LIKE '%m' THEN NOW() - (p_timeframe::integer || ' months')::INTERVAL
    ELSE NOW() - '7 days'::INTERVAL
  END;

  WITH agent_metrics AS (
    SELECT
      COUNT(*) as total_handled,
      COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)::numeric(10,2) as avg_resolution_time,
      COUNT(CASE WHEN priority = 'high' OR priority = 'urgent' THEN 1 END) as high_priority_handled
    FROM tickets
    WHERE 
      assigned_to = p_agent_id
      AND organization_id = p_organization_id
      AND created_at >= start_date
  )
  SELECT json_build_object(
    'agent_id', p_agent_id,
    'timeframe', p_timeframe,
    'metrics', (
      SELECT json_build_object(
        'total_handled', total_handled,
        'resolved_tickets', resolved_tickets,
        'resolution_rate', (resolved_tickets::float / NULLIF(total_handled, 0) * 100)::numeric(5,2),
        'avg_resolution_time', avg_resolution_time,
        'high_priority_handled', high_priority_handled
      )
      FROM agent_metrics
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Customer satisfaction metrics
CREATE OR REPLACE FUNCTION calculate_customer_satisfaction(
  p_organization_id UUID,
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
  WITH satisfaction_metrics AS (
    SELECT
      t.id as ticket_id,
      t.status,
      t.priority,
      t.created_at,
      t.resolved_at,
      t.satisfaction_rating,
      t.satisfaction_comment,
      p.full_name as customer_name
    FROM tickets t
    JOIN profiles p ON t.created_by = p.id
    WHERE 
      t.organization_id = p_organization_id
      AND t.created_at BETWEEN p_start_date AND p_end_date
      AND t.satisfaction_rating IS NOT NULL
  )
  SELECT json_build_object(
    'overall_satisfaction', (
      SELECT json_build_object(
        'average_rating', AVG(satisfaction_rating),
        'total_ratings', COUNT(*),
        'rating_distribution', json_object_agg(
          satisfaction_rating::text, 
          COUNT(*)
        )
      )
      FROM satisfaction_metrics
    ),
    'by_priority', (
      SELECT json_object_agg(
        priority,
        json_build_object(
          'average_rating', AVG(satisfaction_rating),
          'count', COUNT(*)
        )
      )
      FROM satisfaction_metrics
      GROUP BY priority
    ),
    'trend', (
      SELECT json_agg(
        json_build_object(
          'date', date_trunc('day', created_at),
          'average_rating', AVG(satisfaction_rating),
          'count', COUNT(*)
        )
      )
      FROM satisfaction_metrics
      GROUP BY date_trunc('day', created_at)
      ORDER BY date_trunc('day', created_at)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Response time analytics
CREATE OR REPLACE FUNCTION calculate_response_metrics(
  p_organization_id UUID,
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
  WITH response_metrics AS (
    SELECT
      t.id as ticket_id,
      t.priority,
      t.created_at,
      t.first_response_at,
      t.resolved_at,
      EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))/60 as first_response_time,
      EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600 as resolution_time,
      tm.name as team_name
    FROM tickets t
    LEFT JOIN teams tm ON t.team_id = tm.id
    WHERE 
      t.organization_id = p_organization_id
      AND t.created_at BETWEEN p_start_date AND p_end_date
      AND t.first_response_at IS NOT NULL
  )
  SELECT json_build_object(
    'overall_metrics', (
      SELECT json_build_object(
        'avg_first_response_minutes', AVG(first_response_time)::numeric(10,2),
        'avg_resolution_hours', AVG(resolution_time)::numeric(10,2),
        'total_tickets', COUNT(*)
      )
      FROM response_metrics
    ),
    'by_priority', (
      SELECT json_object_agg(
        priority,
        json_build_object(
          'avg_first_response_minutes', AVG(first_response_time)::numeric(10,2),
          'avg_resolution_hours', AVG(resolution_time)::numeric(10,2),
          'count', COUNT(*)
        )
      )
      FROM response_metrics
      GROUP BY priority
    ),
    'by_team', (
      SELECT json_object_agg(
        team_name,
        json_build_object(
          'avg_first_response_minutes', AVG(first_response_time)::numeric(10,2),
          'avg_resolution_hours', AVG(resolution_time)::numeric(10,2),
          'count', COUNT(*)
        )
      )
      FROM response_metrics
      WHERE team_name IS NOT NULL
      GROUP BY team_name
    ),
    'hourly_distribution', (
      SELECT json_object_agg(
        hour::text,
        count
      )
      FROM (
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count
        FROM response_metrics
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      ) h
    )
  ) INTO result;

  RETURN result;
END;
$$; 