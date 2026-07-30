import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id obrigatório." }, { status: 400 });
  }

  const clienteId = accountId.replace("act_", "");
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("meta_ads_raw_data")
    .delete({ count: "exact" })
    .eq("cliente_id", clienteId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: count, cliente_id: clienteId });
}
