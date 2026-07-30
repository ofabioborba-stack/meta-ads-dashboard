import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessTenant } from "@/lib/auth";
import { getTenantSlugFromHost } from "@/lib/tenant-slug";

/**
 * Repassa a request com o header x-tenant-slug. Copia os headers no momento
 * da chamada para incluir cookies que o Supabase tenha atualizado antes.
 */
function nextWithTenant(request: NextRequest, slug: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", slug);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest) {
  const slug = getTenantSlugFromHost(request.headers.get("host") ?? "");

  // Rotas de API têm autenticação própria (SYNC_SECRET) e /auth/callback
  // precisa rodar antes de existir sessão — sem redirect para /login.
  // /r/* é o relatório compartilhável do cliente: público, validado por token.
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/r/")
  ) {
    return nextWithTenant(request, slug);
  }

  let response = nextWithTenant(request, slug);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = nextWithTenant(request, slug);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isUnauthorizedPage = request.nextUrl.pathname.startsWith("/unauthorized");
  const isForgotPasswordPage = request.nextUrl.pathname.startsWith("/forgot-password");
  const isUpdatePasswordPage = request.nextUrl.pathname.startsWith("/update-password");

  // Páginas de auth abertas: login, esqueceu senha, redefinir senha
  const isOpenAuthPage = isLoginPage || isForgotPasswordPage;

  if (!user && !isOpenAuthPage && !isUpdatePasswordPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Usuário logado mas sem vínculo com o tenant deste subdomínio:
  // superadmin entra em qualquer um; admin só no app_metadata.tenant.
  if (user && !isUnauthorizedPage && !isUpdatePasswordPage && !canAccessTenant(user, slug)) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  if (user && (isOpenAuthPage || (isUnauthorizedPage && canAccessTenant(user, slug)))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
