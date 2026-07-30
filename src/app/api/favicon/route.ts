import { NextResponse, type NextRequest } from "next/server";
import { fetchTenantBySlug } from "@/lib/tenant";
import { getTenantSlugFromHost } from "@/lib/tenant-slug";

/**
 * Favicon por tenant: redireciona para a logo do tenant no Storage quando
 * existir; senão cai no favicon padrão do app.
 */
export async function GET(request: NextRequest) {
  const slug = getTenantSlugFromHost(request.headers.get("host") ?? "");

  try {
    const tenant = await fetchTenantBySlug(slug);
    if (tenant.logo_url) {
      return NextResponse.redirect(tenant.logo_url, {
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    }
  } catch {
    // tenant indisponível — usa o favicon padrão abaixo
  }

  return NextResponse.redirect(new URL("/favicon.ico", request.url), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
