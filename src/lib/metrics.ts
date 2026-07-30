import type { MetricKey, MetricSums } from "@/types";
import { formatCurrency, formatNumber } from "./utils";

export const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "clicks", label: "Cliques" },
  { key: "leads", label: "Leads" },
  { key: "messages", label: "Mensagens iniciadas" },
  { key: "results", label: "Resultados" },
  { key: "cost", label: "Gasto Total" },
  { key: "cpl", label: "Custo por Lead" },
  { key: "cpm", label: "CPM" },
  { key: "cpc", label: "CPC" },
  { key: "reach", label: "Alcance" },
  { key: "impressions", label: "Impressões" },
  { key: "cost_per_message", label: "Custo por Mensagem" },
  { key: "conversions", label: "Conversões" },
  { key: "profile_visits", label: "Visitas ao Perfil" },
];

export const DEFAULT_METRIC_KEYS: MetricKey[] = ["clicks", "leads", "messages", "cost"];
export const MAX_SELECTED_METRICS = 4;

const LABEL_BY_KEY = new Map(METRIC_OPTIONS.map((o) => [o.key, o.label]));

export function metricLabel(key: MetricKey): string {
  return LABEL_BY_KEY.get(key) ?? key;
}

export function isMetricKey(value: unknown): value is MetricKey {
  return typeof value === "string" && LABEL_BY_KEY.has(value as MetricKey);
}

export const EMPTY_METRIC_SUMS: MetricSums = {
  cliques: 0,
  leads: 0,
  mensagens: 0,
  resultados: 0,
  impressoes: 0,
  alcance: 0,
  visitasPerfil: 0,
  custoTotal: 0,
  custoPorLead: null,
  custoPorMensagem: null,
};

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** Valor da métrica a partir das somas do período. null = denominador zero. */
export function metricValue(key: MetricKey, sums: MetricSums): number | null {
  switch (key) {
    case "clicks":
      return sums.cliques;
    case "leads":
      return sums.leads;
    case "messages":
      return sums.mensagens;
    case "results":
    case "conversions":
      return sums.resultados;
    case "cost":
      return sums.custoTotal;
    case "cpl":
      return sums.custoPorLead ?? ratio(sums.custoTotal, sums.leads);
    case "cpc":
      return ratio(sums.custoTotal, sums.cliques);
    case "cpm": {
      const perImpression = ratio(sums.custoTotal, sums.impressoes);
      return perImpression === null ? null : perImpression * 1000;
    }
    case "reach":
      return sums.alcance;
    case "impressions":
      return sums.impressoes;
    case "cost_per_message":
      return sums.custoPorMensagem ?? ratio(sums.custoTotal, sums.mensagens);
    case "profile_visits":
      return sums.visitasPerfil;
  }
}

const CURRENCY_KEYS: ReadonlySet<MetricKey> = new Set([
  "cost",
  "cpl",
  "cpm",
  "cpc",
  "cost_per_message",
]);

export function formatMetric(key: MetricKey, sums: MetricSums): string {
  const value = metricValue(key, sums);
  if (value === null) return "—";
  return CURRENCY_KEYS.has(key) ? formatCurrency(value) : formatNumber(value);
}

/**
 * Métrica de custo dinâmica do card: CPL quando há leads, Custo/Conversa
 * quando há mensagens, Custo/Resultado quando há resultados, senão Gasto Total.
 */
export function dynamicCostMetric(sums: MetricSums): { label: string; value: string } {
  if (sums.leads > 0) {
    return {
      label: "CPL",
      value: formatCurrency(sums.custoPorLead ?? sums.custoTotal / sums.leads),
    };
  }
  if (sums.mensagens > 0) {
    return {
      label: "Custo/Conversa",
      value: formatCurrency(sums.custoPorMensagem ?? sums.custoTotal / sums.mensagens),
    };
  }
  if (sums.resultados > 0) {
    return {
      label: "Custo/Resultado",
      value: formatCurrency(sums.custoTotal / sums.resultados),
    };
  }
  return { label: "Gasto Total", value: formatCurrency(sums.custoTotal) };
}
