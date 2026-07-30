"use client";

import { useState } from "react";
import { KeyRound, Loader2, X, CheckCircle2 } from "lucide-react";

export default function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao alterar senha.");
    } else {
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setPassword(""); setConfirm(""); }, 1500);
    }
    setSaving(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
      >
        <KeyRound size={13} />
        Alterar senha
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Alterar senha</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>
            {done ? (
              <p className="text-sm text-success flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Senha alterada com sucesso!
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Nova senha</label>
                  <input type="password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Confirmar senha</label>
                  <input type="password" required value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent" />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)}
                    className="px-3 py-2 text-sm text-muted hover:text-white transition-colors">Cancelar</button>
                  <button type="submit" disabled={saving || password.length < 6}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-colors">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
