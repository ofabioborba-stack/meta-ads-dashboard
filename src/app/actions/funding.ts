"use server";

import { revalidatePath } from "next/cache";
import { manualBalance } from "@/lib/funding";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Ações restritas ao painel — exige sessão Supabase válida. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Não autenticado");
  }
}

/**
 * Registra (ou remove, passando nulls) a recarga manual de uma conta cujo
 * saldo a Meta API não expõe, e recalcula o saldo imediatamente. O sync
 * diário mantém o valor atualizado conforme o gasto acumula.
 */
export async function updateAccountFunding(
  accountId: string,
  clientId: string,
  amount: number | null,
  date: string | null,
  taxRate = 0
): Promise<void> {
  await requireUser();

  const hasFunding = amount !== null && date !== null;
  if ((amount === null) !== (date === null)) {
    throw new Error("Informe o valor e a data da recarga.");
  }
  if (hasFunding && (!Number.isFinite(amount) || amount <= 0)) {
    throw new Error("Valor de recarga inválido.");
  }
  if (hasFunding && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Data de recarga inválida.");
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 30) {
    throw new Error("Imposto inválido (use um percentual entre 0 e 30).");
  }

  const admin = createAdminClient();

  const accountRes = await admin
    .from("client_accounts")
    .select("id, account_id")
    .eq("id", accountId)
    .single();
  if (accountRes.error || !accountRes.data) {
    throw new Error("Conta não encontrada.");
  }

  const update = await admin
    .from("client_accounts")
    .update({ funding_amount: amount, funding_date: date, funding_tax_rate: taxRate })
    .eq("id", accountId);
  if (update.error) {
    throw new Error(`Erro ao salvar recarga: ${update.error.message}`);
  }

  const balanceRow: {
    account_id: string;
    balance: number | null;
    is_prepaid: boolean;
    updated_at: string;
  } = hasFunding
    ? {
        account_id: accountId,
        balance: await manualBalance(accountRes.data.account_id, amount, date, taxRate),
        is_prepaid: true,
        updated_at: new Date().toISOString(),
      }
    : {
        // Sem recarga registrada, volta ao estado pós-paga (sem saldo)
        account_id: accountId,
        balance: null,
        is_prepaid: false,
        updated_at: new Date().toISOString(),
      };

  const upsert = await admin
    .from("account_balance")
    .upsert(balanceRow, { onConflict: "account_id" });
  if (upsert.error) {
    throw new Error(`Erro ao atualizar saldo: ${upsert.error.message}`);
  }

  revalidatePath(`/clients/${clientId}`);
}
