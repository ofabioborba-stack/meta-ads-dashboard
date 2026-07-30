import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser, isSuperAdminUser } from "@/lib/auth";

export async function PATCH(
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

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const { password } = body;
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Senha deve ter ao menos 6 caracteres." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: targetData, error: fetchError } = await admin.auth.admin.getUserById(userId);
  if (fetchError || !targetData.user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const target = targetData.user;
  if (target.app_metadata?.role !== "gestor") {
    return NextResponse.json({ error: "Usuário não é gestor." }, { status: 400 });
  }

  const isSuperAdmin = isSuperAdminUser(user);
  if (!isSuperAdmin && target.app_metadata?.tenant !== user.app_metadata?.tenant) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
