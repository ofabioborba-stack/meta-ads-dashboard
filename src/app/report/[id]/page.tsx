import type { CSSProperties } from "react";
import { ArrowLeft, FileDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminUser, isGestorUser } from "@/lib/auth";
import { describePeriod, generateInsights } from "@/lib/insights";
import { getMascot } from "@/lib/mascots";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  aggregateMetrics,
  computeLeadsMetrics,
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
  CreativeMetrics,
  DailySpend,
  Group,
  Lead,
  MetaAdsRawData,
  Period,
  Tenant,
} from "@/types";
import BalanceBar from "@/components/BalanceBar";
import CampaignsTable from "@/components/CampaignsTable";
import InsightsContent from "@/components/InsightsContent";
import LeadsMetrics from "@/components/LeadsMetrics";
import MetricsPanel from "@/components/MetricsPanel";
import PrintButton from "@/components/PrintButton";
import ReportCreativesGrid from "@/components/ReportCreativesGrid";
import SocialOrganicSection from "@/components/SocialOrganicSection";
import SpendChart from "@/components/SpendChart";

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
const MIN_CUSTOM_DATE = "2026-01-01";

// Com ?insights=1 a página espera a geração por IA (até ~1 min)
export const maxDuration = 60;

function formatBr(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CREATED: { label: "Novo", color: "#4F6EF7" },
  CONTACTED: { label: "Contactado", color: "#F59E0B" },
  QUALIFIED: { label: "Qualificado", color: "#A855F7" },
  CONVERTED: { label: "Convertido", color: "#10B981" },
  LOST: { label: "Perdido", color: "#EF4444" },
};

function LeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-2.5 font-medium">Nome</th>
            <th className="px-4 py-2.5 font-medium">Telefone</th>
            <th className="px-4 py-2.5 font-medium">Campanha</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium text-right">Data</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const status = LEAD_STATUS_LABELS[lead.lead_status ?? ""] ?? {
              label: lead.lead_status ?? "—",
              color: "#8b90a0",
            };
            return (
              <tr key={lead.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{lead.nome ?? "(sem nome)"}</td>
                <td className="px-4 py-2 text-muted">{lead.telefone ?? "—"}</td>
                <td
                  className="px-4 py-2 text-muted max-w-[260px] truncate"
                  title={lead.campaign_name ?? undefined}
                >
                  {lead.campaign_name ?? "—"}
                </td>
                <td className="px-4 py-2">
                  <span style={{ color: status.color }}>{status.label}</span>
                </td>
                <td className="px-4 py-2 text-muted text-right whitespace-nowrap">
                  {lead.created_time
                    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                        new Date(lead.created_time)
                      )
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function periodLabel(period: Period, start: string, end: string): string {
  switch (period) {
    case "yesterday":
      return `Ontem (${formatBr(start)})`;
    case "7d":
      return `Últimos 7 dias (${formatBr(start)} a ${formatBr(end)})`;
    case "month":
      return `Mês atual (${formatBr(start)} a ${formatBr(end)})`;
    case "prev_month":
      return `Mês anterior (${formatBr(start)} a ${formatBr(end)})`;
    case "custom":
      return `${formatBr(start)} a ${formatBr(end)}`;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    period?: string;
    sort?: string;
    start?: string;
    end?: string;
    insights?: string;
  }>;
}

/**
 * Relatório para impressão/PDF: rota autenticada com todas as seções em
 * sequência (sem abas) e sem métricas internas (CPL real), pronta para
 * compartilhar com o cliente mantendo o visual do dashboard.
 */
export default async function ClientReportPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const {
    period: rawPeriod,
    start: rawStart,
    end: rawEnd,
    insights: rawInsights,
  } = await searchParams;
  // Insights por usuário (role admin), independente do subdomínio
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminUser(user);
  const isGestor = isGestorUser(user);
  const wantInsights = rawInsights === "1" && (isAdmin || isGestor);

  const maxDate = yesterdayISODate();
  const isValidCustomDate = (value?: string): value is string =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= MIN_CUSTOM_DATE &&
    value <= maxDate;

  let period: Period = VALID_PERIODS.includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : "7d";
  if (
    period === "custom" &&
    !(isValidCustomDate(rawStart) && isValidCustomDate(rawEnd) && rawStart <= rawEnd)
  ) {
    period = "7d";
  }

  const range =
    period === "custom"
      ? { start: rawStart as string, end: rawEnd as string }
      : periodDateRange(period);

  const admin = createAdminClient();

  const clientRes = await admin
    .from("clients")
    .select("*, group:groups(*, tenant:tenants(*)), client_accounts(*, account_balance(*))")
    .eq("id", id)
    .single();

  if (clientRes.error || !clientRes.data) {
    notFound();
  }

  const client = clientRes.data as ClientRow;
  const tenant = client.group?.tenant ?? null;
  // Mascote do tenant (ex.: Kiko na KiwiLab) assina a seção de insights
  const mascot = tenant ? getMascot(tenant.slug) : null;
  const account = client.client_accounts[0] ?? null;
  const balance = account?.account_balance ?? null;

  let rows: MetricRow[] = [];
  let prevRows: MetricRow[] = [];
  let campaigns: CampaignMetrics[] = [];
  let creatives: CreativeMetrics[] = [];
  let leads: Lead[] = [];
  let prevLeads: Lead[] = [];
  let totalSpend = 0;

  if (account) {
    const clienteId = stripActPrefix(account.account_id);
    const prevRange = previousPeriodRange(range);

    const [
      metricsRes,
      prevMetricsRes,
      campaignsRes,
      creativesRes,
      leadsRes,
      prevLeadsRes,
      spendRes,
    ] =
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
          .select("id, nome, telefone, campaign_name, lead_status, created_time, updated_at")
          .eq("cliente_id", clienteId)
          .gte("created_time", `${range.start}T00:00:00`)
          .lte("created_time", `${range.end}T23:59:59`)
          .order("created_time", { ascending: false })
          .limit(1000),
        admin
          .from("leads")
          .select("id, lead_status, created_time, updated_at")
          .eq("cliente_id", clienteId)
          .gte("created_time", `${prevRange.start}T00:00:00`)
          .lte("created_time", `${prevRange.end}T23:59:59`)
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
    if (prevLeadsRes.error) {
      throw new Error(
        `Erro ao buscar leads do período anterior: ${prevLeadsRes.error.message}`
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
    prevLeads = (prevLeadsRes.data ?? []) as Lead[];
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
  const leadsMetrics = computeLeadsMetrics(leads as Lead[], totalSpend);
  const previousLeadsMetrics =
    prevLeads.length > 0 ? computeLeadsMetrics(prevLeads, 0) : null;

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

  // Geração no servidor para a análise sair no PDF; erro vira aviso na página
  let insightsText: string | null = null;
  let insightsError: string | null = null;
  if (wantInsights) {
    try {
      insightsText = await generateInsights(
        client.id,
        range,
        describePeriod(period, range)
      );
    } catch (e) {
      insightsError = e instanceof Error ? e.message : "Erro ao gerar insights";
    }
  }

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

  const periodQuery =
    period === "custom"
      ? `period=custom&start=${range.start}&end=${range.end}`
      : `period=${period}`;

  return (
    <div
      className="flex-1 flex flex-col print-report"
      style={{ ...tenantVars, background: "var(--color-background)" }}
    >
      {/* Barra de ações — não sai na impressão */}
      <div className="no-print border-b border-border bg-card/50">
        <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            href={`/clients/${client.id}?${periodQuery}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors"
          >
            <ArrowLeft size={15} />
            Voltar ao painel
          </Link>
          <div className="flex items-center gap-2">
            {(isAdmin || isGestor) && !wantInsights && (
              <Link
                href={`/report/${client.id}?${periodQuery}&insights=1`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/50 text-accent text-sm px-3 py-2 hover:bg-accent/10 transition-colors"
                title="Recarrega o relatório incluindo a análise por IA (até 1 min)"
              >
                <Sparkles size={15} />
                Incluir insights IA
              </Link>
            )}
            <PrintButton />
            <a
              href={`/api/pdf/${client.id}?${periodQuery}${wantInsights ? "&insights=1" : ""}`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent text-white text-sm font-medium px-4 py-2 hover:bg-accent/80 transition-colors"
              title="Baixa o arquivo PDF em A4 (com insights pode levar até 1 min)"
            >
              <FileDown size={15} />
              Baixar PDF
            </a>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 py-8 space-y-6">
        {/* Cabeçalho do relatório: logo da agência + logo/nome do cliente */}
        <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
          {tenant?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-9 w-auto"
              style={{ maxHeight: 36 }}
            />
          ) : (
            <span className="font-semibold text-lg">{tenant?.name ?? ""}</span>
          )}

          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="font-bold text-lg leading-tight">{client.name}</p>
              <p className="text-xs text-muted">
                Relatório de tráfego · {periodLabel(period, range.start, range.end)}
              </p>
            </div>
            {client.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logo_url}
                alt={client.name}
                className="w-11 h-11 rounded-lg object-cover"
              />
            )}
          </div>
        </header>

        <MetricsPanel metrics={metrics} previous={previousMetrics} />

        {insightsText && (
          <section className="rounded-xl bg-card border border-border p-5">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              {mascot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mascot.imageUrl}
                  alt={mascot.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <Sparkles size={18} className="text-accent" />
              )}
              {mascot ? `Análise e Insights do ${mascot.name}` : "Análise e Insights"}
            </h2>
            <InsightsContent text={insightsText} />
          </section>
        )}
        {insightsError && (
          <p className="no-print rounded-lg bg-danger/10 border border-danger/40 text-danger text-sm px-3 py-2">
            Insights indisponíveis: {insightsError}
          </p>
        )}

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

        <section>
          <h2 className="text-lg font-semibold mb-3">Campanhas</h2>
          <CampaignsTable rows={campaigns} />
        </section>

        {leads.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">
              Leads do período ({leads.length})
            </h2>
            <LeadsMetrics
              metrics={leadsMetrics}
              hideCpl
              previous={previousLeadsMetrics}
            />
            <LeadsTable leads={leads} />
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3">Criativos</h2>
          <ReportCreativesGrid rows={creatives} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Orgânico</h2>
          <SocialOrganicSection
            clientId={id}
            dateFrom={range.start}
            dateTo={range.end}
            prevFrom={previousPeriodRange(range).start}
            prevTo={previousPeriodRange(range).end}
          />
        </section>

        {tenant && (
          <footer className="pt-4 border-t border-border text-center">
            <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
              Relatório gerado por {tenant.name}
              {tenant.domain ? ` · ${tenant.domain}` : ""}
            </p>
          </footer>
        )}
      </main>
    </div>
  );
}
