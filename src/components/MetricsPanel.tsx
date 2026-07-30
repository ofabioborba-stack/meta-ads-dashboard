import {
  MousePointerClick,
  Target,
  Users,
  MessageCircle,
  Coins,
  Wallet,
  ShoppingCart,
  CreditCard,
  ShoppingBag,
  Banknote,
  TrendingUp,
} from "lucide-react";
import type { AggregatedMetrics } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import DeltaBadge from "./DeltaBadge";

interface MetricsPanelProps {
  metrics: AggregatedMetrics;
  /** Métricas do período anterior correspondente — habilita os comparativos. */
  previous?: AggregatedMetrics | null;
}

interface MetricItem {
  label: string;
  value: string;
  icon: typeof Coins;
  delta?: { current: number; previous: number | null; downIsGood?: boolean };
}

/** Custos zerados significam "sem dado" — não servem de base de comparação. */
function costBase(current: number, previousValue: number | undefined): number | null {
  if (current <= 0 || previousValue === undefined || previousValue <= 0) return null;
  return previousValue;
}

export default function MetricsPanel({ metrics, previous }: MetricsPanelProps) {
  const items: MetricItem[] = [
    {
      label: "Cliques",
      value: formatNumber(metrics.cliques),
      icon: MousePointerClick,
      delta: { current: metrics.cliques, previous: previous?.cliques ?? null },
    },
    {
      label: "Conversões",
      value: formatNumber(metrics.conversoes),
      icon: Target,
      delta: { current: metrics.conversoes, previous: previous?.conversoes ?? null },
    },
    {
      label: "Leads",
      value: formatNumber(metrics.leads),
      icon: Users,
      delta: { current: metrics.leads, previous: previous?.leads ?? null },
    },
    {
      label: "Mensagens",
      value: formatNumber(metrics.mensagens),
      icon: MessageCircle,
      delta: { current: metrics.mensagens, previous: previous?.mensagens ?? null },
    },
    {
      label: "CPC",
      value: metrics.cpc > 0 ? formatCurrency(metrics.cpc) : "—",
      icon: Coins,
      delta: {
        current: metrics.cpc,
        previous: costBase(metrics.cpc, previous?.cpc),
        downIsGood: true,
      },
    },
  ];

  if (metrics.leads > 0) {
    items.push({
      label: "CPL",
      value: formatCurrency(metrics.cpl),
      icon: Coins,
      delta: {
        current: metrics.cpl,
        previous: costBase(metrics.cpl, previous?.cpl),
        downIsGood: true,
      },
    });
  }
  if (metrics.mensagens > 0) {
    items.push({
      label: "Custo/Conversa",
      value: formatCurrency(metrics.custoPorMensagem),
      icon: Coins,
      delta: {
        current: metrics.custoPorMensagem,
        previous: costBase(metrics.custoPorMensagem, previous?.custoPorMensagem),
        downIsGood: true,
      },
    });
  }
  if (metrics.leads === 0 && metrics.mensagens === 0) {
    items.push({
      label: "Custo/Resultado",
      value: metrics.custoPorResultado > 0 ? formatCurrency(metrics.custoPorResultado) : "—",
      icon: Coins,
      delta: {
        current: metrics.custoPorResultado,
        previous: costBase(metrics.custoPorResultado, previous?.custoPorResultado),
        downIsGood: true,
      },
    });
  }

  // Funil de vendas (infoproduto): só aparece quando há atividade de venda
  const hasSales =
    metrics.carrinho > 0 ||
    metrics.compras > 0 ||
    metrics.receita > 0 ||
    (previous != null && (previous.carrinho > 0 || previous.compras > 0));

  const salesItems: MetricItem[] = hasSales
    ? [
        {
          label: "Receita",
          value: formatCurrency(metrics.receita),
          icon: Banknote,
          delta: { current: metrics.receita, previous: previous?.receita ?? null },
        },
        {
          label: "ROAS",
          value:
            metrics.roas > 0
              ? `${metrics.roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`
              : "—",
          icon: TrendingUp,
          delta: { current: metrics.roas, previous: costBase(metrics.roas, previous?.roas) },
        },
        {
          label: "Compras",
          value: formatNumber(metrics.compras),
          icon: ShoppingBag,
          delta: { current: metrics.compras, previous: previous?.compras ?? null },
        },
        {
          label: "Custo/Compra",
          value: metrics.compras > 0 ? formatCurrency(metrics.custoPorCompra) : "—",
          icon: Coins,
          delta: {
            current: metrics.custoPorCompra,
            previous: costBase(metrics.custoPorCompra, previous?.custoPorCompra),
            downIsGood: true,
          },
        },
        {
          label: "Carrinho",
          value: formatNumber(metrics.carrinho),
          icon: ShoppingCart,
          delta: { current: metrics.carrinho, previous: previous?.carrinho ?? null },
        },
        {
          label: "Checkout iniciado",
          value: formatNumber(metrics.checkouts),
          icon: CreditCard,
          delta: { current: metrics.checkouts, previous: previous?.checkouts ?? null },
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Gasto total: investimento não leva comparativo */}
      <div className="rounded-xl bg-accent/10 border border-accent/30 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet size={22} className="text-accent" />
          <span className="text-muted">Gasto total no período</span>
        </div>
        <span className="text-2xl font-bold text-accent">
          {formatCurrency(metrics.custoTotal)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items.map(({ label, value, icon: Icon, delta }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-4">
            <div className="flex items-center gap-2 text-muted text-sm mb-2">
              <Icon size={15} />
              {label}
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

      {hasSales && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ShoppingBag size={16} className="text-accent" />
            Vendas
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {salesItems.map(({ label, value, icon: Icon, delta }) => (
              <div key={label} className="rounded-xl bg-card border border-border p-4">
                <div className="flex items-center gap-2 text-muted text-sm mb-2">
                  <Icon size={15} />
                  {label}
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
        </div>
      )}
    </div>
  );
}
