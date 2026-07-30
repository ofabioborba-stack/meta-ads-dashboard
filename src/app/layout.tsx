import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getTenant } from "@/lib/tenant";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  return {
    title: `Dashboard | ${tenant.name}`,
    description: `Relatórios de tráfego - ${tenant.name}`,
    icons: { icon: "/api/favicon" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getTenant();

  // Sobrescreve os tokens do @theme (globals.css) por tenant: as utilities do
  // Tailwind (bg-card, text-accent, ...) resolvem via var(), então o override
  // inline no body re-tematiza toda a árvore sem context/provider.
  const tenantVars = {
    "--color-primary": tenant.primary_color,
    "--color-secondary": tenant.secondary_color,
    "--color-accent": tenant.primary_color,
    "--color-accent-alt": tenant.accent_color,
    "--color-bg": tenant.background_color,
    "--color-background": tenant.background_color,
    "--color-card": tenant.card_color,
    "--color-card-hover": `color-mix(in srgb, ${tenant.card_color}, white 5%)`,
    "--color-border": `color-mix(in srgb, ${tenant.card_color}, white 12%)`,
  } as CSSProperties;

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col" style={tenantVars}>
        {children}
      </body>
    </html>
  );
}
