import { Users, CheckCircle2, Percent, Coins, Clock } from "lucide-react";
import type { LeadsMetricsData } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import DeltaBadge from "./DeltaBadge";

interface LeadsMetricsProps {
  metrics: LeadsMetricsData;
  /** Esconde o CPL real (valor interno) na view pública do cliente. */
  hideCpl?: boolean;
  /** Métricas do período anterior correspondente — habilita os comparativos. */
  previous?: LeadsMetricsData | null;
}

interface LeadsMetricItem {
  label: string;
  value: string;
  icon: typeof Users;
  delta?: { current: number; previous: number | null; downIsGood?: boolean };
}

export default function LeadsMetrics({
  metrics,
  hideCpl = false,
  previous,
}: LeadsMetricsProps) {
  const items: LeadsMetricItem[] = [
    {
      label: "Total de leads",
      value: formatNumber(metrics.total),
      icon: Users,
      delta: { current: metrics.total, previous: previous?.total ?? null },
    },
    {
      label: "Convertidos",
      value: formatNumber(metrics.convertidos),
      icon: CheckCircle2,
      delta: { current: metrics.convertidos, previous: previous?.convertidos ?? null },
    },
    {
      label: "Taxa de conversão",
      value: metrics.total > 0 ? `${metrics.taxaConversao.toFixed(1)}%` : "—",
      icon: Percent,
      delta: {
        current: metrics.taxaConversao,
        previous:
          previous && previous.total > 0 && previous.taxaConversao > 0
            ? previous.taxaConversao
            : null,
      },
    },
    ...(hideCpl
      ? []
      : [
          {
            label: "CPL real",
            value: metrics.cplReal !== null ? formatCurrency(metrics.cplReal) : "—",
            icon: Coins,
          } satisfies LeadsMetricItem,
          {
            label: "CPA",
            value: metrics.cpa !== null ? formatCurrency(metrics.cpa) : "—",
            icon: Coins,
          } satisfies LeadsMetricItem,
        ]),
    {
      label: "Tempo médio até conversão",
      value:
        metrics.tempoMedioConversaoDias !== null
          ? `${metrics.tempoMedioConversaoDias.toFixed(1)} dias`
          : "—",
      icon: Clock,
      delta: {
        current: metrics.tempoMedioConversaoDias ?? 0,
        previous:
          metrics.tempoMedioConversaoDias !== null &&
          previous?.tempoMedioConversaoDias != null
            ? previous.tempoMedioConversaoDias
            : null,
        downIsGood: true,
      },
    },
  ];

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 gap-4 ${
        hideCpl ? "lg:grid-cols-4" : "lg:grid-cols-6"
      }`}
    >
      {items.map(({ label, value, icon: Icon, delta }) => (
        <div key={label} className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted text-sm mb-2">
            <Icon size={15} />
            <span className="truncate">{label}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-semibold">{value}</p>
            {previous !== undefined && delta && (
              <DeltaBadge
                current={delta.current}
                previous={delta.previous}
                downIsGood={delta.downIsGood}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
