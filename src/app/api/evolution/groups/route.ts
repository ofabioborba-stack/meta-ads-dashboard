import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import { listGroups } from "@/lib/evolution";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const tenant = await getTenant();
  const instance = tenant.evolution_instance ?? process.env.EVOLUTION_INSTANCE;
  const apiKey   = tenant.evolution_api_key  ?? process.env.EVOLUTION_API_KEY;

  if (!instance || !apiKey) {
    return NextResponse.json({ error: "Evolution não configurado para este tenant" }, { status: 503 });
  }

  try {
    const groups = await listGroups(instance, apiKey);
    return NextResponse.json(groups);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar grupos" },
      { status: 500 }
    );
  }
}
