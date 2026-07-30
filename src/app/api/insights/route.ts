import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser, isGestorUser } from "@/lib/auth";
import { generateInsights, describePeriod } from "@/lib/insights";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { periodDateRange, yesterdayISODate } from "@/lib/utils";
import type { DateRange, Period } from "@/types";

// Geração com adaptive thinking pode levar perto de 1 minuto
export const maxDuration = 60;

const VALID_PERIODS: Period[] = ["yesterday", "7d", "month", "prev_month", "custom"];
const MIN_CUSTOM_DATE = "2026-01-01";

interface InsightsBody {
  clientId?: string;
  period?: string;
  start?: string;
  end?: string;
}

export async function POST(request: NextRequest) {
  // Insights são por usuário: sessão válida + role admin no Supabase Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!isAdminUser(user) && !isGestorUser(user)) {
    return NextResponse.json(
      { error: "Disponível apenas para usuários administradores" },
      { status: 403 }
    );
  }

  let body: InsightsBody;
  try {
    body = (await request.json()) as InsightsBody;
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const { clientId, period: rawPeriod, start, end } = body;
  if (!clientId || !VALID_PERIODS.includes(rawPeriod as Period)) {
    return NextResponse.json(
      { error: "clientId e period são obrigatórios" },
      { status: 400 }
    );
  }
  const period = rawPeriod as Period;

  // Gestores só podem gerar insights para seus próprios clientes
  if (isGestorUser(user)) {
    const adminDb = createAdminClient();
    const { data: owned } = await adminDb
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
  }

  const maxDate = yesterdayISODate();
  const isValidDate = (v?: string): v is string =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    v >= MIN_CUSTOM_DATE &&
    v <= maxDate;

  let range: DateRange;
  if (period === "custom") {
    if (!(isValidDate(start) && isValidDate(end) && start <= end)) {
      return NextResponse.json(
        { error: "Datas inválidas para período personalizado" },
        { status: 400 }
      );
    }
    range = { start, end };
  } else {
    range = periodDateRange(period);
  }

  try {
    const insights = await generateInsights(
      clientId,
      range,
      describePeriod(period, range)
    );
    return NextResponse.json({ insights });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
