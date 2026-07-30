"use client";

import { Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateAccountFunding } from "@/app/actions/funding";
import { formatCurrency } from "@/lib/utils";

interface FundingEditorProps {
  accountId: string;
  clientId: string;
  currentAmount: number | null;
  currentDate: string | null;
  currentTaxRate: number;
}

function formatBr(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Controle manual de recarga para contas cujo saldo a Meta API não expõe
 * (pós-pagas com fundos pré-carregados). O saldo vira: recarga - gasto
 * acumulado desde a data, atualizado no sync diário.
 */
export default function FundingEditor({
  accountId,
  clientId,
  currentAmount,
  currentDate,
  currentTaxRate,
}: FundingEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(currentAmount !== null ? String(currentAmount) : "");
  const [date, setDate] = useState(currentDate ?? "");
  const [taxRate, setTaxRate] = useState(String(currentTaxRate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError("Informe o valor carregado na conta.");
      return;
    }
    if (!date) {
      setError("Informe a data da recarga.");
      return;
    }
    const parsedTax = taxRate === "" ? 0 : Number(taxRate);
    if (Number.isNaN(parsedTax) || parsedTax < 0 || parsedTax > 30) {
      setError("Imposto inválido (percentual entre 0 e 30).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateAccountFunding(accountId, clientId, parsed, date, parsedTax);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar recarga.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      await updateAccountFunding(accountId, clientId, null, null);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover recarga.");
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
        <Wallet size={14} />
        {currentAmount !== null && currentDate !== null
          ? `Recarga: ${formatCurrency(currentAmount)} em ${formatBr(currentDate)}`
          : "Registrar recarga"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Recarga manual</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-muted mb-4">
              Para contas em que o Meta não informa o saldo. O painel calcula:
              recarga − gasto desde a data × (1 + imposto), atualizado 1x ao dia.
            </p>

            <label className="block text-sm text-muted mb-1">Valor carregado (R$)</label>
            <input
              type="number"
              min="0"
              step="50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg bg-background border border-border px-3 py-2 mb-3 focus:outline-none focus:border-accent"
            />

            <label className="block text-sm text-muted mb-1">Data da recarga</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-background border border-border px-3 py-2 mb-3 focus:outline-none focus:border-accent"
            />

            <label className="block text-sm text-muted mb-1">
              Imposto repassado pelo Meta (%) — ex.: ISS
            </label>
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full rounded-lg bg-background border border-border px-3 py-2 mb-3 focus:outline-none focus:border-accent"
            />

            {error && <p className="text-sm text-danger mb-3">{error}</p>}

            <div className="flex justify-between gap-2">
              {currentAmount !== null ? (
                <button
                  onClick={handleRemove}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors"
                >
                  Remover
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
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
        </div>
      )}
    </>
  );
}
