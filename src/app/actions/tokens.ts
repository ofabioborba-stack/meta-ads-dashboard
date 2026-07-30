"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ClientToken } from "@/types";

const TOKEN_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Token opaco de 32 chars alfanuméricos com aleatoriedade criptográfica. */
function generateRandomToken(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TOKEN_CHARS.charAt(randomInt(TOKEN_CHARS.length));
  }
  return result;
}

/** Ações restritas ao painel admin — exige sessão Supabase válida. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Não autenticado");
  }
}

/** Gera um novo token para o cliente, desativando os anteriores. */
export async function generateClientToken(
  clientId: string,
  label?: string
): Promise<ClientToken> {
  await requireUser();
  const admin = createAdminClient();

  const token = generateRandomToken(32);

  const deactivate = await admin
    .from("client_tokens")
    .update({ active: false })
    .eq("client_id", clientId);
  if (deactivate.error) {
    throw new Error(`Erro ao desativar tokens anteriores: ${deactivate.error.message}`);
  }

  const { data, error } = await admin
    .from("client_tokens")
    .insert({ client_id: clientId, token, label: label ?? null })
    .select()
    .single();
  if (error) {
    throw new Error(`Erro ao criar token: ${error.message}`);
  }

  revalidatePath(`/clients/${clientId}`);
  return data as ClientToken;
}

/** Revoga (desativa) um token existente. */
export async function revokeClientToken(tokenId: string, clientId: string) {
  await requireUser();
  const admin = createAdminClient();

  const { error } = await admin
    .from("client_tokens")
    .update({ active: false })
    .eq("id", tokenId);
  if (error) {
    throw new Error(`Erro ao revogar token: ${error.message}`);
  }

  revalidatePath(`/clients/${clientId}`);
}
