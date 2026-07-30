"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, Trash2, Loader2, UserPlus, Clock, CheckCircle2, X } from "lucide-react";
import type { GestorUser } from "@/app/actions/users";

interface Props {
  gestores: GestorUser[];
  tenantSlug: string;
}

function generatePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => chars[b % chars.length])
    .join("");
}

export default function GestoresPanel({ gestores, tenantSlug }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [list, setList] = useState<GestorUser[]>(gestores);
  const [resetTarget, setResetTarget] = useState<GestorUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setInviting(true);

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, tenantSlug }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error ?? "Erro ao criar acesso.");
        return;
      }
      setInviteSuccess(
        json.existing
          ? `${json.email} já tem conta — acesso ao dashboard liberado. Não é necessário nova senha.`
          : `Acesso criado para ${json.email}. Compartilhe a senha com o gestor.`
      );
      setEmail("");
      setPassword(generatePassword());
      setList((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          email: json.email,
          name: null,
          createdAt: new Date().toISOString(),
          lastSignIn: null,
          pending: true,
        },
      ]);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Erro ao criar acesso.");
    } finally {
      setInviting(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetSaving(true);
    setResetError(null);
    setResetSuccess(false);
    try {
      const res = await fetch(`/api/admin/gestores/${resetTarget.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const json = await res.json();
      if (!res.ok) { setResetError(json.error ?? "Erro ao redefinir senha."); return; }
      setResetSuccess(true);
      setTimeout(() => { setResetTarget(null); setResetPassword(""); setResetSuccess(false); }, 1500);
    } catch {
      setResetError("Erro ao redefinir senha.");
    } finally {
      setResetSaving(false);
    }
  }

  async function handleRemove(userId: string, userEmail: string) {
    if (!confirm(`Remover o acesso de ${userEmail} deste dashboard?`)) return;
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/admin/gestores/${userId}?tenant=${encodeURIComponent(tenantSlug)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Erro ao remover gestor.");
        return;
      }
      setList((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      alert("Erro ao remover gestor.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Invite form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-accent" />
          Convidar gestor
        </h2>
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com.br"
              required
              className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha temporária"
                required
                minLength={6}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 pr-9 text-sm font-mono focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { const p = generatePassword(); setPassword(p); setShowPassword(true); }}
              className="p-2 rounded-lg border border-border text-muted hover:text-white transition-colors"
              title="Gerar nova senha"
            >
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(password);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`p-2 rounded-lg border transition-colors ${copied ? "border-success text-success" : "border-border text-muted hover:text-white"}`}
              title="Copiar senha"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              type="submit"
              disabled={inviting || !email.trim() || password.length < 6}
              className="inline-flex items-center gap-2 rounded-lg bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {inviting ? "Criando..." : "Criar acesso"}
            </button>
          </div>
        </form>

        {inviteSuccess && (
          <p className="mt-3 text-sm text-success flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            {inviteSuccess}
          </p>
        )}
        {inviteError && (
          <p className="mt-3 text-sm text-danger">{inviteError}</p>
        )}
        <p className="mt-3 text-xs text-muted">
          A senha é gerada automaticamente. Copie e envie para o gestor. Ele pode alterá-la depois em "Esqueceu a senha".
        </p>
      </div>

      {/* Gestores list */}
      <div>
        <h2 className="text-base font-semibold mb-4">
          Gestores ativos · {list.length}
        </h2>

        {list.length === 0 ? (
          <p className="text-sm text-muted">Nenhum gestor cadastrado ainda.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Último acesso</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((u) => (
                  <tr key={u.id} className="bg-background hover:bg-card/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium">{u.email}</span>
                      {u.name && (
                        <span className="text-muted ml-2 text-xs">({u.name})</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.pending ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                          <Clock size={10} />
                          Convite pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">
                          <CheckCircle2 size={10} />
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {u.lastSignIn
                        ? new Date(u.lastSignIn).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          onClick={() => { setResetTarget(u); setResetPassword(generatePassword()); setResetError(null); setResetSuccess(false); }}
                          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
                        >
                          <KeyRound size={12} />
                          Senha
                        </button>
                        <button
                          onClick={() => handleRemove(u.id, u.email)}
                          disabled={removingId === u.id}
                          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger disabled:opacity-50 transition-colors"
                        >
                          {removingId === u.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal redefinir senha */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Redefinir senha — {resetTarget.email}</h3>
              <button onClick={() => setResetTarget(null)} className="text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>
            {resetSuccess ? (
              <p className="text-sm text-success flex items-center gap-1.5"><CheckCircle2 size={14} /> Senha redefinida!</p>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                    minLength={6}
                    className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
                  />
                  <button type="button" onClick={() => setResetPassword(generatePassword())}
                    className="p-2 rounded-lg border border-border text-muted hover:text-white transition-colors" title="Gerar">
                    <RefreshCw size={14} />
                  </button>
                  <button type="button" onClick={() => navigator.clipboard.writeText(resetPassword)}
                    className="p-2 rounded-lg border border-border text-muted hover:text-white transition-colors" title="Copiar">
                    <Copy size={14} />
                  </button>
                </div>
                {resetError && <p className="text-sm text-danger">{resetError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setResetTarget(null)}
                    className="px-3 py-2 text-sm text-muted hover:text-white transition-colors">Cancelar</button>
                  <button type="submit" disabled={resetSaving || resetPassword.length < 6}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-colors">
                    {resetSaving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    {resetSaving ? "Salvando..." : "Salvar senha"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
