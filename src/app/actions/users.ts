"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenants, isAdminUser, isSuperAdminUser } from "@/lib/auth";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) throw new Error("Sem permissão.");
  return user;
}

export async function inviteGestor(
  email: string,
  tenantSlug: string,
  siteOrigin: string
): Promise<{ email: string }> {
  const currentUser = await requireAdmin();
  const isSuperAdmin = isSuperAdminUser(currentUser);

  if (!isSuperAdmin && !getTenants(currentUser.app_metadata ?? {}).includes(tenantSlug)) {
    throw new Error("Sem permissão para convidar neste tenant.");
  }

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("E-mail inválido.");
  }

  const admin = createAdminClient();
  const redirectTo = `${siteOrigin}/auth/callback?next=/admin/contas`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(trimmed, {
    redirectTo,
  });

  if (error) {
    if (error.message.includes("rate limit") || error.status === 429) {
      throw new Error("Limite de e-mails atingido. O Supabase permite apenas 2 convites por hora no plano gratuito. Aguarde alguns minutos e tente novamente.");
    }
    throw new Error(error.message);
  }

  // inviteUserByEmail salva data em user_metadata; app_metadata precisa de updateUserById
  const { error: updateErr } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: "gestor", tenant: tenantSlug },
  });
  if (updateErr) throw new Error(updateErr.message);

  // Não chama revalidatePath: o cliente já atualiza a lista otimisticamente
  return { email: data.user.email ?? trimmed };
}

export interface GestorUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastSignIn: string | null;
  pending: boolean;
}

export async function listTenantGestores(tenantSlug: string): Promise<GestorUser[]> {
  const currentUser = await requireAdmin();
  const isSuperAdmin = isSuperAdminUser(currentUser);

  if (!isSuperAdmin && currentUser.app_metadata?.tenant !== tenantSlug) {
    throw new Error("Sem permissão.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);

  return data.users
    .filter(
      (u) =>
        (u.app_metadata?.role === "gestor" || u.app_metadata?.role === "analista") &&
        getTenants(u.app_metadata ?? {}).includes(tenantSlug)
    )
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.full_name as string | null) ?? null,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      pending: !u.last_sign_in_at,
    }));
}

export async function removeGestor(userId: string): Promise<void> {
  const currentUser = await requireAdmin();
  const isSuperAdmin = isSuperAdminUser(currentUser);

  const admin = createAdminClient();
  const { data: targetData, error: fetchError } = await admin.auth.admin.getUserById(userId);
  if (fetchError || !targetData.user) throw new Error("Usuário não encontrado.");

  const target = targetData.user;
  const targetRole = target.app_metadata?.role;
  if (targetRole !== "gestor" && targetRole !== "analista") throw new Error("Usuário não é gestor.");

  const callerTenant = getTenants(currentUser.app_metadata ?? {})[0] ?? "";
  const targetTenants = getTenants(target.app_metadata ?? {});
  if (!isSuperAdmin && !targetTenants.includes(callerTenant)) {
    throw new Error("Sem permissão.");
  }

  const newTenants = targetTenants.filter((t) => t !== callerTenant);
  const { error } = newTenants.length === 0
    ? await admin.auth.admin.deleteUser(userId)
    : await admin.auth.admin.updateUserById(userId, {
        app_metadata: { ...target.app_metadata, tenant: newTenants[0], tenants: newTenants },
      });

  if (error) throw new Error(error.message);
}
