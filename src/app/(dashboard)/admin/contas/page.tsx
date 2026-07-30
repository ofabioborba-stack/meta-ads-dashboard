import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant";
import { isAdminUser, isGestorUser } from "@/lib/auth";
import { listTenantGestores } from "@/app/actions/users";
import ContasPanel from "@/components/ContasPanel";

export const metadata = { title: "Contas Meta" };

interface BMAccount {
  id: string;
  name: string;
  account_status: number;
}

export default async function ContasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminUser(user) && !isGestorUser(user)) redirect("/");
  const isAdmin = isAdminUser(user);

  const tenant = await getTenant();
  const admin = createAdminClient();

  // Grupos deste tenant (necessário para vincular novos clientes)
  const { data: groups } = await admin
    .from("groups")
    .select("id, name, color")
    .eq("tenant_id", tenant.id)
    .order("name");

  // Gestores deste tenant (para o select de responsável)
  // Inclui o usuário logado (admin/superadmin) mesmo que não tenha role "gestor"
  const gestores = await listTenantGestores(tenant.slug);
  const gestoresComAdmin = gestores.some((g) => g.id === user.id)
    ? gestores
    : [
        {
          id: user.id,
          email: user.email ?? "",
          name: (user.user_metadata?.full_name as string | null) ?? null,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at ?? null,
          pending: false,
        },
        ...gestores,
      ];

  // Clientes deste tenant (via grupos) — ativos e inativos separados
  const groupIds = (groups ?? []).map((g) => g.id);
  const [{ data: tenantClients }, { data: inactiveTenantClients }] = groupIds.length > 0
    ? await Promise.all([
        admin
          .from("clients")
          .select("id, name, owner_user_id, status, group_id, client_accounts(account_id, account_name), client_members(user_id)")
          .in("group_id", groupIds)
          .neq("status", "inactive")
          .order("name"),
        admin
          .from("clients")
          .select("id, name, owner_user_id, status, group_id, client_accounts(account_id, account_name), client_members(user_id)")
          .in("group_id", groupIds)
          .eq("status", "inactive")
          .order("name"),
      ])
    : [{ data: [] }, { data: [] }];

  // Conjunto de account_ids já cadastrados em QUALQUER tenant (formato act_XXXX)
  // Evita mostrar como "nova" uma conta que já existe sob outro tenant/grupo
  const { data: allRegisteredAccounts } = await admin
    .from("client_accounts")
    .select("account_id");

  const registeredAccountIds = new Set(
    (allRegisteredAccounts ?? []).map((ca) => ca.account_id)
  );

  // Busca contas do BM na Meta API — parceiras (client_ad_accounts) + próprias (owned_ad_accounts)
  let bmAccounts: BMAccount[] = [];
  let bmError: string | null = null;

  if (!tenant.meta_bm_id || !tenant.meta_access_token) {
    bmError = "Configure o BM ID e o token de acesso do tenant para ver as contas Meta.";
  } else {
    try {
      const makeUrl = (endpoint: string) => {
        const u = new URL(`https://graph.facebook.com/v23.0/${tenant.meta_bm_id}/${endpoint}`);
        u.searchParams.set("fields", "id,name,account_status");
        u.searchParams.set("limit", "200");
        u.searchParams.set("access_token", tenant.meta_access_token!);
        return u.toString();
      };

      const [clientRes, ownedRes] = await Promise.all([
        fetch(makeUrl("client_ad_accounts"), { next: { revalidate: 300 } }),
        fetch(makeUrl("owned_ad_accounts"),  { next: { revalidate: 300 } }),
      ]);

      const [clientJson, ownedJson] = await Promise.all([
        clientRes.json() as Promise<{ data?: BMAccount[]; error?: { message: string } }>,
        ownedRes.json()  as Promise<{ data?: BMAccount[]; error?: { message: string } }>,
      ]);

      if (clientJson.error && ownedJson.error) {
        bmError = clientJson.error.message;
      } else {
        // Junta as duas listas removendo duplicatas por id
        const seen = new Set<string>();
        for (const acc of [...(clientJson.data ?? []), ...(ownedJson.data ?? [])]) {
          if (!seen.has(acc.id)) { seen.add(acc.id); bmAccounts.push(acc); }
        }
      }
    } catch {
      bmError = "Erro ao conectar com a Meta API.";
    }
  }

  // Separa novas (não cadastradas) das que já estão no dashboard
  const newAccounts = bmAccounts.filter(
    (acc) => !registeredAccountIds.has(acc.id)
  );

  // Formata listas com info do gestor / grupo
  const gestorMap = new Map(gestoresComAdmin.map((g) => [g.id, g.email]));
  const groupMap = new Map((groups ?? []).map((g) => [g.id, g.name]));

  const formatClients = (rows: typeof tenantClients) =>
    (rows ?? []).map((c) => {
      const firstAccount = (c.client_accounts as { account_id: string; account_name: string | null }[])[0] ?? null;
      const memberIds = (c.client_members as { user_id: string }[] | null ?? []).map((m) => m.user_id);
      return {
        id: c.id,
        name: c.name,
        account_id: firstAccount?.account_id ?? "—",
        account_name: firstAccount?.account_name ?? null,
        owner_user_id: c.owner_user_id ?? null,
        owner_email: c.owner_user_id ? (gestorMap.get(c.owner_user_id) ?? null) : null,
        group_name: c.group_id ? (groupMap.get(c.group_id) ?? null) : null,
        member_ids: memberIds,
        member_emails: memberIds.map((uid) => gestorMap.get(uid) ?? uid),
      };
    });

  const activeClients = formatClients(tenantClients);
  const inactiveClients = formatClients(inactiveTenantClients);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Contas Meta</h1>
        <p className="text-sm text-muted mt-1">
          Contas do Business Manager — ative, gerencie e reative clientes.
        </p>
      </div>

      <ContasPanel
        newAccounts={newAccounts}
        activeClients={activeClients}
        inactiveClients={inactiveClients}
        gestores={gestoresComAdmin}
        groups={groups ?? []}
        bmError={bmError}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />
    </div>
  );
}
