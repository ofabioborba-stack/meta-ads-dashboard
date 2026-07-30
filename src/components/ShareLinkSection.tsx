"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, RefreshCw, XCircle } from "lucide-react";
import { generateClientToken, revokeClientToken } from "@/app/actions/tokens";
import type { ClientToken } from "@/types";

interface ShareLinkSectionProps {
  clientId: string;
  token: ClientToken | null;
  /** URL completa do link compartilhável (null quando não há token ativo). */
  shareUrl: string | null;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function ShareLinkSection({
  clientId,
  token,
  shareUrl,
}: ShareLinkSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      // navigator.clipboard só existe em contexto seguro (HTTPS/localhost);
      // em hosts http como dash.*.local cai no fallback com execCommand.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!ok) throw new Error("execCommand falhou");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Copie manualmente do campo acima.");
    }
  }

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={16} className="text-accent" />
        <h3 className="font-semibold">Link do Cliente</h3>
      </div>

      {!token ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Gere um link compartilhável para o cliente acompanhar os próprios
            resultados sem precisar de login.
          </p>
          <button
            onClick={() => run(() => generateClientToken(clientId))}
            disabled={isPending}
            className="rounded-lg bg-accent text-white text-sm font-medium px-4 py-2 hover:bg-accent/80 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Gerando..." : "Gerar link compartilhável"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl ?? ""}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-muted focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 border border-accent text-accent text-sm px-3 py-2 hover:bg-accent/25 transition-colors"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span>Criado em {formatDateTime(token.created_at)}</span>
            <span>Último acesso: {formatDateTime(token.last_accessed_at)}</span>
            <span>
              {token.access_count} {token.access_count === 1 ? "acesso" : "acessos"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run(() => revokeClientToken(token.id, clientId))}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/50 text-danger text-sm px-3 py-2 hover:bg-danger/10 disabled:opacity-50 transition-colors"
            >
              <XCircle size={15} />
              Revogar link
            </button>
            <button
              onClick={() => run(() => generateClientToken(clientId))}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border text-muted text-sm px-3 py-2 hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={15} className={isPending ? "animate-spin" : ""} />
              Gerar novo link
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}
