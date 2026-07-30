import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenants, isAdminUser, isSuperAdminUser } from "@/lib/auth";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  let body: { email?: string; password?: string; tenantSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const { email, password, tenantSlug } = body;

  const isSuperAdmin = isSuperAdminUser(user);
  if (!isSuperAdmin && !getTenants(user.app_metadata ?? {}).includes(tenantSlug ?? "")) {
    return NextResponse.json(
      { error: "Sem permissão para convidar neste tenant." },
      { status: 403 }
    );
  }

  const trimmed = email?.trim().toLowerCase() ?? "";
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  if (!tenantSlug) {
    return NextResponse.json({ error: "Parâmetros faltando." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verifica se o usuário já existe no Supabase Auth
  const { data: allUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = allUsers?.users.find((u) => u.email?.toLowerCase() === trimmed);

  if (existing) {
    // Usuário já existe — apenas adiciona o tenant ao array dele
    const currentTenants = getTenants(existing.app_metadata ?? {});
    if (!currentTenants.includes(tenantSlug)) {
      const newTenants = [...currentTenants, tenantSlug];
      const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
        app_metadata: {
          ...existing.app_metadata,
          role: existing.app_metadata?.role ?? "gestor",
          tenant: newTenants[0],
          tenants: newTenants,
        },
      });
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }
    }
    return NextResponse.json({ email: existing.email ?? trimmed, existing: true });
  }

  // Usuário novo — cria com senha
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Senha deve ter ao menos 6 caracteres." }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: trimmed,
    password,
    email_confirm: true,
    app_metadata: { role: "gestor", tenant: tenantSlug, tenants: [tenantSlug] },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ email: data.user.email ?? trimmed, existing: false });
}
