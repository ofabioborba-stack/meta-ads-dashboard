"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

interface ThresholdEditorProps {
  accountId: string;
  currentThreshold: number;
}

export default function ThresholdEditor({ accountId, currentThreshold }: ThresholdEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentThreshold));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Informe um valor válido.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("client_accounts")
        .update({ alert_threshold: parsed })
        .eq("id", accountId);

      if (updateError) throw updateError;

      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar threshold.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors"
      >
        <Pencil size={14} />
        Editar alerta ({formatCurrency(currentThreshold)})
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Threshold de alerta</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-white">
                <X size={18} />
              </button>
            </div>

            <label className="block text-sm text-muted mb-1">
              Alertar quando o saldo ficar abaixo de (R$)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg bg-background border border-border px-3 py-2 mb-3 focus:outline-none focus:border-accent"
            />

            {error && <p className="text-sm text-danger mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-colors"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
