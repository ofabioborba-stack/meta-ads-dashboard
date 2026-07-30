import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import { isAdminUser } from "@/lib/auth";
import { listTenantGestores } from "@/app/actions/users";
import GestoresPanel from "@/components/GestoresPanel";

export const metadata = { title: "Gestores" };

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminUser(user)) redirect("/");

  const tenant = await getTenant();
  const gestores = await listTenantGestores(tenant.slug);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Gestores</h1>
        <p className="text-sm text-muted mt-1">
          Convide gestores para acessar o dashboard e gerenciar seus próprios clientes.
        </p>
      </div>
      <GestoresPanel gestores={gestores} tenantSlug={tenant.slug} />
    </div>
  );
}
