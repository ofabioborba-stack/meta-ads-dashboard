import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchUserAdAccounts } from "@/lib/meta/api";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("user_meta_tokens")
    .select("access_token, meta_user_name, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: "Token Meta não encontrado" }, { status: 404 });
  }

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    return NextResponse.json({ error: "Token Meta expirado" }, { status: 401 });
  }

  try {
    const accounts = await fetchUserAdAccounts(tokenRow.access_token);

    // Only flag accounts already registered by THIS user (not other tenants)
    const { data: userClients } = await admin
      .from("clients")
      .select("id")
      .eq("owner_user_id", user.id);
    const clientIds = userClients?.map((c) => c.id) ?? [];
    const { data: existing } = clientIds.length > 0
      ? await admin.from("client_accounts").select("account_id").in("client_id", clientIds)
      : { data: [] };
    const registeredIds = new Set(existing?.map((e) => e.account_id) ?? []);

    return NextResponse.json({
      meta_user_name: tokenRow.meta_user_name,
      accounts: accounts.map((a) => ({
        ...a,
        already_registered: registeredIds.has(a.id),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
