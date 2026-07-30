"use client";

import { AlertCircle, ChevronDown, ChevronUp, Loader2, PlusCircle } from "lucide-react";
import { useState } from "react";
import { importClientFromRawData } from "@/app/actions/clients";
import { formatCurrency } from "@/lib/utils";
import type { Group } from "@/types";

export interface UnlinkedAccount {
  cliente_id: string;
  account_name: string | null;
  dias_com_dados: number;
  ultima_data: string;
  custo_total: number;
}

interface ImportClientsPanelProps {
  accounts: UnlinkedAccount[];
  groups: Group[];
}

interface RowState {
  name: string;
  groupId: string;
  loading: boolean;
  error: string | null;
  done: boolean;
}

export default function ImportClientsPanel({ accounts, groups }: ImportClientsPanelProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      accounts.map((a) => [
        a.cliente_id,
        {
          name: a.account_name?.replace(/^(C\.A|CA|Anúncios|Conta \d+)\s*-\s*/i, "").trim() ?? "",
          groupId: groups[0]?.id ?? "",
          loading: false,
          error: null,
          done: false,
        },
      ])
    )
  );

  const pending = accounts.filter((a) => !rows[a.cliente_id]?.done);
  if (pending.length === 0) return null;

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleImport(account: UnlinkedAccount) {
    const row = rows[account.cliente_id];
    if (!row || row.loading) return;

    updateRow(account.cliente_id, { loading: true, error: null });
    try {
      await importClientFromRawData(
        account.cliente_id,
        row.name,
        row.groupId || null,
        account.account_name
      );
      updateRow(account.cliente_id, { done: true, loading: false });
    } catch (e) {
      updateRow(account.cliente_id, {
        error: e instanceof Error ? e.message : "Erro ao cadastrar.",
        loading: false,
      });
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-warning/40 bg-warning/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2 font-medium text-warning">
          <AlertCircle size={18} />
          {pending.length === 1
            ? "1 conta nova detectada no banco de dados"
            : `${pending.length} contas novas detectadas no banco de dados`}
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted" />
        ) : (
          <ChevronDown size={16} className="text-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-warning/20 px-5 pb-5 pt-4 space-y-4">
          <p className="text-sm text-muted">
            Estas contas têm dados na tabela <code className="text-warning">meta_ads_raw_data</code> mas
            ainda não estão cadastradas como clientes. Preencha o nome e o grupo e clique em Cadastrar.
          </p>

          {pending.map((account) => {
            const row = rows[account.cliente_id];
            if (!row || row.done) return null;

            return (
              <div
                key={account.cliente_id}
                className="rounded-lg bg-card border border-border p-4 space-y-3"
              >
                <div className="flex flex-wrap gap-4 text-sm">
                  <Info label="ID da conta" value={`act_${account.cliente_id}`} />
                  <Info label="Nome no Meta" value={account.account_name ?? "—"} />
                  <Info label="Último dado" value={account.ultima_data} />
                  <Info label="Dias com dados" value={String(account.dias_com_dados)} />
                  <Info label="Gasto total" value={formatCurrency(account.custo_total)} />
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-48">
                    <label className="block text-xs text-muted mb-1">Nome do cliente</label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) =>
                        updateRow(account.cliente_id, { name: e.target.value })
                      }
                      placeholder="Ex: Clínica Fisioprime"
                      className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                  </div>

                  {groups.length > 0 && (
                    <div>
                      <label className="block text-xs text-muted mb-1">Grupo / Gestor</label>
                      <select
                        value={row.groupId}
                        onChange={(e) =>
                          updateRow(account.cliente_id, { groupId: e.target.value })
                        }
                        className="rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                      >
                        <option value="">— Sem grupo —</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={() => handleImport(account)}
                    disabled={row.loading || !row.name.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50 transition-colors"
                  >
                    {row.loading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <PlusCircle size={15} />
                    )}
                    Cadastrar
                  </button>
                </div>

                {row.error && (
                  <p className="text-sm text-danger">{row.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted block">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
