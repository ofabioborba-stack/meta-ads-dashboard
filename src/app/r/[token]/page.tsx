import type { CSSProperties } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregateMetrics,
  periodDateRange,
  previousPeriodRange,
  stripActPrefix,
  yesterdayISODate,
} from "@/lib/utils";
import type {
  AccountBalance,
  CampaignMetrics,
  Client,
  ClientAccount,
  ClientToken,
  CreativeMetrics,
  CreativeSort,
  DailySpend,
  Group,
  Lead,
  MetaAdsRawData,
  Period,
  Tenant,
} from "@/types";
import BalanceBar from "@/components/BalanceBar";
import CampaignsTable from "@/components/CampaignsTable";
import ClientTabs from "@/components/ClientTabs";
import CreativesGrid from "@/components/CreativesGrid";
import KanbanBoard from "@/components/KanbanBoard";
import MetricsPanel from "@/components/MetricsPanel";
import PeriodSelector from "@/components/PeriodSelector";
import SpendChart from "@/components/SpendChart";

type TokenRow = ClientToken & {
  client:
    | (Client & {
        client_accounts: (ClientAccount & { account_balance: AccountBalance | null })[];
        group: (Group & { tenant: Tenant | null }) | null;
      })
    | null;
};

type MetricRow = Pick<
  MetaAdsRawData,
  | "data"
  | "cliques"
  | "leads"
  | "mensagens_iniciadas"
  | "resultados"
  | "custo_total"
  | "add_to_cart"
  | "initiate_checkout"
  | "purchases"
  | "purchase_value"
>;

type CampaignRpcRow = Omit<CampaignMetrics, "custo" | "cpl"> & {
  custo: number | string;
  cpl: number | string | null;
};

type CreativeRpcRow = Omit<CreativeMetrics, "gasto" | "cpl" | "custo_mensagem"> & {
  gasto: number | string;
  cpl: number | string | null;
  custo_mensagem: number | string | null;
};

const VALID_PERIODS: Period[] = ["yesterday", "7d", "month", "prev_month", "custom"];
const VALID_SORTS: CreativeSort[] = ["gasto", "cliques", "leads", "cpl"];
const MIN_CUSTOM_DATE = "2026-01-01";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ period?: string; sort?: string; start?: string; end?: string }>;
}

function InvalidLink() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="rounded-xl bg-card border border-border p-8 max-w-sm text-center">
        <p className="text-3xl mb-3">🔗</p>
        <h1 className="text-lg font-semibold mb-2">Link inválido ou expirado</h1>
        <p className="text-sm text-muted">
          Este relatório não está mais disponível. Solicite um novo link ao seu
          gestor de tráfego.
        </p>
      </div>
    </div>
  );
}

export default async function PublicClientPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { period: rawPeriod, sort: rawSort, start: rawStart, end: rawEnd } =
    await searchParams;

  const admin = createAdminClient();

  // Página pública: a validação de acesso é o próprio token (ativo e dentro
  // da validade). Toda consulta abaixo fica restrita ao cliente do token.
  const tokenRes = await admin
    .from("client_tokens")
    .select(
      "*, client:clients(*, client_accounts(*, account_balance(*)), group:groups(*, tenant:tenants(*)))"
    )
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  const tokenRow = (tokenRes.data ?? null) as TokenRow | null;
  const expired =
    tokenRow?.expires_at != null && new Date(tokenRow.expires_at) < new Date();

  if (tokenRes.error || !tokenRow || !tokenRow.client || expired) {
    return <InvalidLink />;
  }

  const client = tokenRow.client;
  const tenant = client.group?.tenant ?? null;
  const account = client.client_accounts[0] ?? null;
  const balance = account?.account_balance ?? null;

  // Registro de acesso (best-effort: não bloqueia a renderização se falhar)
  await admin
    .from("client_tokens")
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: tokenRow.access_count + 1,
    })
    .eq("id", tokenRow.id);

  const sort: CreativeSort = VALID_SORTS.includes(rawSort as CreativeSort)
    ? (rawSort as CreativeSort)
    : "gasto";

  const maxDate = yesterdayISODate();
  const isValidCustomDate = (value?: string): value is string =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= MIN_CUSTOM_DATE &&
    value <= maxDate;

  let period: Period = VALID_PERIODS.includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : "yesterday";
  if (
    period === "custom" &&
    !(isValidCustomDate(rawStart) && isValidCustomDate(rawEnd) && rawStart <= rawEnd)
  ) {
    period = "yesterday";
  }

  const range =
    period === "custom"
      ? { start: rawStart as string, end: rawEnd as string }
      : periodDateRange(period);
  const prevRange = previousPeriodRange(range);

  let rows: MetricRow[] = [];
  let prevRows: MetricRow[] = [];
  let campaigns: CampaignMetrics[] = [];
  let creatives: CreativeMetrics[] = [];
  let leads: Lead[] = [];
  let totalSpend = 0;

  if (account) {
    const clienteId = stripActPrefix(account.account_id);

    const [metricsRes, prevMetricsRes, campaignsRes, creativesRes, leadsRes, spendRes] =
      await Promise.all([
        admin
          .from("meta_ads_raw_data")
          .select(
            "data, cliques, leads, mensagens_iniciadas, resultados, custo_total, add_to_cart, initiate_checkout, purchases, purchase_value"
          )
          .eq("cliente_id", clienteId)
          .gte("data", range.start)
          .lte("data", range.end)
          .order("data"),
        admin
          .from("meta_ads_raw_data")
          .select(
            "data, cliques, leads, mensagens_iniciadas, resultados, custo_total, add_to_cart, initiate_checkout, purchases, purchase_value"
          )
          .eq("cliente_id", clienteId)
          .gte("data", prevRange.start)
          .lte("data", prevRange.end),
        admin.rpc("campaign_metrics", {
          p_cliente_id: clienteId,
          p_start: range.start,
          p_end: range.end,
        }),
        admin.rpc("creative_metrics", {
          p_cliente_id: clienteId,
          p_start: range.start,
          p_end: range.end,
        }),
        admin
          .from("leads")
          .select(
            "id, lead_id_meta, cliente_id, nome, email, telefone, ad_id, ad_name, campaign_id, campaign_name, form_name, custom_fields, lead_status, created_time, updated_at"
          )
          .eq("cliente_id", clienteId)
          .order("created_time", { ascending: false })
          .limit(1000),
        admin.rpc("client_total_spend", { p_cliente_id: clienteId }),
      ]);

    if (metricsRes.error) {
      throw new Error(`Erro ao buscar métricas: ${metricsRes.error.message}`);
    }
    if (prevMetricsRes.error) {
      throw new Error(
        `Erro ao buscar métricas do período anterior: ${prevMetricsRes.error.message}`
      );
    }
    if (campaignsRes.error) {
      throw new Error(`Erro ao buscar campanhas: ${campaignsRes.error.message}`);
    }
    if (creativesRes.error) {
      throw new Error(`Erro ao buscar criativos: ${creativesRes.error.message}`);
    }
    if (leadsRes.error) {
      throw new Error(`Erro ao buscar leads: ${leadsRes.error.message}`);
    }
    if (spendRes.error) {
      throw new Error(`Erro ao buscar gasto total: ${spendRes.error.message}`);
    }

    rows = (metricsRes.data ?? []) as MetricRow[];
    prevRows = (prevMetricsRes.data ?? []) as MetricRow[];
    leads = (leadsRes.data ?? []) as Lead[];
    totalSpend = Number(spendRes.data ?? 0);
    campaigns = ((campaignsRes.data ?? []) as CampaignRpcRow[]).map((r) => ({
      ...r,
      custo: Number(r.custo ?? 0),
      cpl: r.cpl === null ? null : Number(r.cpl),
    }));
    creatives = ((creativesRes.data ?? []) as CreativeRpcRow[]).map((r) => ({
      ...r,
      gasto: Number(r.gasto ?? 0),
      cpl: r.cpl === null ? null : Number(r.cpl),
      custo_mensagem: r.custo_mensagem === null ? null : Number(r.custo_mensagem),
    }));
  }

  const metrics = aggregateMetrics(rows);
  const previousMetrics = prevRows.length > 0 ? aggregateMetrics(prevRows) : null;

  const dailyMap = new Map<string, DailySpend>();
  for (const row of rows) {
    const day = dailyMap.get(row.data) ?? { date: row.data, custo: 0, conversoes: 0 };
    day.custo += Number(row.custo_total ?? 0);
    day.conversoes += row.resultados ?? 0;
    dailyMap.set(row.data, day);
  }
  const dailySpend = [...dailyMap.values()].map((d) => ({
    ...d,
    custo: Number(d.custo.toFixed(2)),
  }));

  // Tema do tenant do cliente (pode divergir do host em dev)
  const tenantVars = tenant
    ? ({
        "--color-primary": tenant.primary_color,
        "--color-secondary": tenant.secondary_color,
        "--color-accent": tenant.primary_color,
        "--color-bg": tenant.background_color,
        "--color-background": tenant.background_color,
        "--color-card": tenant.card_color,
        "--color-card-hover": `color-mix(in srgb, ${tenant.card_color}, white 5%)`,
        "--color-border": `color-mix(in srgb, ${tenant.card_color}, white 12%)`,
      } as CSSProperties)
    : undefined;

  const resumo = (
    <div className="space-y-6">
      <div className="rounded-xl bg-card border border-border p-5">
        <h3 className="font-semibold mb-3">Saldo da conta</h3>
        <BalanceBar
          balance={balance?.balance ?? null}
          threshold={account?.alert_threshold ?? 200}
          prepaid={balance?.is_prepaid ?? true}
          expanded
        />
      </div>

      <SpendChart data={dailySpend} />
    </div>
  );

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ ...tenantVars, background: "var(--color-background)" }}
    >
      <header className="border-b border-border bg-card/50">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          {tenant?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-8 w-auto"
              style={{ maxHeight: 32 }}
            />
          ) : (
            <span className="font-semibold">{tenant?.name ?? "Relatório"}</span>
          )}

          <div className="flex items-center gap-2.5">
            {client.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logo_url}
                alt={client.name}
                className="w-8 h-8 rounded-lg object-cover"
              />
            )}
            <span className="font-semibold">{client.name}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1200px] mx-auto w-full px-6 py-8 space-y-6">
        {tenant && (
          <p className="text-xs text-muted">
            Relatório gerado por <span className="font-medium">{tenant.name}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <PeriodSelector
            current={period}
            basePath={`/r/${token}`}
            maxDate={maxDate}
            customStart={period === "custom" ? range.start : undefined}
            customEnd={period === "custom" ? range.end : undefined}
          />
        </div>

        <MetricsPanel metrics={metrics} previous={previousMetrics} />

        <ClientTabs
          resumo={resumo}
          campanhas={<CampaignsTable rows={campaigns} />}
          criativos={
            <CreativesGrid
              rows={creatives}
              sort={sort}
              periodQuery={
                period === "custom"
                  ? `period=custom&start=${range.start}&end=${range.end}`
                  : `period=${period}`
              }
              basePath={`/r/${token}`}
            />
          }
          leads={
            leads.length > 0 ? (
              <KanbanBoard
                leads={leads}
                totalSpend={metrics.custoTotal}
                dateFrom={range.start}
                dateTo={range.end}
                prevFrom={prevRange.start}
                prevTo={prevRange.end}
                publicToken={token}
              />
            ) : (
              <p className="rounded-xl bg-card border border-border p-5 text-sm text-muted">
                Nenhum lead sincronizado.
              </p>
            )
          }
        />
      </main>

      {tenant && (
        <footer className="py-6 text-center">
          <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
            Powered by {tenant.name}
          </p>
        </footer>
      )}
    </div>
  );
}
