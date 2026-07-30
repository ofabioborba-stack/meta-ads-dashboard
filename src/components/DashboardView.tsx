"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ClientWithData, Group, MetricKey } from "@/types";
import { DEFAULT_METRIC_KEYS, MAX_SELECTED_METRICS, isMetricKey } from "@/lib/metrics";
import ClientCard from "./ClientCard";
import MetricSelector from "./MetricSelector";

const GROUP_FILTER_STORAGE_KEY = "dashboard_group_filter";
const METRICS_STORAGE_KEY = "dashboard_metrics";
const ALL_GROUPS = "all";

// localStorage como fonte de verdade das preferências, via useSyncExternalStore:
// no servidor renderiza os padrões e re-sincroniza no cliente após a hidratação.
const storageListeners = new Set<() => void>();

function subscribeStorage(listener: () => void) {
  storageListeners.add(listener);
  return () => {
    storageListeners.delete(listener);
  };
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // sem persistência — preferência não será mantida entre sessões
  }
  storageListeners.forEach((listener) => listener());
}

function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    subscribeStorage,
    () => readStorage(key),
    () => null
  );
}

interface DashboardViewProps {
  clients: ClientWithData[];
  groups: Group[];
  /** Tenants não-admin já chegam filtrados pelo servidor — sem filtro de grupo. */
  showGroupFilter?: boolean;
}

export default function DashboardView({
  clients,
  groups,
  showGroupFilter = true,
}: DashboardViewProps) {
  const storedFilter = useStoredValue(GROUP_FILTER_STORAGE_KEY);
  const storedMetrics = useStoredValue(METRICS_STORAGE_KEY);

  const groupFilter =
    showGroupFilter && storedFilter && groups.some((g) => g.id === storedFilter)
      ? storedFilter
      : ALL_GROUPS;

  const metricKeys = useMemo<MetricKey[]>(() => {
    try {
      const parsed: unknown = JSON.parse(storedMetrics ?? "null");
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(isMetricKey).slice(0, MAX_SELECTED_METRICS);
        if (valid.length > 0) return valid;
      }
    } catch {
      // valor corrompido — usa padrões
    }
    return DEFAULT_METRIC_KEYS;
  }, [storedMetrics]);

  const filtered =
    groupFilter === ALL_GROUPS
      ? clients
      : clients.filter((c) => c.group_id === groupFilter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {showGroupFilter ? (
          <div className="flex flex-wrap items-center gap-2">
            <FilterButton
              label="Todos"
              active={groupFilter === ALL_GROUPS}
              onClick={() => writeStorage(GROUP_FILTER_STORAGE_KEY, ALL_GROUPS)}
            />
            {groups.map((group) => (
              <FilterButton
                key={group.id}
                label={group.name}
                color={group.color}
                active={groupFilter === group.id}
                onClick={() => writeStorage(GROUP_FILTER_STORAGE_KEY, group.id)}
              />
            ))}
          </div>
        ) : (
          <div />
        )}
        <MetricSelector
          selected={metricKeys}
          onChange={(next) => writeStorage(METRICS_STORAGE_KEY, JSON.stringify(next))}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">Nenhum cliente neste grupo.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} metricKeys={metricKeys} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-accent/15 border-accent text-white font-medium"
          : "bg-card border-border text-muted hover:text-white"
      }`}
    >
      {color && (
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
    </button>
  );
}
