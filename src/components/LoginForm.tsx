"use client";

import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  tenantName: string;
  tenantLogoUrl: string | null;
}

export default function LoginForm({ tenantName, tenantLogoUrl }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("Email ou senha inválidos.");
        setLoading(false);
        return;
      }

      // Navegação completa: router.push("/") reutiliza o payload RSC
      // prefetchado antes do login (um redirect para /login), criando a
      // sensação de que nada aconteceu. O reload garante que o proxy veja
      // os cookies de sessão recém-gravados.
      window.location.assign("/");
    } catch (err) {
      console.error("[login] erro inesperado:", err);
      setError("Erro ao conectar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogoUrl}
              alt={tenantName}
              className="h-12 w-auto"
              style={{ maxHeight: 48 }}
            />
          ) : (
            <>
              <BarChart3 size={26} className="text-accent" />
              <h1 className="text-xl font-bold">{tenantName}</h1>
            </>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-card border border-border p-6 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-sm text-muted mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-background border border-border px-3 py-2 focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm text-muted">
                Senha
              </label>
              <a
                href="/forgot-password"
                className="text-xs text-muted hover:text-accent transition-colors"
              >
                Esqueceu a senha?
              </a>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-background border border-border px-3 py-2 focus:outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent text-white font-medium py-2.5 hover:bg-accent/80 disabled:opacity-50 transition-colors"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
