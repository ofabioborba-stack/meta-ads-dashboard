"use client";

import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { Mascot } from "@/lib/mascots";
import type { Period } from "@/types";
import InsightsContent from "./InsightsContent";

interface InsightsSectionProps {
  clientId: string;
  period: Period;
  start?: string;
  end?: string;
  /** Mascote do tenant — personaliza imagem e textos da seção. */
  mascot?: Mascot | null;
}

/** Geração de insights por IA do período visualizado — visível só para admin. */
export default function InsightsSection({
  clientId,
  period,
  start,
  end,
  mascot,
}: InsightsSectionProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, period, start, end }),
      });
      const data = (await res.json()) as { insights?: string; error?: string };
      if (!res.ok || !data.insights) {
        throw new Error(data.error ?? `Erro ${res.status}`);
      }
      setInsights(data.insights);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar insights");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {mascot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mascot.imageUrl}
              alt={mascot.name}
              className="w-9 h-9 object-contain"
            />
          ) : (
            <Sparkles size={16} className="text-accent" />
          )}
          <h3 className="font-semibold">
            {mascot ? `Insights do ${mascot.name}` : "Insights por IA"}
          </h3>
          <span className="text-xs text-muted">análise do período selecionado</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-accent text-white text-sm font-medium px-4 py-2 hover:bg-accent/80 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              {mascot
                ? `${mascot.name} está analisando... (até 1 min)`
                : "Analisando dados... (até 1 min)"}
            </>
          ) : insights ? (
            "Gerar novamente"
          ) : mascot ? (
            `Gerar Insights com o ${mascot.name}`
          ) : (
            "Gerar insights"
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-danger/10 border border-danger/40 text-danger text-sm px-3 py-2">
          {error}
        </p>
      )}

      {insights && (
        <div className="mt-4 border-t border-border pt-4">
          <InsightsContent text={insights} />
        </div>
      )}
    </div>
  );
}
