import { createAdminClient } from "@/lib/supabase/admin";
import { stripActPrefix } from "@/lib/utils";

/**
 * Saldo por controle manual de recarga: valor carregado menos o gasto
 * acumulado desde a data da recarga (meta_ads_raw_data, sincronizado
 * diariamente — o saldo pode ter até 1 dia de defasagem), acrescido do
 * imposto que o Meta repassa sobre o gasto (taxRate em %, ex.: ISS).
 */
export async function manualBalance(
  metaAccountId: string,
  fundingAmount: number,
  fundingDate: string,
  taxRate = 0
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meta_ads_raw_data")
    .select("custo_total")
    .eq("cliente_id", stripActPrefix(metaAccountId))
    .gte("data", fundingDate);

  if (error) {
    throw new Error(`Erro ao somar gasto desde ${fundingDate}: ${error.message}`);
  }

  const spent = (data ?? []).reduce(
    (sum, row) => sum + Number((row as { custo_total: number | string }).custo_total ?? 0),
    0
  );
  return Number((fundingAmount - spent * (1 + taxRate / 100)).toFixed(2));
}
