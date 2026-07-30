const GRAPH_API_BASE = "https://graph.facebook.com/v23.0";

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function buildMetaOAuthUrl(
  appId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    config_id: process.env.META_CONFIG_ID ?? "2424628401346498",
    response_type: "code",
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

export async function exchangeCodeForLongLivedToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  // Short-lived token
  const shortParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const shortRes = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?${shortParams}`,
    { cache: "no-store" }
  );
  const shortData = await shortRes.json();
  if (!shortRes.ok || shortData.error) {
    throw new Error(shortData.error?.message ?? "Falha ao trocar código por token");
  }

  // Long-lived token (~60 days)
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortData.access_token,
  });
  const longRes = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?${longParams}`,
    { cache: "no-store" }
  );
  const longData = await longRes.json();
  if (!longRes.ok || longData.error) {
    throw new Error(longData.error?.message ?? "Falha ao obter token de longa duração");
  }

  const expiresAt = new Date(
    Date.now() + (longData.expires_in ?? 5_183_944) * 1000
  );
  return { accessToken: longData.access_token, expiresAt };
}

export async function fetchMetaUserInfo(
  token: string
): Promise<{ id: string; name: string }> {
  const res = await fetch(
    `${GRAPH_API_BASE}/me?fields=id,name&access_token=${token}`,
    { cache: "no-store" }
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? "Falha ao buscar dados do usuário Meta");
  }
  return { id: data.id, name: data.name };
}

// ─── Ad accounts ─────────────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string; // "act_XXXXX"
  name: string;
  account_status: number;
  currency: string;
}

export async function fetchUserAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const fields = "id,name,account_status,currency";
  const url = `${GRAPH_API_BASE}/me/adaccounts?fields=${fields}&limit=200&access_token=${token}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? "Falha ao buscar contas de anúncio");
  }
  return data.data ?? [];
}

// ─── Insights ────────────────────────────────────────────────────────────────

export interface RawInsightRow {
  date: string;
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  account_name: string | null;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  leads: number;
  mensagens_iniciadas: number;
  resultados: number;
  add_to_cart: number;
  purchases: number;
  initiate_checkout: number;
  instagram_profile_visits: number;
  comentarios: number;
  salvos: number;
  compartilhamentos: number;
  purchase_value: number;
  custo_por_lead: number;
  custo_por_mensagem: number;
  custo_por_resultado: number | null;
}

function mapActions(
  actions: { action_type: string; value: string }[] = [],
  actionValues: { action_type: string; value: string }[] = []
): Pick<
  RawInsightRow,
  | "leads"
  | "mensagens_iniciadas"
  | "resultados"
  | "add_to_cart"
  | "purchases"
  | "initiate_checkout"
  | "instagram_profile_visits"
  | "comentarios"
  | "salvos"
  | "compartilhamentos"
  | "purchase_value"
> {
  const m: Record<string, number> = {};
  for (const a of actions) m[a.action_type] = Number(a.value);

  const mv: Record<string, number> = {};
  for (const a of actionValues) mv[a.action_type] = Number(a.value);

  const leads =
    Math.round(m["lead"] ?? m["offsite_conversion.fb_pixel_lead"] ?? 0);
  const mensagens = Math.round(
    m["onsite_conversion.messaging_conversation_started_7d"] ?? 0
  );
  const purchases = Math.round(
    m["offsite_conversion.fb_pixel_purchase"] ?? 0
  );
  const resultados = leads > 0 ? leads : mensagens > 0 ? mensagens : purchases;

  return {
    leads,
    mensagens_iniciadas: mensagens,
    resultados,
    add_to_cart: Math.round(m["add_to_cart"] ?? 0),
    purchases,
    initiate_checkout: Math.round(
      m["offsite_conversion.fb_pixel_initiate_checkout"] ?? 0
    ),
    instagram_profile_visits: Math.round(
      m["onsite_conversion.post_engagement"] ?? m["page_engagement"] ?? 0
    ),
    comentarios: Math.round(m["comment"] ?? 0),
    salvos: Math.round(m["onsite_conversion.post_save"] ?? 0),
    compartilhamentos: Math.round(m["post"] ?? 0),
    purchase_value:
      mv["offsite_conversion.fb_pixel_purchase"] ?? 0,
  };
}

export async function fetchAdInsights(
  accountId: string, // with act_ prefix
  dateFrom: string,  // YYYY-MM-DD
  dateTo: string,
  token: string,
  accountName?: string
): Promise<RawInsightRow[]> {
  const fields = [
    "date_start",
    "ad_id",
    "ad_name",
    "campaign_name",
    "impressions",
    "reach",
    "clicks",
    "spend",
    "cpc",
    "cpm",
    "ctr",
    "actions",
    "action_values",
  ].join(",");

  const timeRange = encodeURIComponent(
    JSON.stringify({ since: dateFrom, until: dateTo })
  );

  const all: RawInsightRow[] = [];
  let url: string | null =
    `${GRAPH_API_BASE}/${accountId}/insights` +
    `?fields=${fields}` +
    `&level=ad` +
    `&time_range=${timeRange}` +
    `&time_increment=1` +
    `&limit=500` +
    `&access_token=${token}`;

  interface PagedResponse {
    data?: Array<Record<string, unknown>>;
    paging?: { next?: string };
    error?: { message: string };
  }

  while (url) {
    const pageUrl: string = url;
    const res: Response = await fetch(pageUrl, { cache: "no-store" });
    const data = (await res.json()) as PagedResponse;
    if (!res.ok || data.error) {
      throw new Error(
        data.error?.message ?? `Meta API error ${res.status} em ${accountId}`
      );
    }

    interface InsightRow {
      date_start: string;
      ad_id: string;
      ad_name?: string;
      campaign_name?: string;
      impressions?: string;
      reach?: string;
      clicks?: string;
      spend?: string;
      cpc?: string;
      cpm?: string;
      ctr?: string;
      actions?: { action_type: string; value: string }[];
      action_values?: { action_type: string; value: string }[];
    }

    for (const row of (data.data ?? []) as unknown as InsightRow[]) {
      const spend = Number(row.spend ?? 0);
      const actions = mapActions(row.actions, row.action_values);

      all.push({
        date: row.date_start,
        ad_id: row.ad_id,
        ad_name: row.ad_name ?? null,
        campaign_name: row.campaign_name ?? null,
        account_name: accountName ?? null,
        impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0),
        clicks: Number(row.clicks ?? 0),
        spend,
        cpc: Number(row.cpc ?? 0),
        cpm: Number(row.cpm ?? 0),
        ctr: Number(row.ctr ?? 0),
        ...actions,
        custo_por_lead:
          actions.leads > 0 ? spend / actions.leads : 0,
        custo_por_mensagem:
          actions.mensagens_iniciadas > 0
            ? spend / actions.mensagens_iniciadas
            : 0,
        custo_por_resultado:
          actions.resultados > 0 ? spend / actions.resultados : null,
      });
    }

    url = data.paging?.next ?? null;
  }

  return all;
}

// ─── Balance ─────────────────────────────────────────────────────────────────

interface MetaAccountResponse {
  balance?: string;
  currency?: string;
  amount_spent?: string;
  spend_cap?: string;
  is_prepay_account?: boolean;
  funding_source_details?: { display_string?: string; type?: number };
  error?: { message: string };
}

export interface MetaAccountBalance {
  balance: number | null;
  currency: string;
  isPrepaid: boolean;
}

function parseDisplayAmount(display: string | undefined): number | null {
  if (!display) return null;
  const match = display.match(/R\$\s*([\d.,]+)/);
  if (!match) return null;
  const raw = match[1];
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export async function getAccountBalance(
  accountId: string,
  overrideToken?: string
): Promise<MetaAccountBalance> {
  const token = overrideToken ?? process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado.");

  const fields =
    "balance,currency,amount_spent,spend_cap,is_prepay_account,funding_source_details";
  const url = `${GRAPH_API_BASE}/${accountId}?fields=${fields}&access_token=${token}`;
  const res: Response = await fetch(url, { cache: "no-store" });
  const data = (await (res as Response).json()) as MetaAccountResponse;

  if (!res.ok) {
    throw new Error(
      `Meta API ${res.status} para ${accountId}: ${data.error?.message ?? "erro desconhecido"}`
    );
  }

  const currency = data.currency ?? "BRL";
  if (!data.is_prepay_account) return { balance: null, currency, isPrepaid: false };

  // 1) display_string — valor exibido no Gerenciador de Anúncios (saldo disponível real)
  // O campo `balance` da API é o gasto ainda não faturado, NÃO o saldo disponível.
  const fromDisplay = parseDisplayAmount(
    data.funding_source_details?.display_string
  );
  if (fromDisplay !== null) return { balance: fromDisplay, currency, isPrepaid: true };

  // 2) Campo `balance` (centavos) — fallback quando display_string não disponível
  const rawBalance = Number(data.balance ?? 0);
  if (rawBalance > 0) {
    return { balance: rawBalance / 100, currency, isPrepaid: true };
  }

  // 3) spend_cap − amount_spent como último recurso
  const cap = Number(data.spend_cap ?? 0);
  const spent = Number(data.amount_spent ?? 0);
  const fallback = cap > 0 ? Math.max(cap - spent, 0) / 100 : null;
  return { balance: fallback, currency, isPrepaid: true };
}
