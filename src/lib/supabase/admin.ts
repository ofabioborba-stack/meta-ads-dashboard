import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Client com service role — usar apenas em rotas de API server-side. */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
