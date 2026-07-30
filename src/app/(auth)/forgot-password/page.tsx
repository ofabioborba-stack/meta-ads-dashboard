"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    if (err) {
      setError("Erro ao enviar e-mail. Verifique o endereço e tente novamente.");
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-6">Redefinir senha</h1>
        {sent ? (
          <div className="rounded-xl bg-card border border-border p-6 text-center space-y-3">
            <p className="text-sm text-success font-medium">E-mail enviado!</p>
            <p className="text-sm text-muted">
              Verifique sua caixa de entrada e clique no link para definir uma nova senha.
            </p>
            <a href="/login" className="block text-sm text-accent hover:underline mt-2">
              Voltar para o login
            </a>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl bg-card border border-border p-6 space-y-4"
          >
            <p className="text-sm text-muted">
              Digite seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
            <div>
              <label htmlFor="email" className="block text-sm text-muted mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent text-white font-medium py-2.5 hover:bg-accent/80 disabled:opacity-50 transition-colors"
            >
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>
            <a
              href="/login"
              className="block text-center text-sm text-muted hover:text-white transition-colors"
            >
              Voltar para o login
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
