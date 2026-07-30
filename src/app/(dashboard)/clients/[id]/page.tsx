import { ArrowLeft, FileDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminUser, isGestorUser } from "@/lib/auth";
import LogoUploader from "@/components/LogoUploader";
import { getMascot } from "@/lib/mascots";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTenantSlug } from "@/lib/tenant";
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
import AlertBadge from "@/components/AlertBadge";
import BalanceBar from "@/components/BalanceBar";
import FundingEditor from "@/components/FundingEditor";
import CampaignsTable from "@/components/CampaignsTable";
import ClientTabs from "@/components/ClientTabs";
import CreativesGrid from "@/components/CreativesGrid";
import InsightsSection from "@/components/InsightsSection";
import KanbanBoard from "@/components/KanbanBoard";
import MetricsPanel from "@/components/MetricsPanel";
import PeriodSelector from "@/components/PeriodSelector";
import ShareLinkSection from "@/components/ShareLinkSection";
import SpendChart from "@/components/SpendChart";
import ThresholdEditor from "@/components/ThresholdEditor";
import ClientNotificationSettings from "@/components/ClientNotificationSettings";
import SocialOrganicSection from "@/components/SocialOrganicSection";
import SyncBalanceButton from "@/components/SyncBalanceButton";

type ClientRow = Client & {
  client_accounts: (ClientAccount & { account_balance: AccountBalance | null })[];
  group: (Group & { tenant: Tenant | null }) | null;
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
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; sort?: string; start?: string; end?: string }>;
}

export default async function ClientDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { period: rawPeriod, sort: rawSort, start: rawStart, end: rawEnd } =
    await searchParams;
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
  // Custom sem datas válidas cai no padrão (ontem)
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

  const supabase = await createClient();
  // Insights são por usuário (role admin), independentes do subdomínio
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminUser(user);
  const isGestor = isGestorUser(user);

  const [clientRes, tokenRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*, group:groups(*, tenant:tenants(*)), client_accounts(*, account_balance(*))")
      .eq("id", id)
      .single(),
    // client_tokens e domínio do tenant via service role — independem das
    // policies de leitura do usuário autenticado
    createAdminClient()
      .from("client_tokens")
      .select("*, client:clients(group:groups(tenant:tenants(domain)))")
      .eq("client_id", id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (clientRes.error || !clientRes.data) {
    notFound();
  }

  const client = clientRes.data as ClientRow;
  const tokenRow = (tokenRes.data ?? null) as
    | (ClientToken & {
        client: { group: { tenant: { domain: string } | null } | null } | null;
      })
    | null;
  const shareToken: ClientToken | null = tokenRow;

  // Link público no domínio do tenant do cliente; localhost em dev
  const tenantDomain = tokenRow?.client?.group?.tenant?.domain ?? null;
  const shareBase =
    process.env.NODE_ENV === "production" && tenantDomain
      ? `https://${tenantDomain}`
      : "http://localhost:3000";
  const shareUrl = shareToken ? `${shareBase}/r/${shareToken.token}` : null;
  const account = client.client_accounts[0] ?? null;
  const balance = account?.account_balance ?? null;

  let rows: MetricRow[] = [];
  let prevRows: MetricRow[] = [];
  let campaigns: CampaignMetrics[] = [];
  let creatives: CreativeMetrics[] = [];
  let leads: Lead[] = [];
  let totalSpend = 0;

  if (account) {
    const clienteId = stripActPrefix(account.account_id);
    const prevRange = previousPeriodRange(range);

    const [metricsRes, prevMetricsRes, campaignsRes, creativesRes, leadsRes, spendRes] =
      await Promise.all([
        supabase
          .from("meta_ads_raw_data")
          .select(
            "data, cliques, leads, mensagens_iniciadas, resultados, custo_total, add_to_cart, initiate_checkout, purchases, purchase_value"
          )
          .eq("cliente_id", clienteId)
          .gte("data", range.start)
          .lte("data", range.end)
          .order("data"),
        supabase
          .from("meta_ads_raw_data")
          .select(
            "data, cliques, leads, mensagens_iniciadas, resultados, custo_total, add_to_cart, initiate_checkout, purchases, purchase_value"
          )
          .eq("cliente_id", clienteId)
          .gte("data", prevRange.start)
          .lte("data", prevRange.end),
        supabase.rpc("campaign_metrics", {
          p_cliente_id: clienteId,
          p_start: range.start,
          p_end: range.end,
        }),
        supabase.rpc("creative_metrics", {
          p_cliente_id: clienteId,
          p_start: range.start,
          p_end: range.end,
        }),
        supabase
          .from("leads")
          .select(
            "id, lead_id_meta, cliente_id, nome, email, telefone, ad_id, ad_name, campaign_id, campaign_name, form_name, custom_fields, lead_status, created_time, updated_at"
          )
          .eq("cliente_id", clienteId)
          .order("created_time", { ascending: false })
          .limit(1000),
        supabase.rpc("client_total_spend", { p_cliente_id: clienteId }),
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

  // Alerta só para pré-pagas: pós-pagas (cartão) não têm saldo a esgotar
  const hasLowBalance =
    balance !== null &&
    account !== null &&
    balance.is_prepaid !== false &&
    balance.balance !== null &&
    balance.balance < account.alert_threshold;

  const leadsTab = (() => {
    const pr = previousPeriodRange(range);
    return leads.length > 0 ? (
      <KanbanBoard
        leads={leads}
        totalSpend={metrics.custoTotal}
        dateFrom={range.start}
        dateTo={range.end}
        prevFrom={pr.start}
        prevTo={pr.end}
      />
    ) : (
      <p className="rounded-xl bg-card border border-border p-5 text-sm text-muted">
        Nenhum lead sincronizado para este cliente.
      </p>
    );
  })();

  const resumo = (
    <div className="space-y-6">
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Saldo da conta</h3>
          <div className="flex items-center gap-4">
            {account && (isAdmin || isGestor) && (
              <SyncBalanceButton updatedAt={balance?.updated_at ?? null} />
            )}
            {account &&
              (balance?.is_prepaid === false || account.funding_amount !== null) && (
                <FundingEditor
                  accountId={account.id}
                  clientId={client.id}
                  currentAmount={
                    account.funding_amount !== null ? Number(account.funding_amount) : null
                  }
                  currentDate={account.funding_date}
                  currentTaxRate={Number(account.funding_tax_rate ?? 0)}
                />
              )}
            {account && (
              <ThresholdEditor
                accountId={account.id}
                currentThreshold={account.alert_threshold}
              />
            )}
            {(isAdmin || isGestor) && (
              <ClientNotificationSettings
                clientId={client.id}
                sheetsLeadsUrl={client.sheets_leads_url ?? null}
                whatsappNotify={client.whatsapp_notify ?? null}
                whatsappNotify2={client.whatsapp_notify_2 ?? null}
                whatsappGroupJid={client.whatsapp_group_jid ?? null}
                notifyLeadsNumber={client.notify_leads_number ?? true}
                notifyLeadsGroup={client.notify_leads_group ?? false}
                notifyBalanceNumber={client.notify_balance_number ?? true}
                notifyBalanceGroup={client.notify_balance_group ?? false}
              />
            )}
          </div>
        </div>
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
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-3"
        >
          <ArrowLeft size={15} />
          Voltar
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoUploader
              clientId={client.id}
              logoUrl={client.logo_url}
              clientName={client.name}
              size="lg"
              canEdit={isAdmin || isGestor}
            />
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <span className="rounded bg-accent/15 text-accent px-2 py-0.5 text-xs font-medium">
              Meta
            </span>
            {hasLowBalance && <AlertBadge />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelector
              current={period}
              basePath={`/clients/${client.id}`}
              maxDate={maxDate}
              customStart={period === "custom" ? range.start : undefined}
              customEnd={period === "custom" ? range.end : undefined}
            />
            <Link
              href={`/report/${client.id}?${
                period === "custom"
                  ? `period=custom&start=${range.start}&end=${range.end}`
                  : `period=${period}`
              }`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card text-muted hover:text-white text-sm px-3 py-2 transition-colors"
              title="Relatório para impressão/PDF"
            >
              <FileDown size={15} />
              Baixar PDF
            </Link>
          </div>
        </div>
        {account?.account_name && (
          <p className="text-sm text-muted mt-1">
            {account.account_name} · {account.account_id}
          </p>
        )}
      </div>

      <MetricsPanel metrics={metrics} previous={previousMetrics} />

      {(isAdmin || isGestor) && (
        <InsightsSection
          clientId={client.id}
          period={period}
          start={period === "custom" ? range.start : undefined}
          end={period === "custom" ? range.end : undefined}
          mascot={getMascot(await getTenantSlug())}
        />
      )}

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
            basePath={`/clients/${client.id}`}
          />
        }
        leads={leadsTab}
        organico={
          <SocialOrganicSection
            clientId={client.id}
            dateFrom={range.start}
            dateTo={range.end}
            prevFrom={previousPeriodRange(range).start}
            prevTo={previousPeriodRange(range).end}
          />
        }
      />

      <ShareLinkSection clientId={client.id} token={shareToken} shareUrl={shareUrl} />
    </div>
  );
}
