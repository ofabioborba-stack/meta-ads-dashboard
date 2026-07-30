import { existsSync } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { periodDateRange, yesterdayISODate } from "@/lib/utils";
import type { DateRange, Period } from "@/types";

// Render da página + geração do PDF (com insights pode chegar perto de 1 min)
export const maxDuration = 60;

const VALID_PERIODS: Period[] = ["yesterday", "7d", "month", "prev_month", "custom"];
const MIN_CUSTOM_DATE = "2026-01-01";

/** Caminhos comuns do Chrome/Edge para desenvolvimento local no Windows. */
const LOCAL_BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

// O binário do chromium (64 MB comprimido) ultrapassa o limite de 50 MB de
// arquivo em funções Lambda da Vercel, por isso não é incluído no bundle.
// Passamos a URL do GitHub Releases para que o pacote baixe e cache o binário
// em /tmp/chromium no cold start (warm starts reutilizam o cache).
// v149 renamed the asset to include the architecture suffix; x64 = standard Vercel Lambda
const CHROMIUM_REMOTE_URL =
  process.env.CHROMIUM_BINARY_URL ??
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

async function launchBrowser(): Promise<Browser> {
  // Na Vercel usa o Chromium serverless; em dev usa o Chrome/Edge instalado
  if (process.env.VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_REMOTE_URL),
      headless: true,
    });
  }

  const local =
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    LOCAL_BROWSERS.find((p) => existsSync(p));
  if (!local) {
    throw new Error(
      "Chrome/Edge não encontrado para gerar o PDF localmente. Defina PUPPETEER_EXECUTABLE_PATH no .env.local."
    );
  }
  return puppeteer.launch({ executablePath: local, headless: true });
}

/** Nome do arquivo: Cliente_MM.AAAA (ou intervalo quando cruza meses). */
function buildFilename(clientName: string, range: DateRange): string {
  const safeName = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const [sy, sm, sd] = range.start.split("-");
  const [ey, em, ed] = range.end.split("-");
  const periodPart =
    sy === ey && sm === em
      ? `${sm}.${sy}`
      : `${sd}.${sm}.${sy}-${ed}.${em}.${ey}`;

  return `${safeName}_${periodPart}.pdf`;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const rawPeriod = searchParams.get("period") ?? "7d";
  if (!VALID_PERIODS.includes(rawPeriod as Period)) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  }
  const period = rawPeriod as Period;

  const maxDate = yesterdayISODate();
  const isValidDate = (v: string | null): v is string =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    v >= MIN_CUSTOM_DATE &&
    v <= maxDate;

  let range: DateRange;
  if (period === "custom") {
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!(isValidDate(start) && isValidDate(end) && start <= end)) {
      return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
    }
    range = { start, end };
  } else {
    range = periodDateRange(period);
  }

  const clientRes = await createAdminClient()
    .from("clients")
    .select("name")
    .eq("id", id)
    .single();
  if (clientRes.error || !clientRes.data) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  // Monta a URL do relatório no mesmo host (preserva o tema do tenant)
  const reportUrl = new URL(`/report/${id}`, request.nextUrl.origin);
  reportUrl.searchParams.set("period", period);
  if (period === "custom") {
    reportUrl.searchParams.set("start", range.start);
    reportUrl.searchParams.set("end", range.end);
  }
  if (searchParams.get("insights") === "1") {
    reportUrl.searchParams.set("insights", "1");
  }

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Reaproveita a sessão do usuário para a página autenticada do relatório
    const cookie = request.headers.get("cookie");
    if (cookie) {
      await page.setExtraHTTPHeaders({ cookie });
    }

    await page.setViewport({ width: 1100, height: 1400 });
    await page.goto(reportUrl.toString(), {
      waitUntil: "networkidle0",
      timeout: 55_000,
    });
    // Garante fontes carregadas e gráficos (recharts) renderizados
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 500));

    // Margem 0: o fundo escuro do relatório vai até a borda da folha
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });

    const filename = buildFilename(clientRes.data.name, range);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
