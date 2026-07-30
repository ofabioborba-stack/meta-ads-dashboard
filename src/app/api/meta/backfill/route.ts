import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAdInsights } from "@/lib/meta/api";
import type { RawInsightRow } from "@/lib/meta/api";

async function insertInsights(
  admin: ReturnType<typeof createAdminClient>,
  clienteId: string,
  rows: RawInsightRow[]
) {
  if (rows.length === 0) return;

  const dates = [...new Set(rows.map((r) => r.date))];
  await admin
    .from("meta_ads_raw_data")
    .delete()
    .eq("cliente_id", clienteId)
    .in("data", dates);

  const dbRows = rows.map((r) => ({
    data: r.date,
    cliente_id: clienteId,
    ad_id: r.ad_id,
    campanha: r.campaign_name,
    anuncio: r.ad_name,
    account_name: r.account_name,
    alcance: r.reach,
    impressoes: r.impressions,
    cliques: r.clicks,
    resultados: r.resultados,
    mensagens_iniciadas: r.mensagens_iniciadas,
    comentarios: r.comentarios,
    salvos: r.salvos,
    compartilhamentos: r.compartilhamentos,
    cpc: r.cpc,
    cpm: r.cpm,
    ctr: r.ctr,
    custo_por_lead: r.custo_por_lead,
    custo_por_mensagem: r.custo_por_mensagem,
    custo_por_resultado: r.custo_por_resultado,
    custo_total: r.spend,
    leads: r.leads,
    add_to_cart: r.add_to_cart,
    purchases: r.purchases,
    initiate_checkout: r.initiate_checkout,
    purchase_value: r.purchase_value,
    instagram_profile_visits: r.instagram_profile_visits,
  }));

  const BATCH = 200;
  for (let i = 0; i < dbRows.length; i += BATCH) {
    const { error } = await admin
      .from("meta_ads_raw_data")
      .insert(dbRows.slice(i, i + BATCH));
    if (error) throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { account_id, days = 30 } = body as {
    account_id?: string;
    days?: number;
  };

  if (!account_id) {
    return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify account belongs to this user
  const { data: accountRow } = await admin
    .from("client_accounts")
    .select("id, account_id, account_name, client:clients!inner(owner_user_id)")
    .eq("account_id", account_id)
    .maybeSingle();

  if (!accountRow) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  const ownerId = (accountRow.client as unknown as { owner_user_id: string | null })
    .owner_user_id;

  if (ownerId !== user.id) {
    return NextResponse.json({ error: "Sem permissão para esta conta" }, { status: 403 });
  }

  const { data: tokenRow } = await admin
    .from("user_meta_tokens")
    .select("access_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: "Token Meta não encontrado" }, { status: 404 });
  }

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    return NextResponse.json({ error: "Token Meta expirado — reconecte sua conta." }, { status: 401 });
  }

  const until = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  try {
    const rows = await fetchAdInsights(
      account_id,
      since,
      until,
      tokenRow.access_token,
      accountRow.account_name ?? undefined
    );

    const clienteId = account_id.replace("act_", "");
    await insertInsights(admin, clienteId, rows);

    await admin
      .from("client_accounts")
      .update({
        backfill_status: "done",
        backfill_from: since,
        backfill_until: until,
      })
      .eq("id", accountRow.id);

    return NextResponse.json({ ok: true, rows: rows.length, since, until });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
