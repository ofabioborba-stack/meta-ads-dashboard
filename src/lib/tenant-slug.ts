/**
 * Resolve o tenant ativo a partir da variável de ambiente TENANT_SLUG.
 *
 * Configure TENANT_SLUG no seu .env.local (dev) e nas variáveis de ambiente
 * do Vercel (prod). O valor deve corresponder ao campo `slug` da tabela `tenants`.
 *
 * Exemplo: TENANT_SLUG=minha-agencia
 */
export function getTenantSlugFromHost(_host: string): string {
  return process.env.TENANT_SLUG ?? "meu-dashboard";
}

export function isAdminTenant(_slug: string): boolean {
  return false;
}
