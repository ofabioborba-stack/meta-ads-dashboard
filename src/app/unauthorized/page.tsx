import { ShieldOff } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { getTenant } from "@/lib/tenant";

/** Usuário autenticado sem vínculo com o tenant deste subdomínio. */
export default async function UnauthorizedPage() {
  const tenant = await getTenant();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="rounded-xl bg-card border border-border p-8 max-w-sm text-center space-y-4">
        <ShieldOff size={32} className="mx-auto text-danger" />
        <div>
          <h1 className="text-lg font-semibold mb-1">Acesso não autorizado</h1>
          <p className="text-sm text-muted">
            Sua conta não tem acesso ao painel {tenant.name}. Acesse pelo
            endereço do seu painel ou fale com o administrador.
          </p>
        </div>
        <div className="flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
