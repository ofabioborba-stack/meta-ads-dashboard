import { headers } from "next/headers";
import type { Tenant, TenantSlug } from "@/types";
import { ADMIN_TENANT_SLUG } from "@/lib/tenant-slug";

/**
 * Busca o tenant pelo slug direto na REST do Supabase com o Data Cache do
 * Next (revalidate: 3600) — o client do Supabase usa cookies e não permite
 * cache; aqui é só branding, sem dado sensível do usuário.
 */
export async function fetchTenantBySlug(slug: string): Promise<Tenant> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300, tags: [`tenant-${slug}`] },
    }
  );

  if (!res.ok) {
    throw new Error(`Erro ao buscar tenant "${slug}": HTTP ${res.status}`);
  }

  const rows = (await res.json()) as Tenant[];
  if (!rows[0]) {
    throw new Error(`Tenant não encontrado: ${slug}`);
  }
  return rows[0];
}

/** Lê o slug definido pelo middleware (x-tenant-slug). */
export async function getTenantSlug(): Promise<TenantSlug> {
  const headerList = await headers();
  return (headerList.get("x-tenant-slug") as TenantSlug | null) ?? ADMIN_TENANT_SLUG;
}

/** Tenant da request atual, com cores e logo. */
export async function getTenant(): Promise<Tenant> {
  return fetchTenantBySlug(await getTenantSlug());
}
