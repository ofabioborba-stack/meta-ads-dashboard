interface DeltaBadgeProps {
  current: number;
  /** Valor do período anterior; null/<=0 = sem base de comparação (mostra —). */
  previous: number | null;
  /** Métricas de custo/tempo: queda é positiva (verde) e alta é negativa (vermelho). */
  downIsGood?: boolean;
}

/** Variação percentual vs o período anterior correspondente (▲/▼ + %). */
export default function DeltaBadge({
  current,
  previous,
  downIsGood = false,
}: DeltaBadgeProps) {
  if (previous === null || previous <= 0) {
    return (
      <span className="text-xs text-muted" title="Sem dados no período anterior">
        —
      </span>
    );
  }

  const delta = ((current - previous) / previous) * 100;
  if (!Number.isFinite(delta)) {
    return <span className="text-xs text-muted">—</span>;
  }

  const isUp = delta > 0;
  const isZero = Math.abs(delta) < 0.05;
  const good = isZero ? null : downIsGood ? !isUp : isUp;
  const color = isZero
    ? "text-muted"
    : good
      ? "text-success"
      : "text-danger";
  const formatted = `${Math.abs(delta).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}
      title="Variação vs período anterior"
    >
      {isZero ? "•" : isUp ? "▲" : "▼"} {formatted}
    </span>
  );
}
