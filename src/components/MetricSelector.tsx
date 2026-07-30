"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import type { MetricKey } from "@/types";
import { MAX_SELECTED_METRICS, METRIC_OPTIONS } from "@/lib/metrics";

interface MetricSelectorProps {
  selected: MetricKey[];
  onChange: (next: MetricKey[]) => void;
}

export default function MetricSelector({ selected, onChange }: MetricSelectorProps) {
  const [open, setOpen] = useState(false);

  function toggle(key: MetricKey) {
    if (selected.includes(key)) {
      if (selected.length === 1) return; // mantém ao menos 1 métrica no card
      onChange(selected.filter((k) => k !== key));
    } else if (selected.length < MAX_SELECTED_METRICS) {
      onChange([...selected, key]);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Escolher métricas dos cards"
        className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
          open
            ? "bg-accent text-white border-accent"
            : "bg-card border-border text-muted hover:text-white"
        }`}
      >
        <Settings size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-64 rounded-xl bg-card border border-border p-3 shadow-xl">
            <p className="text-xs text-muted mb-2 px-1">
              Métricas dos cards ({selected.length}/{MAX_SELECTED_METRICS})
            </p>
            <ul className="space-y-0.5">
              {METRIC_OPTIONS.map(({ key, label }) => {
                const checked = selected.includes(key);
                const disabled = !checked && selected.length >= MAX_SELECTED_METRICS;
                return (
                  <li key={key}>
                    <label
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
                        disabled
                          ? "opacity-40 cursor-not-allowed"
                          : "cursor-pointer hover:bg-card-hover"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(key)}
                        className="accent-accent"
                      />
                      {label}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
