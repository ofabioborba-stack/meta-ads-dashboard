import { formatCurrency } from "@/lib/utils";

interface BalanceBarProps {
  balance: number | null;
  threshold: number;
  /** false = conta pós-paga (cartão): não existe saldo restante a exibir. */
  prepaid?: boolean;
  expanded?: boolean;
}

/**
 * Barra de saldo restante. Referência de "tanque cheio" = 5x o threshold,
 * de modo que saldo < threshold equivale a <20% (vermelho), alinhado ao alerta.
 */
export default function BalanceBar({
  balance,
  threshold,
  prepaid = true,
  expanded = false,
}: BalanceBarProps) {
  if (!prepaid) {
    return (
      <div>
        <div className={`flex justify-between mb-1 ${expanded ? "text-sm" : "text-xs"}`}>
          <span className="text-muted">Saldo</span>
          <span className="text-muted">Pós-paga (cartão)</span>
        </div>
        <div className={`rounded-full bg-border ${expanded ? "h-3" : "h-2"}`} />
        {expanded && (
          <p className="text-xs text-muted mt-1">
            Conta faturada no cartão de crédito — não há saldo pré-pago a acompanhar.
          </p>
        )}
      </div>
    );
  }

  if (balance === null) {
    return (
      <div>
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>Saldo</span>
          <span>não sincronizado</span>
        </div>
        <div className="h-2 rounded-full bg-border" />
      </div>
    );
  }

  const reference = threshold * 5;
  const percent = Math.min(Math.max(balance / reference, 0), 1) * 100;

  const color =
    percent > 50 ? "bg-success" : percent >= 20 ? "bg-warning" : "bg-danger";

  return (
    <div>
      <div className={`flex justify-between mb-1 ${expanded ? "text-sm" : "text-xs"}`}>
        <span className="text-muted">Saldo</span>
        <span className="font-medium">
          {formatCurrency(balance)}
          <span className="text-muted ml-1">({percent.toFixed(0)}%)</span>
        </span>
      </div>
      <div className={`rounded-full bg-border overflow-hidden ${expanded ? "h-3" : "h-2"}`}>
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {expanded && (
        <p className="text-xs text-muted mt-1">
          Alerta configurado para saldo abaixo de {formatCurrency(threshold)}
        </p>
      )}
    </div>
  );
}
