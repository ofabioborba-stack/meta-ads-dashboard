import Link from "next/link";
import type { ClientWithData, MetricKey } from "@/types";
import { dynamicCostMetric, formatMetric, metricLabel } from "@/lib/metrics";
import AlertBadge from "./AlertBadge";
import BalanceBar from "./BalanceBar";

interface ClientCardProps {
  client: ClientWithData;
  metricKeys: MetricKey[];
}

export default function ClientCard({ client, metricKeys }: ClientCardProps) {
  const { account, balance, metrics, group } = client;
  // Alerta só para pré-pagas: pós-pagas (cartão) não têm saldo a esgotar
  const hasLowBalance =
    balance !== null &&
    account !== null &&
    balance.is_prepaid !== false &&
    balance.balance !== null &&
    balance.balance < account.alert_threshold;

  const statusColor =
    client.status === "alert" || hasLowBalance
      ? "bg-danger"
      : client.status === "paused"
        ? "bg-warning"
        : "bg-success";

  return (
    <Link
      href={`/clients/${client.id}`}
      className="relative block rounded-xl bg-card border border-border p-5 hover:bg-card-hover hover:border-accent/40 transition-colors"
    >
      {group && (
        <span
          className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: group.color }}
          title={group.name}
        />
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url}
              alt={client.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-accent/20 text-accent flex items-center justify-center font-bold">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-semibold leading-tight">{client.name}</h3>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
              <span className="rounded bg-accent/15 text-accent px-1.5 py-0.5 font-medium">
                Meta
              </span>
            </span>
          </div>
        </div>
        {hasLowBalance && <AlertBadge />}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-sm">
        {metricKeys.map((key) => {
          if (key === "cost") {
            const cost = dynamicCostMetric(metrics);
            return <Metric key={key} label={cost.label} value={cost.value} />;
          }
          return (
            <Metric key={key} label={metricLabel(key)} value={formatMetric(key, metrics)} />
          );
        })}
      </div>

      <BalanceBar
        balance={balance?.balance ?? null}
        threshold={account?.alert_threshold ?? 200}
        prepaid={balance?.is_prepaid ?? true}
      />
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted truncate">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
