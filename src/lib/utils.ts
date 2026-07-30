import type {
  AggregatedMetrics,
  DateRange,
  Lead,
  LeadsMetricsData,
  MetaAdsRawData,
  Period,
} from "@/types";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** Remove o prefixo act_ — meta_ads_raw_data.cliente_id não usa o prefixo. */
export function stripActPrefix(accountId: string): string {
  return accountId.replace(/^act_/, "");
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Brasília é UTC-3. O servidor Vercel roda em UTC, então ajustamos manualmente.
const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;

function brasiliaToday(): Date {
  return new Date(Date.now() + BRASILIA_OFFSET_MS);
}

/** Data de ontem no fuso de Brasília (UTC-3). */
export function yesterdayISODate(): string {
  const d = brasiliaToday();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Intervalo [start, end] (inclusivo) dos períodos pré-definidos, terminando ontem. */
export function periodDateRange(period: Exclude<Period, "custom">): DateRange {
  const end = yesterdayISODate();
  switch (period) {
    case "yesterday":
      return { start: end, end };
    case "7d": {
      const d = new Date(end + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 6);
      return { start: toISODate(d), end };
    }
    case "month": {
      // Dia 1 do mês atual em Brasília até ontem
      const today = brasiliaToday();
      return { start: `${today.toISOString().slice(0, 7)}-01`, end };
    }
    case "prev_month": {
      // Mês anterior completo em Brasília
      const today = brasiliaToday();
      const year = today.getUTCFullYear();
      const month = today.getUTCMonth();
      const firstDay = new Date(Date.UTC(year, month - 1, 1));
      const lastDay = new Date(Date.UTC(year, month, 0));
      return { start: toISODate(firstDay), end: toISODate(lastDay) };
    }
  }
}

/** Período imediatamente anterior com a mesma duração (para comparativos). */
export function previousPeriodRange(range: DateRange): DateRange {
  const dayMs = 86_400_000;
  const startMs = new Date(`${range.start}T00:00:00Z`).getTime();
  const endMs = new Date(`${range.end}T00:00:00Z`).getTime();
  const days = Math.round((endMs - startMs) / dayMs) + 1;
  return {
    start: toISODate(new Date(startMs - days * dayMs)),
    end: toISODate(new Date(startMs - dayMs)),
  };
}

type MetricRow = Pick<
  MetaAdsRawData,
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

export function aggregateMetrics(rows: MetricRow[]): AggregatedMetrics {
  const sum = rows.reduce(
    (acc, r) => {
      acc.cliques += r.cliques ?? 0;
      acc.leads += r.leads ?? 0;
      acc.mensagens += r.mensagens_iniciadas ?? 0;
      acc.resultados += r.resultados ?? 0;
      acc.custoTotal += Number(r.custo_total ?? 0);
      acc.carrinho += r.add_to_cart ?? 0;
      acc.checkouts += r.initiate_checkout ?? 0;
      acc.compras += r.purchases ?? 0;
      acc.receita += Number(r.purchase_value ?? 0);
      return acc;
    },
    {
      cliques: 0,
      leads: 0,
      mensagens: 0,
      resultados: 0,
      custoTotal: 0,
      carrinho: 0,
      checkouts: 0,
      compras: 0,
      receita: 0,
    }
  );

  return {
    ...sum,
    conversoes: sum.resultados,
    cpc: sum.cliques > 0 ? sum.custoTotal / sum.cliques : 0,
    cpl: sum.leads > 0 ? sum.custoTotal / sum.leads : 0,
    custoPorMensagem: sum.mensagens > 0 ? sum.custoTotal / sum.mensagens : 0,
    custoPorResultado: sum.resultados > 0 ? sum.custoTotal / sum.resultados : 0,
    roas: sum.custoTotal > 0 ? sum.receita / sum.custoTotal : 0,
    custoPorCompra: sum.compras > 0 ? sum.custoTotal / sum.compras : 0,
  };
}

/** Métricas da linha de cards do Kanban de leads. */
export function computeLeadsMetrics(leads: Lead[], totalSpend: number): LeadsMetricsData {
  const converted = leads.filter((l) => l.lead_status === "CONVERTED");
  const conversionDays = converted
    .filter((l) => l.created_time && l.updated_at)
    .map(
      (l) =>
        (new Date(l.updated_at as string).getTime() -
          new Date(l.created_time as string).getTime()) /
        86_400_000
    )
    .filter((days) => days >= 0);

  return {
    total: leads.length,
    convertidos: converted.length,
    taxaConversao: leads.length > 0 ? (converted.length / leads.length) * 100 : 0,
    cplReal: leads.length > 0 ? totalSpend / leads.length : null,
    cpa: converted.length > 0 ? totalSpend / converted.length : null,
    tempoMedioConversaoDias:
      conversionDays.length > 0
        ? conversionDays.reduce((a, b) => a + b, 0) / conversionDays.length
        : null,
  };
}
