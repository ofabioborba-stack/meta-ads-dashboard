import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripActPrefix } from "@/lib/utils";
import type { LeadStatus } from "@/types";

const VALID_STATUSES: LeadStatus[] = [
  "CREATED",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Acesso via link compartilhável: o token precisa estar ativo, não expirado
 * e o lead precisa pertencer ao cliente do token — nunca a outro cliente.
 */
async function canAccessLeadByToken(
  admin: ReturnType<typeof createAdminClient>,
  token: string,
  leadId: string
): Promise<boolean> {
  const { data: tokenRow } = await admin
    .from("client_tokens")
    .select("client_id, expires_at")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (!tokenRow) return false;
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return false;

  const [{ data: accounts }, { data: lead }] = await Promise.all([
    admin
      .from("client_accounts")
      .select("account_id")
      .eq("client_id", tokenRow.client_id),
    admin.from("leads").select("cliente_id").eq("id", leadId).maybeSingle(),
  ]);

  if (!lead?.cliente_id || !accounts?.length) return false;
  return accounts.some((a) => stripActPrefix(a.account_id) === lead.cliente_id);
}

/** Atualiza o lead_status de um lead pelo id (UUID do Supabase). */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();

    if (!user) {
      const token = new URL(request.url).searchParams.get("token");
      const allowed = token ? await canAccessLeadByToken(admin, token, id) : false;
      if (!allowed) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }
    }

    const body = (await request.json()) as { lead_status?: string };
    const status = body.lead_status as LeadStatus | undefined;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `lead_status inválido. Use: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from("leads")
      .update({ lead_status: status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // TODO: sincronizar o novo status de volta ao Google Sheets via webhook n8n (fase 2)

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
}
