"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) throw new Error("Sem permissão.");
  return user;
}

async function requireAdminOrGestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  const role = user.app_metadata?.role as string | undefined;
  if (role !== "admin" && role !== "superadmin" && role !== "gestor") throw new Error("Sem permissão.");
  return user;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  return user;
}

/**
 * Cadastra um cliente novo a partir de uma conta detectada na meta_ads_raw_data
 * que ainda não tem correspondência em client_accounts.
 */
export async function importClientFromRawData(
  clienteId: string,
  name: string,
  groupId: string | null,
  accountName: string | null
): Promise<{ clientId: string }> {
  await requireUser();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Informe um nome para o cliente.");
  if (!/^\d+$/.test(clienteId)) throw new Error("ID de conta inválido.");

  const admin = createAdminClient();
  const accountId = `act_${clienteId}`;

  const existing = await admin
    .from("client_accounts")
    .select("id")
    .eq("account_id", accountId)
    .maybeSingle();
  if (existing.data) {
    throw new Error("Esta conta já está cadastrada. Recarregue a página.");
  }

  const clientRes = await admin
    .from("clients")
    .insert({ name: trimmed, status: "active", group_id: groupId ?? null })
    .select("id")
    .single();
  if (clientRes.error) {
    throw new Error(`Erro ao criar cliente: ${clientRes.error.message}`);
  }

  const clientId: string = clientRes.data.id;

  const accountRes = await admin.from("client_accounts").insert({
    client_id: clientId,
    platform: "meta",
    account_id: accountId,
    account_name: accountName,
    alert_threshold: 200,
    funding_tax_rate: 0,
  });

  if (accountRes.error) {
    await admin.from("clients").delete().eq("id", clientId);
    throw new Error(`Erro ao criar conta vinculada: ${accountRes.error.message}`);
  }

  revalidatePath("/");
  return { clientId };
}

export interface GestorAccountInput {
  accountId: string; // "act_XXXXX"
  name: string;
  accountName: string | null;
}

export interface RegisteredAccount extends GestorAccountInput {
  clientId: string;
}

export interface GestorRegistrationResult {
  registered: RegisteredAccount[];
  skipped: Array<GestorAccountInput & { reason: string }>;
}

/**
 * Registra contas Meta selecionadas pelo gestor no onboarding.
 * Cada conta vira um cliente com owner_user_id = usuário atual.
 */
export async function registerGestorClients(
  accounts: GestorAccountInput[]
): Promise<GestorRegistrationResult> {
  const user = await requireUser();

  const role = user.app_metadata?.role;
  if (role !== "gestor" && role !== "superadmin" && role !== "admin") {
    throw new Error("Sem permissão para cadastrar contas via OAuth.");
  }

  const admin = createAdminClient();
  const registered: RegisteredAccount[] = [];
  const skipped: Array<GestorAccountInput & { reason: string }> = [];

  for (const account of accounts) {
    const trimmedName = account.name.trim();
    if (!trimmedName) {
      skipped.push({ ...account, reason: "Nome não informado." });
      continue;
    }

    // Check for duplicate
    const { data: existing } = await admin
      .from("client_accounts")
      .select("id")
      .eq("account_id", account.accountId)
      .maybeSingle();

    if (existing) {
      skipped.push({ ...account, reason: "Conta já cadastrada." });
      continue;
    }

    const { data: clientData, error: clientErr } = await admin
      .from("clients")
      .insert({
        name: trimmedName,
        status: "active",
        owner_user_id: user.id,
      })
      .select("id")
      .single();

    if (clientErr || !clientData) {
      skipped.push({
        ...account,
        reason: clientErr?.message ?? "Erro ao criar cliente.",
      });
      continue;
    }

    const { error: accountErr } = await admin.from("client_accounts").insert({
      client_id: clientData.id,
      platform: "meta",
      account_id: account.accountId,
      account_name: account.accountName,
      alert_threshold: 200,
      funding_tax_rate: 0,
      backfill_status: "pending",
    });

    if (accountErr) {
      await admin.from("clients").delete().eq("id", clientData.id);
      skipped.push({ ...account, reason: accountErr.message });
      continue;
    }

    registered.push({ ...account, clientId: clientData.id });
  }

  if (registered.length > 0) revalidatePath("/");

  return { registered, skipped };
}

/**
 * Salva a URL da planilha de leads e o WhatsApp de notificação do cliente.
 * Gestor só pode editar os próprios clientes; admin pode editar qualquer um.
 */
export interface NotificationSettings {
  sheets_leads_url: string | null;
  whatsapp_notify: string | null;
  whatsapp_notify_2: string | null;
  whatsapp_group_jid: string | null;
  notify_leads_number: boolean;
  notify_leads_group: boolean;
  notify_balance_number: boolean;
  notify_balance_group: boolean;
}

/**
 * Salva configurações de notificação do cliente.
 * Gestor só edita os próprios; admin/superadmin editam qualquer um.
 */
export async function updateClientNotificationSettings(
  clientId: string,
  data: NotificationSettings
): Promise<void> {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: client, error } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .single();

  if (error || !client) throw new Error("Cliente não encontrado.");

  const role = user.app_metadata?.role as string | undefined;
  const isAdminRole = role === "admin" || role === "superadmin";
  if (!isAdminRole) {
    const { data: membership } = await admin
      .from("client_members")
      .select("user_id")
      .eq("client_id", clientId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) throw new Error("Sem permissão para editar este cliente.");
  }

  const sheetsUrl = data.sheets_leads_url?.trim() || null;
  if (sheetsUrl && !sheetsUrl.includes("docs.google.com/spreadsheets"))
    throw new Error("URL inválida. Use um link do Google Sheets.");

  const whatsapp = data.whatsapp_notify?.replace(/\D/g, "") || null;
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15))
    throw new Error("Número inválido. Use: 5511999999999");

  const groupJid = data.whatsapp_group_jid?.trim() || null;
  if (groupJid && !groupJid.endsWith("@g.us"))
    throw new Error("JID de grupo inválido.");

  const whatsapp2 = data.whatsapp_notify_2?.replace(/\D/g, "") || null;
  if (whatsapp2 && (whatsapp2.length < 10 || whatsapp2.length > 15))
    throw new Error("Número 2 inválido. Use: 5511999999999");

  const { error: updateError } = await admin
    .from("clients")
    .update({
      sheets_leads_url:    sheetsUrl,
      whatsapp_notify:     whatsapp,
      whatsapp_notify_2:   whatsapp2,
      whatsapp_group_jid:  groupJid,
      notify_leads_number:   data.notify_leads_number,
      notify_leads_group:    data.notify_leads_group,
      notify_balance_number: data.notify_balance_number,
      notify_balance_group:  data.notify_balance_group,
    })
    .eq("id", clientId);

  if (updateError) throw new Error(updateError.message);
  revalidatePath(`/clients/${clientId}`);
}

/**
 * Ativa um cliente a partir de uma conta do Business Manager da Kiwi.
 * Cria client + client_account e marca para backfill retroativo de 30 dias.
 */
export async function activateBMClient(
  accountId: string,       // ID numérico do Meta (sem 'act_')
  accountName: string | null,
  name: string,
  groupId: string,         // obrigatório — vincula o cliente ao tenant via grupo
  ownerId: string | null,  // gestor responsável (opcional)
  backfillDays: number,    // 0 = sem histórico, 1-60 = dias a retroagir
): Promise<{ clientId: string }> {
  await requireAdminOrGestor();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Informe um nome para o cliente.");
  if (!groupId) throw new Error("Selecione um grupo.");
  const days = Math.min(Math.max(Math.floor(backfillDays), 0), 60);

  const fullAccountId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("client_accounts")
    .select("id")
    .eq("account_id", fullAccountId)
    .maybeSingle();
  if (existing) throw new Error("Esta conta já está cadastrada.");

  const { data: clientData, error: clientErr } = await admin
    .from("clients")
    .insert({
      name: trimmed,
      status: "active",
      group_id: groupId,
      owner_user_id: ownerId ?? null,
    })
    .select("id")
    .single();

  if (clientErr || !clientData) throw new Error(clientErr?.message ?? "Erro ao criar cliente.");

  let backfillStatus: "pending" | "done" = "done";
  let backfillFrom: string | null = null;

  if (days > 0) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    backfillStatus = "pending";
    backfillFrom = from.toISOString().split("T")[0];
  }

  const { error: accountErr } = await admin.from("client_accounts").insert({
    client_id: clientData.id,
    platform: "meta",
    account_id: fullAccountId,
    account_name: accountName,
    alert_threshold: 200,
    funding_tax_rate: 0,
    backfill_status: backfillStatus,
    backfill_from: backfillFrom,
  });

  if (accountErr) {
    await admin.from("clients").delete().eq("id", clientData.id);
    throw new Error(accountErr.message);
  }

  if (ownerId) {
    await admin.from("client_members").insert({ client_id: clientData.id, user_id: ownerId });
  }

  revalidatePath("/admin/contas");
  revalidatePath("/");
  return { clientId: clientData.id };
}

/**
 * Atualiza o gestor responsável de um cliente.
 * ownerId = null remove o gestor.
 */
export async function updateClientOwner(
  clientId: string,
  ownerId: string | null,
): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("clients")
    .update({ owner_user_id: ownerId })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contas");
}

/**
 * Remove o cliente da visualização do dashboard (soft delete).
 * Os dados históricos são preservados.
 */
export async function deactivateClient(clientId: string): Promise<void> {
  await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin
    .from("clients")
    .update({ status: "inactive" })
    .eq("id", clientId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/contas");
  revalidatePath("/");
}

export async function reactivateClient(clientId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("clients")
    .update({ status: "active" })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contas");
  revalidatePath("/");
}

export interface SocialAccountInfo {
  id: string;
  platform_account_id: string;
  account_name: string | null;
  is_active: boolean;
}

export async function addClientMember(clientId: string, userId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("client_members").insert({ client_id: clientId, user_id: userId });
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath("/admin/contas");
}

export async function removeClientMember(clientId: string, userId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("client_members").delete().eq("client_id", clientId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contas");
}

export async function renameClient(clientId: string, name: string): Promise<void> {
  await requireAdminOrGestor();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nome não pode ser vazio.");
  if (trimmed.length > 100) throw new Error("Nome muito longo (máx. 100 caracteres).");
  const admin = createAdminClient();
  const { error } = await admin.from("clients").update({ name: trimmed }).eq("id", clientId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contas");
  revalidatePath("/");
}

export async function getClientSocialAccount(clientId: string): Promise<SocialAccountInfo | null> {
  await requireUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from("social_accounts")
    .select("id, platform_account_id, account_name, is_active")
    .eq("client_id", clientId)
    .eq("platform", "instagram")
    .maybeSingle();
  return data ?? null;
}

export async function setSocialAccountActive(accountId: string, isActive: boolean): Promise<void> {
  await requireUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("social_accounts")
    .update({ is_active: isActive })
    .eq("id", accountId);
  if (error) throw new Error(error.message);
}
