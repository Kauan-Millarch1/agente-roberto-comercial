-- Dashboard Users: role-based access control for the Roberto dashboard
-- Roles: super_admin (4), admin (3), operator (2), viewer (1)

-- Role hierarchy helper function
CREATE OR REPLACE FUNCTION public.role_level(r text)
RETURNS int AS $$
  SELECT CASE r
    WHEN 'super_admin' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'operator' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Main table
CREATE TABLE public.dashboard_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin', 'admin', 'operator', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick role lookups
CREATE INDEX idx_dashboard_users_role ON public.dashboard_users(role);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION public.set_dashboard_users_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dashboard_users_updated_at
  BEFORE UPDATE ON public.dashboard_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dashboard_users_updated_at();

-- Auto-provision new auth users as viewer
CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.dashboard_users (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.on_auth_user_created();

-- Super admin seeding is handled by scripts/seed_super_admin.py
-- (reads SUPER_ADMIN_EMAIL + SUPABASE credentials from .env and upserts the role).
-- Run it once after this migration and after the admin has logged in at least once.
