import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hosts .local usados para testar multi-tenant em dev (via /etc/hosts).
  // Sem isso o Next bloqueia os recursos /_next/* e a página não hidrata.
  allowedDevOrigins: [
    "dash.kiwilab.local",
    "dash.aaldeia.local",
    "dash.fabioborba.local",
    "dash.ifc.local",
  ],
  // Geração de PDF server-side (não devem ser bundlados pelo Turbopack)
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
