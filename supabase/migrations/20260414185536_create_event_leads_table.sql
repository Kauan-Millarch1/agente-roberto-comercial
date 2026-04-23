-- rollback: DROP TABLE IF EXISTS event_leads;

CREATE TABLE IF NOT EXISTS event_leads (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product               TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  full_name             TEXT        NOT NULL,
  company_name          TEXT,
  role                  TEXT,
  phone                 TEXT        NOT NULL,
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  utm_content           TEXT,
  utm_term              TEXT,
  company_state         TEXT,
  monthly_revenue       TEXT,
  knowledge_investment  TEXT,
  tax_regime            TEXT,
  form_submitted_at     TIMESTAMPTZ,
  event_month           DATE        NOT NULL,
  contacted_at          TIMESTAMPTZ,
  proactive_sent_at     TIMESTAMPTZ,
  status                TEXT        NOT NULL DEFAULT 'new'
                                    CHECK (status IN ('new', 'contacted', 'proactive_sent')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_leads
  ADD CONSTRAINT unq_event_leads_email_product_month
  UNIQUE (email, product, event_month);

CREATE INDEX idx_event_leads_proactive_pending
  ON event_leads (form_submitted_at)
  WHERE contacted_at IS NULL
    AND proactive_sent_at IS NULL
    AND status = 'new';

ALTER TABLE event_leads ENABLE ROW LEVEL SECURITY;
