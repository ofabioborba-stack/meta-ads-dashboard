import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";

const GRAPH = "https://graph.facebook.com/v23.0";

// GET /api/social/accounts
// Retorna as Pages acessíveis pelo token + contas já registradas no banco
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "META_ACCESS_TOKEN não configurado" }, { status: 500 });

  const admin = createAdminClient();

  // Pages acessíveis via token
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id,name}&limit=100&access_token=${token}`,
    { cache: "no-store" }
  );
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

  // Contas já registradas
  const { data: registered } = await admin
    .from("social_accounts")
    .select("platform_account_id, platform, client_id, account_name, clients(name)");

  const registeredSet = new Set(
    (registered ?? []).map((r) => `${r.platform}:${r.platform_account_id}`)
  );

  // Todos os clientes para o admin fazer o mapeamento
  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  const pages = (data.data ?? []).map((page: Record<string, unknown>) => {
    const ig = page.instagram_business_account as { id: string; name: string } | undefined;
    return {
      fb_page_id:   page.id,
      fb_page_name: page.name,
      ig_account_id:   ig?.id   ?? null,
      ig_account_name: ig?.name ?? null,
      fb_registered: registeredSet.has(`facebook:${page.id}`),
      ig_registered: ig ? registeredSet.has(`instagram:${ig.id}`) : false,
    };
  });

  return NextResponse.json({ pages, clients: clients ?? [] });
}

// POST /api/social/accounts
// Body: { client_id, fb_page_id, ig_account_id?, account_name }
// Registra Page e/ou conta IG para um cliente
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { client_id, fb_page_id, ig_account_id, account_name } = body as {
    client_id: string;
    fb_page_id: string;
    ig_account_id?: string;
    account_name: string;
  };

  if (!client_id || !fb_page_id || !account_name) {
    return NextResponse.json({ error: "client_id, fb_page_id e account_name são obrigatórios" }, { status: 400 });
  }

  const admin = createAdminClient();
  const upserted: string[] = [];

  // Facebook Page
  const { error: fbErr } = await admin.from("social_accounts").upsert(
    {
      client_id,
      platform:            "facebook",
      platform_account_id: fb_page_id,
      fb_page_id,
      account_name,
    },
    { onConflict: "platform_account_id,platform" }
  );
  if (fbErr) return NextResponse.json({ error: `FB: ${fbErr.message}` }, { status: 500 });
  upserted.push("facebook");

  // Instagram (opcional)
  if (ig_account_id) {
    const { error: igErr } = await admin.from("social_accounts").upsert(
      {
        client_id,
        platform:            "instagram",
        platform_account_id: ig_account_id,
        fb_page_id,
        account_name,
      },
      { onConflict: "platform_account_id,platform" }
    );
    if (igErr) return NextResponse.json({ error: `IG: ${igErr.message}` }, { status: 500 });
    upserted.push("instagram");
  }

  return NextResponse.json({ ok: true, registered: upserted });
}
