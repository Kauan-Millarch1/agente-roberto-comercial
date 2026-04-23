-- Enable RLS on tables containing sensitive dashboard data.
-- No policies created intentionally — service role bypasses RLS and
-- handles all application access. Blocks anon/authenticated exposure
-- via PostgREST if the anon key is ever misplaced.

ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roberto_audit_log ENABLE ROW LEVEL SECURITY;
