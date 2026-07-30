"use client";

import { useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Search } from "lucide-react";
import type { Lead, LeadStatus } from "@/types";
import { computeLeadsMetrics } from "@/lib/utils";
import LeadsMetrics from "./LeadsMetrics";

type LeadPeriod = "current" | "7d" | "30d" | "90d" | "all";

const LEAD_PERIOD_OPTIONS: { value: LeadPeriod; label: string }[] = [
  { value: "current", label: "Período atual" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Todo o período" },
];

const COLUMNS: { status: LeadStatus; label: string; emoji: string; color: string }[] = [
  { status: "CREATED", label: "Novo", emoji: "🆕", color: "#4F6EF7" },
  { status: "CONTACTED", label: "Contactado", emoji: "📞", color: "#F59E0B" },
  { status: "QUALIFIED", label: "Qualificado", emoji: "⭐", color: "#A855F7" },
  { status: "CONVERTED", label: "Convertido", emoji: "✅", color: "#10B981" },
  { status: "LOST", label: "Perdido", emoji: "❌", color: "#EF4444" },
];

interface KanbanBoardProps {
  leads: Lead[];
  totalSpend: number;
  /** Início do período selecionado no seletor de cima (YYYY-MM-DD). */
  dateFrom: string;
  /** Fim do período selecionado no seletor de cima (YYYY-MM-DD). */
  dateTo: string;
  /** Início do período anterior para comparativo. */
  prevFrom: string;
  /** Fim do período anterior para comparativo. */
  prevTo: string;
  /**
   * Token do link compartilhável. Quando presente, o board está na view
   * pública do cliente: o PATCH de status autentica pelo token e métricas
   * internas de custo (CPL real) ficam ocultas.
   */
  publicToken?: string;
}

export default function KanbanBoard({
  leads: initialLeads,
  totalSpend,
  dateFrom,
  dateTo,
  prevFrom,
  prevTo,
  publicToken,
}: KanbanBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [campaignId, setCampaignId] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [leadPeriod, setLeadPeriod] = useState<LeadPeriod>("current");

  const inRange = (lead: Lead, from: string, to: string) => {
    if (!lead.created_time) return false;
    const d = lead.created_time.slice(0, 10);
    return d >= from && d <= to;
  };

  const effectiveRange = useMemo((): { from: string; to: string } | null => {
    if (leadPeriod === "all") return null;
    if (leadPeriod === "current") return { from: dateFrom, to: dateTo };
    const today = new Date().toISOString().slice(0, 10);
    const days = leadPeriod === "7d" ? 7 : leadPeriod === "30d" ? 30 : 90;
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - days + 1);
    return { from: fromDate.toISOString().slice(0, 10), to: today };
  }, [leadPeriod, dateFrom, dateTo]);

  const { metrics, previousMetrics } = useMemo(() => ({
    metrics: computeLeadsMetrics(
      leads.filter((l) => inRange(l, dateFrom, dateTo)),
      totalSpend
    ),
    previousMetrics: computeLeadsMetrics(
      leads.filter((l) => inRange(l, prevFrom, prevTo)),
      0
    ),
  }), [leads, totalSpend, dateFrom, dateTo, prevFrom, prevTo]);

  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of leads) {
      if (lead.campaign_id) {
        map.set(lead.campaign_id, lead.campaign_name ?? lead.campaign_id);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const termDigits = term.replace(/\D/g, "");

    return leads.filter((lead) => {
      if (campaignId !== "all" && lead.campaign_id !== campaignId) return false;
      if (effectiveRange && !inRange(lead, effectiveRange.from, effectiveRange.to)) return false;
      if (term) {
        const byName = (lead.nome ?? "").toLowerCase().includes(term);
        const byPhone =
          termDigits.length > 0 &&
          (lead.telefone ?? "").replace(/\D/g, "").includes(termDigits);
        if (!byName && !byPhone) return false;
      }
      return true;
    });
  }, [leads, campaignId, effectiveRange, search]);

  async function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId as LeadStatus;
    const previous = leads;

    // Otimistic update — reverte se o PATCH falhar
    const now = new Date().toISOString();
    setLeads((current) =>
      current.map((l) =>
        l.id === draggableId ? { ...l, lead_status: newStatus, updated_at: now } : l
      )
    );
    setError(null);

    try {
      const query = publicToken ? `?token=${encodeURIComponent(publicToken)}` : "";
      const res = await fetch(`/api/leads/${draggableId}${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_status: newStatus }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Erro ${res.status}`);
      }
    } catch (e) {
      setLeads(previous);
      setError(e instanceof Error ? e.message : "Falha ao atualizar o lead");
    }
  }

  return (
    <div className="space-y-4">
      <LeadsMetrics
        metrics={metrics}
        hideCpl={!!publicToken}
        previous={previousMetrics ?? undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {LEAD_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLeadPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                leadPeriod === opt.value
                  ? "bg-accent text-white"
                  : "bg-card text-muted hover:text-white hover:bg-card-hover"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="rounded-lg bg-card border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
        >
          <option value="all">Todas as campanhas</option>
          {campaigns.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full rounded-lg bg-card border border-border pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-danger/10 border border-danger/40 text-danger text-sm px-3 py-2">
          {error}
        </p>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
          {COLUMNS.map((column) => {
            const columnLeads = filtered.filter((l) => l.lead_status === column.status);
            return (
              <Droppable key={column.status} droppableId={column.status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-xl bg-card border p-3 min-h-[160px] transition-colors ${
                      snapshot.isDraggingOver ? "border-accent/60" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <span>{column.emoji}</span>
                        <span style={{ color: column.color }}>{column.label}</span>
                      </span>
                      <span className="text-xs text-muted bg-background rounded px-1.5 py-0.5">
                        {columnLeads.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {columnLeads.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`rounded-lg bg-card-hover border border-border p-3 text-sm ${
                                dragSnapshot.isDragging ? "border-accent shadow-lg" : ""
                              }`}
                            >
                              <LeadCard lead={lead} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}

/** Dígitos do telefone com DDI 55 garantido para o link wa.me. */
function whatsappNumber(telefone: string): string {
  const digits = telefone.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);
}

function LeadCard({ lead }: { lead: Lead }) {
  const customFields = Object.entries(lead.custom_fields ?? {});

  return (
    <div className="space-y-1.5">
      <p className="font-medium leading-tight">{lead.nome ?? "(sem nome)"}</p>

      {lead.telefone && (
        <a
          href={`https://wa.me/${whatsappNumber(lead.telefone)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block text-accent hover:underline text-xs"
        >
          {lead.telefone}
        </a>
      )}

      {lead.campaign_name && (
        <p className="text-xs text-muted truncate" title={lead.campaign_name}>
          {lead.campaign_name}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{formatDate(lead.created_time)}</span>
        {lead.form_name && (
          <span
            className="text-[10px] rounded bg-accent/15 text-accent px-1.5 py-0.5 truncate max-w-[120px]"
            title={lead.form_name}
          >
            {lead.form_name}
          </span>
        )}
      </div>

      {customFields.length > 0 && (
        <details className="text-xs" onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer text-muted hover:text-white">
            Campos extras ({customFields.length})
          </summary>
          <dl className="mt-1.5 space-y-1">
            {customFields.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <dt className="text-muted truncate">{key}</dt>
                <dd className="text-right break-all">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
