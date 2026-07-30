import type { User } from "@supabase/supabase-js";

/**
 * Papéis por usuário via app_metadata no Supabase Auth:
 *
 * - superadmin: acessa qualquer subdomínio e gera insights em todos.
 *     {"role": "superadmin"}
 * - admin: acessa somente o subdomínio do seu tenant e gera insights nele.
 *     {"role": "admin", "tenant": "kiwilab"}  (slug do tenant)
 *
 * Para promover um usuário, rode com a service role:
 *   PUT {SUPABASE_URL}/auth/v1/admin/users/{user_id}
 *   body: {"app_metadata": {"role": "admin", "tenant": "kiwilab"}}
 */

type Role = "superadmin" | "admin" | "gestor" | "analista";

/** Retorna a lista de tenants de um app_metadata, suportando string legada e array novo. */
export function getTenants(appMetadata: Record<string, unknown>): string[] {
  const arr = appMetadata?.tenants;
  if (Array.isArray(arr)) return arr.filter((t): t is string => typeof t === "string");
  const single = appMetadata?.tenant;
  if (typeof single === "string" && single) return [single];
  return [];
}

function roleOf(user: User | null): Role | null {
  const role = user?.app_metadata?.role;
  if (role === "superadmin" || role === "admin" || role === "gestor") return role;
  return null;
}

/** Fabio — superadmin, vê todos os clientes de todos os tenants. */
export function isSuperAdminUser(user: User | null): boolean {
  return roleOf(user) === "superadmin";
}

/** Admin de tenant (Joyce, Marina) ou superadmin — pode gerar insights por IA. */
export function isAdminUser(user: User | null): boolean {
  const r = roleOf(user);
  return r === "superadmin" || r === "admin";
}

/** Gestor de tráfego externo — acessa o dashboard mas só vê os próprios clientes via RLS. Analista do projeto de postagens tem o mesmo nível de acesso. */
export function isGestorUser(user: User | null): boolean {
  const r = roleOf(user);
  return r === "gestor" || r === "analista";
}

/**
 * Pode acessar o dashboard do tenant atual.
 * - superadmin: qualquer subdomínio
 * - admin: apenas o tenant vinculado em app_metadata.tenant
 * - gestor: se tiver app_metadata.tenant, só esse tenant; senão qualquer slug
 */
export function canAccessTenant(user: User | null, slug: string): boolean {
  if (!user) return false;
  const r = roleOf(user);
  if (r === "superadmin") return true;
  if (r === "admin") return user.app_metadata?.tenant === slug;
  if (r === "gestor" || r === "analista") {
    const tenants = getTenants(user.app_metadata ?? {});
    if (tenants.length > 0) return tenants.includes(slug);
    return true; // sem tenant → pode acessar qualquer subdomínio
  }
  return false;
}
