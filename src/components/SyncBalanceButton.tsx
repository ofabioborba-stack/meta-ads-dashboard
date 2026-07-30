"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { syncBalance } from "@/app/actions/balance";

interface Props {
  updatedAt: string | null;
}

export default function SyncBalanceButton({ updatedAt }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const label = updatedAt
    ? `Atualizado ${new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(updatedAt))}`
    : "Nunca sincronizado";

  async function handleSync() {
    setLoading(true);
    setError(null);
    try {
      const result = await syncBalance();
      if (result?.error) throw new Error(result.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sincronizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleSync}
        disabled={loading}
        title="Sincronizar saldo agora"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors disabled:opacity-50"
      >
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        {loading ? "Sincronizando..." : "Atualizar saldo"}
      </button>
      <span className="text-[10px] text-muted/60">{label}</span>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
