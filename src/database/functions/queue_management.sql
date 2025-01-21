-- Helper function to calculate business hours deadline
CREATE OR REPLACE FUNCTION calculate_business_hours_deadline(
    start_time TIMESTAMP WITH TIME ZONE,
    duration INTERVAL
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    curr_time TIMESTAMP WITH TIME ZONE;
    remaining_duration INTERVAL;
    business_day_duration INTERVAL := INTERVAL '8 hours';
BEGIN
    curr_time := start_time;
    remaining_duration := duration;
    
    WHILE remaining_duration > INTERVAL '0' LOOP
        -- Skip weekends
        IF EXTRACT(DOW FROM curr_time) IN (0, 6) THEN
            curr_time := curr_time + INTERVAL '1 day';
            CONTINUE;
        END IF;
        
        -- If remaining duration is less than a business day
        IF remaining_duration <= business_day_duration THEN
            curr_time := curr_time + remaining_duration;
            remaining_duration := INTERVAL '0';
        ELSE
            curr_time := curr_time + business_day_duration;
            remaining_duration := remaining_duration - business_day_duration;
        END IF;
        
        -- Move to next day if we've used up current business day
        IF remaining_duration > INTERVAL '0' THEN
            curr_time := curr_time + INTERVAL '16 hours'; -- Skip non-business hours
        END IF;
    END LOOP;
    
    RETURN curr_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate SLA due dates
CREATE OR REPLACE FUNCTION calculate_sla_due_dates(
    p_ticket_id UUID,
    p_sla_policy_id UUID
) RETURNS VOID AS $$
DECLARE
    v_policy sla_policies%ROWTYPE;
BEGIN
    -- Get the SLA policy
    SELECT * INTO v_policy
    FROM sla_policies
    WHERE id = p_sla_policy_id;

    -- Update the ticket with calculated due dates
    UPDATE tickets
    SET
        first_response_due_at = CASE
            WHEN v_policy.business_hours THEN
                calculate_business_hours_deadline(NOW(), v_policy.first_response_time)
            ELSE
                NOW() + v_policy.first_response_time
            END,
        resolution_due_at = CASE
            WHEN v_policy.business_hours THEN
                calculate_business_hours_deadline(NOW(), v_policy.resolution_time)
            ELSE
                NOW() + v_policy.resolution_time
            END
    WHERE id = p_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check SLA breaches
CREATE OR REPLACE FUNCTION check_sla_breaches() RETURNS VOID AS $$
DECLARE
    v_ticket RECORD;
BEGIN
    -- Check for first response breaches
    FOR v_ticket IN
        SELECT t.id, t.sla_policy_id, t.first_response_due_at
        FROM tickets t
        WHERE t.status != 'closed'
        AND t.first_response_due_at < NOW()
        AND t.sla_status->>'first_response' = 'pending'
    LOOP
        INSERT INTO sla_breach_logs (
            ticket_id,
            sla_policy_id,
            breach_type,
            breached_at,
            time_to_breach
        ) VALUES (
            v_ticket.id,
            v_ticket.sla_policy_id,
            'first_response',
            v_ticket.first_response_due_at,
            NOW() - v_ticket.first_response_due_at
        );

        UPDATE tickets
        SET sla_status = jsonb_set(
            sla_status,
            '{first_response}',
            '"breached"'
        )
        WHERE id = v_ticket.id;
    END LOOP;

    -- Check for resolution breaches
    FOR v_ticket IN
        SELECT t.id, t.sla_policy_id, t.resolution_due_at
        FROM tickets t
        WHERE t.status != 'closed'
        AND t.resolution_due_at < NOW()
        AND t.sla_status->>'resolution' = 'pending'
    LOOP
        INSERT INTO sla_breach_logs (
            ticket_id,
            sla_policy_id,
            breach_type,
            breached_at,
            time_to_breach
        ) VALUES (
            v_ticket.id,
            v_ticket.sla_policy_id,
            'resolution',
            v_ticket.resolution_due_at,
            NOW() - v_ticket.resolution_due_at
        );

        UPDATE tickets
        SET sla_status = jsonb_set(
            sla_status,
            '{resolution}',
            '"breached"'
        )
        WHERE id = v_ticket.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to evaluate queue rules
CREATE OR REPLACE FUNCTION evaluate_queue_rules(
    p_ticket_id UUID,
    p_rules JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_rule JSONB;
    v_condition JSONB;
    v_matches BOOLEAN;
    v_ticket tickets%ROWTYPE;
BEGIN
    -- Get ticket details
    SELECT * INTO v_ticket
    FROM tickets
    WHERE id = p_ticket_id;

    -- If no rules, return true (default queue)
    IF jsonb_array_length(p_rules) = 0 THEN
        RETURN TRUE;
    END IF;

    -- Evaluate each rule
    FOR v_rule IN SELECT * FROM jsonb_array_elements(p_rules)
    LOOP
        v_matches := TRUE;
        
        -- Check all conditions in the rule
        FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule->'conditions')
        LOOP
            CASE v_condition->>'field'
                WHEN 'priority' THEN
                    IF v_condition->>'operator' = 'equals' THEN
                        v_matches := v_matches AND v_ticket.priority::text = v_condition->>'value';
                    END IF;
                WHEN 'status' THEN
                    IF v_condition->>'operator' = 'equals' THEN
                        v_matches := v_matches AND v_ticket.status::text = v_condition->>'value';
                    END IF;
                WHEN 'tags' THEN
                    IF v_condition->>'operator' = 'contains' THEN
                        v_matches := v_matches AND v_ticket.tags @> ARRAY[v_condition->>'value'];
                    END IF;
                WHEN 'category' THEN
                    IF v_condition->>'operator' = 'equals' THEN
                        v_matches := v_matches AND v_ticket.metadata->>'category' = v_condition->>'value';
                    END IF;
            END CASE;
        END LOOP;

        -- If all conditions match, return true
        IF v_matches THEN
            RETURN TRUE;
        END IF;
    END LOOP;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign ticket to queue
CREATE OR REPLACE FUNCTION assign_ticket_to_queue(
    p_ticket_id UUID,
    p_organization_id UUID
) RETURNS UUID AS $$
DECLARE
    v_queue_id UUID;
    v_queue RECORD;
    v_matches BOOLEAN;
BEGIN
    -- Try to find a matching queue based on rules
    FOR v_queue IN
        SELECT id, rules
        FROM queue_configurations
        WHERE organization_id = p_organization_id
        ORDER BY is_default DESC
    LOOP
        v_matches := evaluate_queue_rules(p_ticket_id, v_queue.rules::jsonb);
        IF v_matches THEN
            v_queue_id := v_queue.id;
            EXIT;
        END IF;
    END LOOP;

    -- Update the ticket with the queue assignment
    UPDATE tickets
    SET queue_id = v_queue_id
    WHERE id = p_ticket_id;

    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 