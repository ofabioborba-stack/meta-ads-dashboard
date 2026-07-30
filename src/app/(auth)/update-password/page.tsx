"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError("Erro ao atualizar a senha. O link pode ter expirado.");
    } else {
      setDone(true);
      setTimeout(() => { window.location.assign("/"); }, 1500);
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-6">Nova senha</h1>
        {done ? (
          <div className="rounded-xl bg-card border border-border p-6 text-center">
            <p className="text-sm text-success font-medium">Senha atualizada! Redirecionando...</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl bg-card border border-border p-6 space-y-4"
          >
            <div>
              <label htmlFor="password" className="block text-sm text-muted mb-1">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm text-muted mb-1">
                Confirmar senha
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent text-white font-medium py-2.5 hover:bg-accent/80 disabled:opacity-50 transition-colors"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
