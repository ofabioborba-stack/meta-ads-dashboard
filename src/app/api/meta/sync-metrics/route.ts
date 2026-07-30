import { NextResponse } from "next/server";
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
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  const syncSecret = request.headers.get("x-sync-secret") ?? bearerToken;

  const validSync = process.env.SYNC_SECRET && syncSecret === process.env.SYNC_SECRET;
  const validCron = process.env.CRON_SECRET && bearerToken === process.env.CRON_SECRET;

  if (!validSync && !validCron) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const syncDate: string =
    body.date ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Quando chamado pelo Vercel Cron (CRON_SECRET), sincroniza apenas contas de gestores.
  // Chamadas manuais via SYNC_SECRET sincronizam tudo.
  const gestoresOnly = validCron && !validSync;

  const admin = createAdminClient();

  let accountsQuery = admin
    .from("client_accounts")
    .select("id, account_id, account_name, client:clients!inner(id, owner_user_id)")
    .eq("platform", "meta");

  if (gestoresOnly) {
    accountsQuery = accountsQuery.not("client.owner_user_id", "is", null);
  }

  const { data: accounts, error: accErr } = await accountsQuery;

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 500 });
  }
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ synced: 0, failed: 0, date: syncDate, results: [] });
  }

  // Fetch tokens for gestor accounts
  type AccountRow = (typeof accounts)[0];
  const ownerIds = [
    ...new Set(
      (accounts as AccountRow[])
        .map((a) => (a.client as unknown as { owner_user_id: string | null }).owner_user_id)
        .filter(Boolean) as string[]
    ),
  ];

  const tokenMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: tokens } = await admin
      .from("user_meta_tokens")
      .select("user_id, access_token, expires_at")
      .in("user_id", ownerIds);

    for (const t of tokens ?? []) {
      const exp = t.expires_at ? new Date(t.expires_at) : null;
      if (!exp || exp > new Date()) tokenMap.set(t.user_id, t.access_token);
    }
  }

  const kiwiToken = process.env.META_ACCESS_TOKEN;
  const results: { account_id: string; ok: boolean; rows?: number; error?: string }[] = [];

  for (const account of accounts as AccountRow[]) {
    const ownerId = (account.client as unknown as { owner_user_id: string | null }).owner_user_id;

    let token: string | undefined;

    if (ownerId) {
      // Gestor account — use their OAuth token, fall back to admin token if not connected yet
      token = tokenMap.get(ownerId) ?? kiwiToken;
      if (!token) {
        results.push({
          account_id: account.account_id,
          ok: false,
          error: "Token Meta não disponível — gestor precisa reconectar e META_ACCESS_TOKEN não configurado",
        });
        continue;
      }
    } else {
      // Conta sem gestor — usa META_ACCESS_TOKEN do ambiente
      if (!kiwiToken) {
        results.push({
          account_id: account.account_id,
          ok: false,
          error: "META_ACCESS_TOKEN não configurado no servidor",
        });
        continue;
      }
      token = kiwiToken;
    }

    try {
      const rows = await fetchAdInsights(
        account.account_id,
        syncDate,
        syncDate,
        token,
        account.account_name ?? undefined
      );

      const clienteId = account.account_id.replace("act_", "");
      await insertInsights(admin, clienteId, rows);

      results.push({ account_id: account.account_id, ok: true, rows: rows.length });
    } catch (err) {
      results.push({
        account_id: account.account_id,
        ok: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return NextResponse.json({
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    date: syncDate,
    results,
  });
}

// Vercel Cron sends GET — delegate to POST handler
export const GET = POST;
