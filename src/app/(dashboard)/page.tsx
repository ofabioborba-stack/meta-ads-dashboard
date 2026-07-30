import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import { isAdminTenant } from "@/lib/tenant-slug";
import { isAdminUser, isGestorUser, isSuperAdminUser } from "@/lib/auth";
import ImportClientsPanel from "@/components/ImportClientsPanel";
import type { UnlinkedAccount } from "@/components/ImportClientsPanel";
import { periodDateRange, stripActPrefix } from "@/lib/utils";
import { EMPTY_METRIC_SUMS } from "@/lib/metrics";
import type {
  AccountBalance,
  Client,
  ClientAccount,
  ClientWithData,
  Group,
  MetricSums,
} from "@/types";
import DashboardView from "@/components/DashboardView";

type ClientRow = Client & {
  client_accounts: (ClientAccount & { account_balance: AccountBalance | null })[];
  client_members?: { user_id: string }[] | null;
};

type DashboardMetricsRow = {
  cliente_id: string;
  cliques: number;
  leads: number;
  mensagens: number;
  resultados: number;
  impressoes: number;
  alcance: number;
  profile_visits: number;
  custo: number | string;
  custo_por_lead: number | string | null;
  custo_por_mensagem: number | string | null;
};

export default async function HomePage() {
  const supabase = await createClient();
  const tenant = await getTenant();
  const isAdmin = isAdminTenant(tenant.slug);
  const range = periodDateRange("7d");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isGestor = isGestorUser(user);
  const isSuperAdmin = isSuperAdminUser(user);
  const onAdminDomain = isAdminTenant(tenant.slug); // dash.fabioborba.com.br

  let clientsQuery;
  if (isGestor) {
    // Gestor vê clientes onde é membro (client_members)
    clientsQuery = supabase
      .from("clients")
      .select("*, group:groups(*), client_accounts(*, account_balance(*)), client_members!inner(user_id)")
      .eq("client_members.user_id", user!.id)
      .neq("status", "inactive")
      .order("name");
  } else if (isSuperAdmin && onAdminDomain) {
    // Superadmin no domínio admin — vê todos os clientes de todos os tenants
    clientsQuery = supabase
      .from("clients")
      .select("*, group:groups(*), client_accounts(*, account_balance(*))")
      .order("name");
  } else {
    // Admin de tenant OU superadmin em domínio de tenant (kiwilab, aaldeia…)
    // Filtra pelo tenant atual via grupo
    clientsQuery = supabase
      .from("clients")
      .select("*, group:groups!inner(*), client_accounts(*, account_balance(*))")
      .eq("group.tenant_id", tenant.id)
      .neq("status", "inactive")
      .order("name");
  }

  // Grupos: no domínio admin mostra todos; em domínio de tenant filtra pelo tenant
  const groupsQuery = (isSuperAdmin && onAdminDomain)
    ? supabase.from("groups").select("id, name, color").order("name")
    : supabase.from("groups").select("id, name, color").eq("tenant_id", tenant.id).order("name");

  const [clientsRes, groupsRes, metricsRes, unlinkedRes] = await Promise.all([
    clientsQuery,
    groupsQuery,
    supabase.rpc("dashboard_metrics", { p_start: range.start, p_end: range.end }),
    isSuperAdmin && onAdminDomain ? supabase.rpc("unlinked_meta_accounts") : Promise.resolve({ data: [], error: null }),
  ]);

  if (clientsRes.error) {
    throw new Error(`Erro ao buscar clientes: ${clientsRes.error.message}`);
  }
  if (groupsRes.error) {
    throw new Error(`Erro ao buscar grupos: ${groupsRes.error.message}`);
  }
  if (metricsRes.error) {
    throw new Error(`Erro ao buscar métricas: ${metricsRes.error.message}`);
  }

  // Gestores sem clientes → página de contas para ativar o primeiro
  if (!isAdminUser(user) && (clientsRes.data ?? []).length === 0) {
    redirect("/admin/contas");
  }

  const sumsByAccount = new Map<string, MetricSums>();
  for (const row of (metricsRes.data ?? []) as DashboardMetricsRow[]) {
    sumsByAccount.set(row.cliente_id, {
      cliques: row.cliques,
      leads: row.leads,
      mensagens: row.mensagens,
      resultados: row.resultados,
      impressoes: row.impressoes,
      alcance: row.alcance,
      visitasPerfil: row.profile_visits,
      custoTotal: Number(row.custo ?? 0),
      custoPorLead: row.custo_por_lead == null ? null : Number(row.custo_por_lead),
      custoPorMensagem:
        row.custo_por_mensagem == null ? null : Number(row.custo_por_mensagem),
    });
  }

  const clients: ClientWithData[] = ((clientsRes.data ?? []) as ClientRow[]).map(
    (c) => {
      const account = c.client_accounts[0] ?? null;
      const rawId = account ? stripActPrefix(account.account_id) : "";
      return {
        ...c,
        account,
        balance: account?.account_balance ?? null,
        metrics: sumsByAccount.get(rawId) ?? EMPTY_METRIC_SUMS,
      };
    }
  );

  const groups = (groupsRes.data ?? []) as Group[];
  const unlinked = (unlinkedRes.data ?? []) as UnlinkedAccount[];

  const isGestorOrUnknown = !isAdminUser(user);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted mt-1">
            Métricas dos últimos 7 dias · {clients.length} clientes ativos
          </p>
        </div>
        {isGestorOrUnknown && (
          <Link
            href="/admin/contas"
            className="inline-flex items-center gap-2 rounded-lg bg-accent hover:bg-accent/80 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            <PlusCircle size={16} />
            Adicionar cliente
          </Link>
        )}
      </div>

      {isSuperAdmin && onAdminDomain && unlinked.length > 0 && (
        <ImportClientsPanel accounts={unlinked} groups={groups} />
      )}

      <DashboardView clients={clients} groups={groups} showGroupFilter={isAdminUser(user)} />
    </div>
  );
}
