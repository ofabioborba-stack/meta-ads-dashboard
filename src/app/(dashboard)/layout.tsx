import { BarChart3, Building2, Users } from "lucide-react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [tenant, supabase] = await Promise.all([getTenant(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();
  const showAdminNav = isAdminUser(user ?? null);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              {tenant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="h-8 w-auto"
                  style={{ maxHeight: 32 }}
                />
              ) : (
                <>
                  <BarChart3 size={20} className="text-accent" />
                  {tenant.name}
                </>
              )}
            </Link>
            {showAdminNav && (
              <>
                <Link
                  href="/admin/usuarios"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <Users size={15} />
                  Gestores
                </Link>
                <Link
                  href="/admin/contas"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <Building2 size={15} />
                  Contas
                </Link>
              </>
            )}
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
