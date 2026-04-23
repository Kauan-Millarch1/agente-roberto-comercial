-- Function: find leads where last message is outbound with no inbound reply
-- Only considers leads that are active (not COMPROU/PERDIDO/HANDOFF) and not under human takeover
CREATE OR REPLACE FUNCTION get_vacuum_candidates()
RETURNS TABLE (
  phone TEXT,
  last_outbound_at TIMESTAMPTZ,
  lead_name TEXT
) AS $$
  WITH last_msg_per_lead AS (
    SELECT DISTINCT ON (m.phone)
      m.phone,
      m.direction,
      m.created_at
    FROM roberto_messages m
    INNER JOIN roberto_leads l ON l.phone = m.phone
    WHERE l.status NOT IN ('COMPROU', 'PERDIDO', 'HANDOFF')
      AND l.human_takeover = false
    ORDER BY m.phone, m.created_at DESC
  )
  SELECT
    lm.phone,
    lm.created_at AS last_outbound_at,
    COALESCE(l.name, '') AS lead_name
  FROM last_msg_per_lead lm
  INNER JOIN roberto_leads l ON l.phone = lm.phone
  WHERE lm.direction = 'outbound';
$$ LANGUAGE SQL SECURITY DEFINER;

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule vacuum check every 5 minutes
-- Calls the Edge Function via pg_net (HTTP request from inside Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron job: calls vacuum-check Edge Function every 5 minutes
SELECT cron.schedule(
  'vacuum-check-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/vacuum-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
