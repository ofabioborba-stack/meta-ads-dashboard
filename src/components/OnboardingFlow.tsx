"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  LogOut,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { registerGestorClients } from "@/app/actions/clients";
import type { RegisteredAccount } from "@/app/actions/clients";

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  already_registered: boolean;
}

type Step = "connect" | "accounts" | "registering" | "backfilling" | "done";

interface Props {
  hasToken: boolean;
  metaUserName: string | null;
  oauthError: string | null;
  hasClients: boolean;
}

const OAUTH_ERROR_LABELS: Record<string, string> = {
  meta_denied: "Você cancelou a autorização no Meta.",
  invalid_state: "A sessão expirou. Tente novamente.",
  no_code: "Código de autorização não recebido.",
  token_exchange_failed: "Falha ao obter o token Meta. Tente novamente.",
};

export default function OnboardingFlow({ hasToken, metaUserName, oauthError, hasClients }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(hasToken ? "accounts" : "connect");
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [metaUser, setMetaUser] = useState<string | null>(metaUserName);
  // Maps account_id → custom display name chosen by the gestor
  const [selectedNames, setSelectedNames] = useState<Map<string, string>>(new Map());
  // Maps account_id → logo file chosen before registration
  const [logoFiles, setLogoFiles] = useState<Map<string, File>>(new Map());
  const [backfillProgress, setBackfillProgress] = useState({ done: 0, total: 0 });
  const [skipped, setSkipped] = useState<Array<{ accountId: string; reason: string }>>([]);

  useEffect(() => {
    if (step !== "accounts") return;

    setAccountsLoading(true);
    setAccountsError(null);

    fetch("/api/meta/accounts")
      .then((r) => r.json())
      .then((data: { error?: string; meta_user_name?: string; accounts?: AdAccount[] }) => {
        if (data.error) {
          setAccountsError(data.error);
          return;
        }
        if (data.meta_user_name) setMetaUser(data.meta_user_name);

        const available = (data.accounts ?? []).filter((a) => !a.already_registered);
        setAccounts(data.accounts ?? []);

        const initial = new Map<string, string>();
        for (const a of available) initial.set(a.id, a.name);
        setSelectedNames(initial);
      })
      .catch((e: Error) => setAccountsError(e.message))
      .finally(() => setAccountsLoading(false));
  }, [step]);

  function toggleAccount(accountId: string, defaultName: string) {
    setSelectedNames((prev) => {
      const next = new Map(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.set(accountId, defaultName);
      return next;
    });
  }

  function updateName(accountId: string, name: string) {
    setSelectedNames((prev) => new Map(prev).set(accountId, name));
  }

  function handleLogoFile(accountId: string, file: File | null) {
    setLogoFiles((prev) => {
      const next = new Map(prev);
      if (file) next.set(accountId, file);
      else next.delete(accountId);
      return next;
    });
  }

  async function uploadLogos(registered: RegisteredAccount[]) {
    for (const account of registered) {
      const file = logoFiles.get(account.accountId);
      if (!file) continue;
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/clients/${account.clientId}/logo`, {
        method: "POST",
        body: fd,
      }).catch(() => {}); // non-fatal
    }
  }

  async function handleRegister() {
    const toRegister = [...selectedNames.entries()].map(([accountId, name]) => {
      const account = accounts.find((a) => a.id === accountId);
      return { accountId, name, accountName: account?.name ?? null };
    });

    if (toRegister.length === 0) return;

    setStep("registering");

    const result = await registerGestorClients(toRegister);

    if (result.skipped.length > 0) {
      setSkipped(result.skipped.map((s) => ({ accountId: s.accountId, reason: s.reason })));
    }

    if (result.registered.length === 0) {
      setStep("done");
      return;
    }

    // Upload logos (optional — non-fatal if skipped)
    await uploadLogos(result.registered);

    // Backfill each registered account (30 days of history)
    setStep("backfilling");
    setBackfillProgress({ done: 0, total: result.registered.length });

    for (const account of result.registered) {
      try {
        await fetch("/api/meta/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_id: account.accountId, days: 30 }),
        });
      } catch {
        // Non-fatal: backfill will be retried by daily sync
      }
      setBackfillProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setStep("done");
  }

  // ─── Connect step ────────────────────────────────────────────────────────────
  if (step === "connect") {
    return (
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Conectar conta Meta</h1>
          <p className="text-sm text-muted mt-1">
            Autorize o acesso às suas contas de anúncios para começar.
          </p>
        </div>

        {oauthError && (
          <div className="flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 p-4 text-sm text-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {OAUTH_ERROR_LABELS[oauthError] ?? "Erro ao conectar. Tente novamente."}
          </div>
        )}

        <a
          href="/api/meta/oauth"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-3 px-6 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Conectar com Facebook/Meta
        </a>

        <p className="text-xs text-muted text-center">
          Você será redirecionado para o Facebook para autorizar o acesso às
          suas contas de anúncio.
        </p>

        <div className="flex flex-col items-center gap-2">
          {hasClients && (
            <button
              onClick={() => router.push("/")}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ← Voltar ao dashboard
            </button>
          )}
          {hasToken && (
            <form action="/api/meta/disconnect" method="POST">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 text-xs text-muted hover:text-danger transition-colors py-2"
              >
                <LogOut size={12} />
                Desconectar conta Meta
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─── Accounts step ───────────────────────────────────────────────────────────
  if (step === "accounts") {
    const available = accounts.filter((a) => !a.already_registered);
    const alreadyDone = accounts.filter((a) => a.already_registered);

    return (
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Selecionar contas</h1>
            {metaUser && (
              <p className="text-sm text-muted mt-1">
                Conectado como <span className="text-foreground font-medium">{metaUser}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/meta/oauth"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              <RefreshCw size={12} />
              Reconectar
            </a>
            <form action="/api/meta/disconnect" method="POST">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger transition-colors"
              >
                <LogOut size={12} />
                Desconectar
              </button>
            </form>
          </div>
        </div>

        {accountsLoading && (
          <div className="flex items-center gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" />
            Buscando contas...
          </div>
        )}

        {accountsError && (
          <div className="flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/30 p-4 text-sm text-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {accountsError}
          </div>
        )}

        {!accountsLoading && available.length === 0 && !accountsError && (
          <div className="rounded-xl border border-border p-6 text-center">
            <Unplug size={32} className="mx-auto text-muted mb-3" />
            <p className="text-sm text-muted">
              Nenhuma conta nova encontrada para esta conta Meta.
            </p>
            {alreadyDone.length > 0 && (
              <p className="text-xs text-muted mt-1">
                {alreadyDone.length}{" "}
                {alreadyDone.length === 1
                  ? "conta já está cadastrada"
                  : "contas já estão cadastradas"}.
              </p>
            )}
            <button
              onClick={() => router.push("/")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 transition-colors"
            >
              Ir para o dashboard <ArrowRight size={14} />
            </button>
          </div>
        )}

        {!accountsLoading && available.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Selecione as contas e defina um nome de exibição para cada uma.
            </p>

            {available.map((account) => {
              const isSelected = selectedNames.has(account.id);
              return (
                <div
                  key={account.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? "border-accent bg-accent/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={account.id}
                      checked={isSelected}
                      onChange={() => toggleAccount(account.id, account.name)}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label
                          htmlFor={account.id}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {account.name}
                        </label>
                        <span className="text-xs text-muted font-mono">{account.id}</span>
                        {account.account_status !== 1 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">
                            inativa
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-muted mb-1">
                              Nome no dashboard
                            </label>
                            <input
                              type="text"
                              value={selectedNames.get(account.id) ?? ""}
                              onChange={(e) => updateName(account.id, e.target.value)}
                              placeholder="Ex: Clínica Fisioprime"
                              className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted mb-1">
                              Logo (opcional)
                            </label>
                            <label
                              className="inline-flex items-center gap-2 cursor-pointer text-xs text-muted hover:text-foreground transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ImagePlus size={14} />
                              {logoFiles.has(account.id)
                                ? logoFiles.get(account.id)!.name
                                : "Escolher imagem"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handleLogoFile(account.id, e.target.files?.[0] ?? null)
                                }
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {alreadyDone.length > 0 && (
              <p className="text-xs text-muted">
                {alreadyDone.length}{" "}
                {alreadyDone.length === 1
                  ? "conta já cadastrada"
                  : "contas já cadastradas"}{" "}
                não são exibidas.
              </p>
            )}

            <button
              onClick={handleRegister}
              disabled={selectedNames.size === 0}
              className="w-full rounded-xl bg-accent hover:bg-accent/80 disabled:opacity-50 text-white font-semibold py-3 px-6 transition-colors flex items-center justify-center gap-2"
            >
              Cadastrar {selectedNames.size > 0 ? `${selectedNames.size} conta${selectedNames.size > 1 ? "s" : ""}` : "contas selecionadas"}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Registering step ────────────────────────────────────────────────────────
  if (step === "registering") {
    return (
      <div className="text-center space-y-4">
        <Loader2 size={40} className="animate-spin text-accent mx-auto" />
        <div>
          <p className="font-semibold">Cadastrando clientes...</p>
          <p className="text-sm text-muted mt-1">Aguarde um momento.</p>
        </div>
      </div>
    );
  }

  // ─── Backfilling step ────────────────────────────────────────────────────────
  if (step === "backfilling") {
    return (
      <div className="text-center space-y-4 w-full max-w-sm">
        <Loader2 size={40} className="animate-spin text-accent mx-auto" />
        <div>
          <p className="font-semibold">Carregando histórico de dados...</p>
          <p className="text-sm text-muted mt-1">
            {backfillProgress.done} de {backfillProgress.total} contas processadas
          </p>
        </div>
        <div className="w-full bg-card rounded-full h-2 border border-border">
          <div
            className="bg-accent h-2 rounded-full transition-all"
            style={{
              width:
                backfillProgress.total > 0
                  ? `${(backfillProgress.done / backfillProgress.total) * 100}%`
                  : "0%",
            }}
          />
        </div>
        <p className="text-xs text-muted">
          Buscando os últimos 30 dias de dados no Meta Ads...
        </p>
      </div>
    );
  }

  // ─── Done step ───────────────────────────────────────────────────────────────
  return (
    <div className="text-center space-y-5 w-full max-w-sm">
      <CheckCircle2 size={48} className="text-success mx-auto" />
      <div>
        <p className="text-xl font-bold">Tudo pronto!</p>
        <p className="text-sm text-muted mt-1">
          Suas contas foram cadastradas e os dados dos últimos 30 dias foram
          carregados.
        </p>
      </div>

      {skipped.length > 0 && (
        <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 text-left text-sm space-y-1">
          <p className="font-medium text-warning">Algumas contas foram ignoradas:</p>
          {skipped.map((s) => (
            <p key={s.accountId} className="text-muted text-xs">
              {s.accountId}: {s.reason}
            </p>
          ))}
        </div>
      )}

      <button
        onClick={() => router.push("/")}
        className="w-full rounded-xl bg-accent hover:bg-accent/80 text-white font-semibold py-3 px-6 transition-colors flex items-center justify-center gap-2"
      >
        Ir para o dashboard <ArrowRight size={16} />
      </button>
    </div>
  );
}
