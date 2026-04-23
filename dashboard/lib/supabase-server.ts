import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using service_role key.
 * NEVER import this file from client components.
 * This bypasses RLS — use only in API routes and server components.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
