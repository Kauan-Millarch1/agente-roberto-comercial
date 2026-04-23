import { createClient } from "./supabase";

const ALLOWED_DOMAIN = "ecommercepuro.com.br";

export async function signInWithGoogle() {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/login";
}

export function isAllowedEmail(email: string): boolean {
  return email.endsWith(`@${ALLOWED_DOMAIN}`);
}
