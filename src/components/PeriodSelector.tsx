"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Period } from "@/types";

const PERIODS: { value: Exclude<Period, "custom">; label: string }[] = [
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "month", label: "Mês atual" },
  { value: "prev_month", label: "Mês anterior" },
];

const MIN_DATE = "2026-01-01";

interface PeriodSelectorProps {
  current: Period;
  basePath: string;
  /** Data máxima selecionável (ontem), calculada no servidor. */
  maxDate: string;
  customStart?: string;
  customEnd?: string;
}

export default function PeriodSelector({
  current,
  basePath,
  maxDate,
  customStart,
  customEnd,
}: PeriodSelectorProps) {
  const router = useRouter();
  const [showCustom, setShowCustom] = useState(current === "custom");
  const [start, setStart] = useState(customStart ?? "");
  const [end, setEnd] = useState(customEnd ?? "");

  const canApply =
    start !== "" &&
    end !== "" &&
    start <= end &&
    start >= MIN_DATE &&
    end <= maxDate;

  function apply() {
    if (!canApply) return;
    router.push(`${basePath}?period=custom&start=${start}&end=${end}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg bg-card border border-border p-1 gap-1">
        {PERIODS.map(({ value, label }) => (
          <Link
            key={value}
            href={`${basePath}?period=${value}`}
            onClick={() => setShowCustom(false)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              current === value && !showCustom
                ? "bg-accent text-white font-medium"
                : "text-muted hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            showCustom || current === "custom"
              ? "bg-accent text-white font-medium"
              : "text-muted hover:text-white"
          }`}
        >
          Personalizado
        </button>
      </div>

      {showCustom && (
        <div className="inline-flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted">
            De
            <input
              type="date"
              value={start}
              min={MIN_DATE}
              max={maxDate}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg bg-card border border-border px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            Até
            <input
              type="date"
              value={end}
              min={MIN_DATE}
              max={maxDate}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg bg-card border border-border px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-accent [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={apply}
            disabled={!canApply}
            className="rounded-lg bg-accent text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
