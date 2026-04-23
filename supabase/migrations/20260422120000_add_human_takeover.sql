-- Human takeover: allows dashboard operators to pause AI and respond manually
ALTER TABLE roberto_leads
  ADD COLUMN human_takeover BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN human_takeover_at TIMESTAMPTZ,
  ADD COLUMN human_takeover_by TEXT;

-- Partial index: only indexes active takeovers (few rows)
CREATE INDEX idx_roberto_leads_human_takeover
  ON roberto_leads (human_takeover) WHERE human_takeover = true;
