import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenants, isAdminUser, isSuperAdminUser } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  // tenantSlug pode vir como query param para o superadmin
  const url = new URL(request.url);
  const tenantSlug =
    url.searchParams.get("tenant") ??
    (getTenants(user.app_metadata ?? {})[0] ?? null);

  if (!tenantSlug) {
    return NextResponse.json({ error: "Tenant não identificado." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: targetData, error: fetchError } = await admin.auth.admin.getUserById(userId);
  if (fetchError || !targetData.user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const target = targetData.user;
  const targetRole = target.app_metadata?.role;
  if (targetRole !== "gestor" && targetRole !== "analista") {
    return NextResponse.json({ error: "Usuário não é gestor." }, { status: 400 });
  }

  const isSuperAdmin = isSuperAdminUser(user);
  const targetTenants = getTenants(target.app_metadata ?? {});
  if (!isSuperAdmin && !targetTenants.includes(tenantSlug)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const newTenants = targetTenants.filter((t) => t !== tenantSlug);

  if (newTenants.length === 0) {
    // Sem mais tenants — remove o usuário completamente
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Ainda tem outros tenants — apenas remove este
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...target.app_metadata,
        tenant: newTenants[0],
        tenants: newTenants,
      },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
