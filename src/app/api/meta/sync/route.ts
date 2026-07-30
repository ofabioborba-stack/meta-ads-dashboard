import { NextResponse } from "next/server";
import { manualBalance } from "@/lib/funding";
import { getAccountBalance } from "@/lib/meta/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText, toWhatsappNumber } from "@/lib/evolution";
import { formatCurrency } from "@/lib/utils";

/**
 * Sincroniza o saldo das contas Meta (chamado pelo n8n 1× ao dia).
 * - Contas sem owner: usa META_ACCESS_TOKEN do ambiente.
 * - Contas de gestores (com owner): usa o token OAuth do gestor.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
  const syncSecret = request.headers.get("x-sync-secret") ?? bearerToken;

  const validSync = process.env.SYNC_SECRET && syncSecret === process.env.SYNC_SECRET;
  const validCron = process.env.CRON_SECRET && bearerToken === process.env.CRON_SECRET;

  if (!validSync && !validCron) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: accounts, error } = await supabase
    .from("client_accounts")
    .select(
      `id, account_id, alert_threshold, funding_amount, funding_date, funding_tax_rate,
       client:clients!inner(
         name, owner_user_id, whatsapp_notify, whatsapp_notify_2, whatsapp_group_jid,
         notify_balance_number, notify_balance_group,
         group:groups!inner(tenant:tenants!inner(evolution_instance,evolution_api_key))
       )`
    )
    .eq("platform", "meta");

  if (error) {
    return NextResponse.json(
      { error: `Erro ao buscar contas: ${error.message}` },
      { status: 500 }
    );
  }

  // Collect unique owner IDs of gestor accounts and fetch their tokens
  type AccountRow = NonNullable<typeof accounts>[0];

  const ownerIds = [
    ...new Set(
      (accounts ?? [])
        .map((a) => (a.client as unknown as { owner_user_id: string | null }).owner_user_id)
        .filter(Boolean) as string[]
    ),
  ];

  const tokenMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: tokens } = await supabase
      .from("user_meta_tokens")
      .select("user_id, access_token, expires_at")
      .in("user_id", ownerIds);

    for (const t of tokens ?? []) {
      const exp = t.expires_at ? new Date(t.expires_at) : null;
      if (!exp || exp > new Date()) tokenMap.set(t.user_id, t.access_token);
    }
  }

  const results: {
    account_id: string;
    ok: boolean;
    balance?: number | null;
    error?: string;
  }[] = [];

  for (const account of (accounts ?? []) as AccountRow[]) {
    const ownerId = (account.client as unknown as { owner_user_id: string | null })
      .owner_user_id;
    const overrideToken = ownerId ? tokenMap.get(ownerId) : undefined;

    // Skip gestor accounts whose token is expired
    if (ownerId && !overrideToken) {
      results.push({
        account_id: account.account_id,
        ok: false,
        error: "Token Meta expirado — gestor precisa reconectar",
      });
      continue;
    }

    try {
      let { balance, currency, isPrepaid } = await getAccountBalance(
        account.account_id,
        overrideToken
      );

      if (!isPrepaid && account.funding_amount != null && account.funding_date) {
        balance = await manualBalance(
          account.account_id,
          Number(account.funding_amount),
          account.funding_date,
          Number(account.funding_tax_rate ?? 0)
        );
        isPrepaid = true;
      }

      const { error: upsertError } = await supabase.from("account_balance").upsert(
        {
          account_id: account.id,
          balance,
          currency,
          is_prepaid: isPrepaid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id" }
      );
      if (upsertError) throw new Error(upsertError.message);

      results.push({ account_id: account.account_id, ok: true, balance });

      // Alerta de saldo baixo via Evolution
      const threshold = account.alert_threshold ?? 0;
      if (balance !== null && threshold > 0 && balance < threshold) {
        type ClientInfo = {
          name: string;
          owner_user_id: string | null;
          whatsapp_notify: string | null;
          whatsapp_notify_2: string | null;
          whatsapp_group_jid: string | null;
          notify_balance_number: boolean;
          notify_balance_group: boolean;
          group: { tenant: { evolution_instance: string | null; evolution_api_key: string | null } } | null;
        };
        const c = account.client as unknown as ClientInfo;
        const evolutionInstance = c.group?.tenant?.evolution_instance ?? process.env.EVOLUTION_INSTANCE;
        const evolutionApiKey   = c.group?.tenant?.evolution_api_key  ?? process.env.EVOLUTION_API_KEY;
        const msg =
          `⚠️ *SALDO BAIXO* ⚠️\n\n` +
          `🏢 *Cliente:* ${c.name}\n` +
          `💰 *Saldo atual:* ${formatCurrency(balance)}\n` +
          `🚨 *Limite configurado:* ${formatCurrency(threshold)}\n\n` +
          `Recarregue a conta no Gerenciador de Anúncios para não interromper as campanhas.`;

        const sends: Promise<void>[] = [];
        if (evolutionInstance && evolutionApiKey && c.notify_balance_number && c.whatsapp_notify)
          sends.push(sendText(toWhatsappNumber(c.whatsapp_notify), msg, evolutionInstance, evolutionApiKey).catch(() => {}));
        if (evolutionInstance && evolutionApiKey && c.notify_balance_number && c.whatsapp_notify_2)
          sends.push(sendText(toWhatsappNumber(c.whatsapp_notify_2), msg, evolutionInstance, evolutionApiKey).catch(() => {}));
        if (evolutionInstance && evolutionApiKey && c.notify_balance_group && c.whatsapp_group_jid)
          sends.push(sendText(c.whatsapp_group_jid, msg, evolutionInstance, evolutionApiKey).catch(() => {}));
        await Promise.all(sends);
      }
    } catch (e) {
      results.push({
        account_id: account.account_id,
        ok: false,
        error: e instanceof Error ? e.message : "Erro desconhecido",
      });
    }
  }

  return NextResponse.json({
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

// Vercel Cron sends GET — delegate to POST handler
export const GET = POST;
