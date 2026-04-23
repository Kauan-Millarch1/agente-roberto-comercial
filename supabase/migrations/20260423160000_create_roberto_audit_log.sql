-- Audit log for dashboard-originated actions against Roberto's data plane.
-- Used for:
--   1) Forensics (who sent what, when)
--   2) Rate limiting (count recent rows per user_id)
-- One row per mutating action. Content is hashed (SHA-256) to avoid PII
-- duplication — full content already lives in roberto_messages.
CREATE TABLE roberto_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL,
  phone        TEXT,
  content_hash TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index for rate-limit queries:
-- SELECT count(*) FROM roberto_audit_log
--   WHERE user_id = $1 AND created_at >= now() - interval '60 seconds';
CREATE INDEX idx_roberto_audit_log_user_created
  ON roberto_audit_log (user_id, created_at DESC);
