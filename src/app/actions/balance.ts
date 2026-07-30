"use server";

import { isAdminUser, isGestorUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountBalance } from "@/lib/meta/api";
import { manualBalance } from "@/lib/funding";

export async function syncBalance(): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAdminUser(user) && !isGestorUser(user)) {
    return { error: "Não autorizado" };
  }

  const admin = createAdminClient();

  const { data: accounts, error } = await admin
    .from("client_accounts")
    .select("id, account_id, funding_amount, funding_date, funding_tax_rate, client:clients!inner(owner_user_id)")
    .eq("platform", "meta");

  if (error) return { error: error.message };

  const ownerIds = [
    ...new Set(
      (accounts ?? [])
        .map((a) => (a.client as unknown as { owner_user_id: string | null }).owner_user_id)
        .filter(Boolean) as string[]
    ),
  ];

  const tokenMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: tokens } = await admin
      .from("user_meta_tokens")
      .select("user_id, access_token, expires_at")
      .in("user_id", ownerIds);
    for (const t of tokens ?? []) {
      const exp = t.expires_at ? new Date(t.expires_at) : null;
      if (!exp || exp > new Date()) tokenMap.set(t.user_id, t.access_token);
    }
  }

  type AccountRow = NonNullable<typeof accounts>[0];

  for (const account of (accounts ?? []) as AccountRow[]) {
    const ownerId = (account.client as unknown as { owner_user_id: string | null }).owner_user_id;
    const overrideToken = ownerId ? tokenMap.get(ownerId) : undefined;
    if (ownerId && !overrideToken) continue;

    try {
      let { balance, currency, isPrepaid } = await getAccountBalance(account.account_id, overrideToken);

      if (!isPrepaid && account.funding_amount != null && account.funding_date) {
        balance = await manualBalance(
          account.account_id,
          Number(account.funding_amount),
          account.funding_date,
          Number(account.funding_tax_rate ?? 0)
        );
        isPrepaid = true;
      }

      await admin.from("account_balance").upsert(
        { account_id: account.id, balance, currency, is_prepaid: isPrepaid, updated_at: new Date().toISOString() },
        { onConflict: "account_id" }
      );
    } catch {
      // non-critical per account — continue
    }
  }
}
