import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregateMetrics,
  computeLeadsMetrics,
  formatCurrency,
  previousPeriodRange,
  stripActPrefix,
} from "@/lib/utils";
import type { AggregatedMetrics, DateRange, Lead } from "@/types";

type MetricRow = {
  data: string;
  cliques: number;
  leads: number;
  mensagens_iniciadas: number;
  resultados: number;
  custo_total: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchases: number;
  purchase_value: number;
};

type CampaignRow = {
  campanha: string;
  cliques: number;
  leads: number;
  mensagens: number;
  custo: number | string;
  cpl: number | string | null;
};

function metricsBlock(label: string, m: AggregatedMetrics): string {
  const lines = [
    `${label}:`,
    `- Investimento: ${formatCurrency(m.custoTotal)}`,
    `- Cliques: ${m.cliques}`,
    `- Conversões/resultados: ${m.resultados}`,
    `- Leads: ${m.leads}`,
    `- Mensagens iniciadas: ${m.mensagens}`,
  ];
  if (m.cpc > 0) lines.push(`- CPC: ${formatCurrency(m.cpc)}`);
  if (m.leads > 0) lines.push(`- CPL: ${formatCurrency(m.cpl)}`);
  if (m.mensagens > 0)
    lines.push(`- Custo por conversa: ${formatCurrency(m.custoPorMensagem)}`);
  if (m.carrinho > 0 || m.compras > 0 || m.receita > 0) {
    lines.push(
      `- Funil de vendas: ${m.carrinho} adições ao carrinho, ${m.checkouts} checkouts iniciados, ${m.compras} compras`
    );
    lines.push(
      `- Receita: ${formatCurrency(m.receita)}` +
        (m.roas > 0 ? ` (ROAS ${m.roas.toFixed(2)}x)` : "")
    );
    if (m.compras > 0)
      lines.push(`- Custo por compra: ${formatCurrency(m.custoPorCompra)}`);
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `Você é o analista sênior de uma agência de tráfego pago escrevendo a análise que acompanha o relatório de resultados enviado ao cliente.

Regras de tom (obrigatórias):
- A análise representa a agência. NUNCA critique a gestão de tráfego, nunca sugira erro, descuido ou má execução da agência, e nunca use linguagem alarmista.
- Comece sempre pelo que está indo bem no período, com números concretos.
- Quedas de desempenho ou custos acima do ideal são apresentados como "pontos de atenção" ou "oportunidades de otimização" que a gestão já está acompanhando — quando os dados não explicarem a causa, levante hipóteses externas plausíveis (sazonalidade, leilão mais competitivo, rotação de criativos, mudança de comportamento do público) e diga o que será investigado/ajustado.
- Quando houver leads no período, inclua na seção de leads uma cobrança cordial e direta ao cliente: peça retorno sobre a qualidade e o andamento desses leads (atualizar o status no painel), explicando que esse feedback direciona a otimização das campanhas.
- Quando houver mensagens iniciadas, comente o volume e o custo das conversas que estão chegando, mesmo sem lista detalhada de conversas.
- Quando houver dados de vendas (carrinho, checkout, compras, receita), trate o cliente como vendedor de infoproduto: destaque receita, ROAS e custo por compra; explique o ROAS em linguagem simples (quantos reais retornam por real investido); analise a progressão do funil (carrinho → checkout → compra) e apresente gargalos como oportunidades (página de vendas, oferta, recuperação de carrinho/remarketing) — nunca como falha da gestão de tráfego.

Regras de conteúdo:
- Use APENAS os dados fornecidos. Não invente números, campanhas ou fatos.
- Compare com o período anterior quando os dados estiverem disponíveis; se não houver base de comparação, não compare.
- Valores monetários em reais (R$), no formato brasileiro.

Formato da resposta (markdown simples, sem tabelas):
## Destaques do período
## Pontos de atenção e oportunidades
## Leads e contatos
## Próximos passos

Se o cliente tiver vendas e não trabalhar com leads, substitua a seção "Leads e contatos" por "## Vendas e funil".

Entre 250 e 400 palavras no total, bullets curtos e objetivos. Não inclua saudação nem assinatura.`;

/**
 * Gera a análise por IA do período de um cliente. Server-only (usa service
 * role + ANTHROPIC_API_KEY). Lança erro com mensagem amigável quando a chave
 * não está configurada.
 */
export async function generateInsights(
  clientId: string,
  range: DateRange,
  periodLabel: string
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Adicione a chave no .env.local (e na Vercel) para gerar insights."
    );
  }

  const admin = createAdminClient();

  const clientRes = await admin
    .from("clients")
    .select(
      "id, name, group:groups(name, tenant:tenants(name)), client_accounts(account_id, alert_threshold, account_balance(*))"
    )
    .eq("id", clientId)
    .single();

  if (clientRes.error || !clientRes.data) {
    throw new Error("Cliente não encontrado");
  }

  const client = clientRes.data as unknown as {
    name: string;
    group: { name: string; tenant: { name: string } | null } | null;
    client_accounts: {
      account_id: string;
      alert_threshold: number;
      account_balance: { balance: number | null; is_prepaid?: boolean } | null;
    }[];
  };

  const account = client.client_accounts[0] ?? null;
  if (!account) {
    throw new Error("Cliente sem conta de anúncios vinculada");
  }

  const clienteId = stripActPrefix(account.account_id);
  const prevRange = previousPeriodRange(range);

  const [metricsRes, prevMetricsRes, campaignsRes, leadsRes] = await Promise.all([
    admin
      .from("meta_ads_raw_data")
      .select(
        "data, cliques, leads, mensagens_iniciadas, resultados, custo_total, add_to_cart, initiate_checkout, purchases, purchase_value"
      )
      .eq("cliente_id", clienteId)
      .gte("data", range.start)
      .lte("data", range.end),
    admin
      .from("meta_ads_raw_data")
      .select(
        "data, cliques, leads, mensagens_iniciadas, resultados, custo_total, add_to_cart, initiate_checkout, purchases, purchase_value"
      )
      .eq("cliente_id", clienteId)
      .gte("data", prevRange.start)
      .lte("data", prevRange.end),
    admin.rpc("campaign_metrics", {
      p_cliente_id: clienteId,
      p_start: range.start,
      p_end: range.end,
    }),
    admin
      .from("leads")
      .select("id, lead_status, created_time, updated_at")
      .eq("cliente_id", clienteId)
      .gte("created_time", `${range.start}T00:00:00`)
      .lte("created_time", `${range.end}T23:59:59`)
      .limit(1000),
  ]);

  for (const res of [metricsRes, prevMetricsRes, campaignsRes, leadsRes]) {
    if (res.error) throw new Error(`Erro ao coletar dados: ${res.error.message}`);
  }

  const metrics = aggregateMetrics((metricsRes.data ?? []) as MetricRow[]);
  const prevRows = (prevMetricsRes.data ?? []) as MetricRow[];
  const prevMetrics = prevRows.length > 0 ? aggregateMetrics(prevRows) : null;
  const campaigns = ((campaignsRes.data ?? []) as CampaignRow[])
    .sort((a, b) => Number(b.custo) - Number(a.custo))
    .slice(0, 8);
  const leads = (leadsRes.data ?? []) as Lead[];
  const leadsMetrics = computeLeadsMetrics(leads, 0);

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    const s = l.lead_status ?? "CREATED";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const dataBlock = [
    `Cliente: ${client.name}`,
    `Agência: ${client.group?.tenant?.name ?? "—"}`,
    `Período analisado: ${periodLabel} (${range.start} a ${range.end})`,
    "",
    metricsBlock("MÉTRICAS DO PERÍODO", metrics),
    "",
    prevMetrics
      ? metricsBlock(
          `PERÍODO ANTERIOR (${prevRange.start} a ${prevRange.end})`,
          prevMetrics
        )
      : "PERÍODO ANTERIOR: sem dados.",
    "",
    "CAMPANHAS (por investimento):",
    campaigns.length > 0
      ? campaigns
          .map(
            (c) =>
              `- ${c.campanha}: investimento ${formatCurrency(Number(c.custo))}, ` +
              `${c.cliques} cliques, ${c.leads} leads, ${c.mensagens} mensagens` +
              (c.cpl != null ? `, CPL ${formatCurrency(Number(c.cpl))}` : "")
          )
          .join("\n")
      : "- Nenhuma campanha com dados no período.",
    "",
    `LEADS DO PERÍODO: ${leadsMetrics.total} no total, ${leadsMetrics.convertidos} convertidos` +
      (leadsMetrics.total > 0
        ? ` (taxa ${leadsMetrics.taxaConversao.toFixed(1)}%)`
        : ""),
    leads.length > 0
      ? `Status dos leads: ${Object.entries(statusCounts)
          .map(([s, n]) => `${s}: ${n}`)
          .join(", ")}`
      : "",
    "",
    account.account_balance?.is_prepaid === false
      ? "Conta pós-paga (faturada no cartão de crédito) — não há saldo pré-pago a acompanhar; não comente sobre saldo."
      : account.account_balance?.balance != null
        ? `Saldo disponível na conta: ${formatCurrency(account.account_balance.balance)} (alerta abaixo de ${formatCurrency(account.alert_threshold)})`
        : "Saldo da conta: indisponível.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Escreva a análise do período com base nestes dados:\n\n${dataBlock}`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("A IA não retornou texto. Tente novamente.");
  }
  return text;
}

/** Rótulo humano do período para o prompt e para a UI. */
export function describePeriod(period: string, range: DateRange): string {
  switch (period) {
    case "yesterday":
      return "Ontem";
    case "7d":
      return "Últimos 7 dias";
    case "month":
      return "Mês atual";
    case "prev_month":
      return "Mês anterior";
    default:
      return `${range.start} a ${range.end}`;
  }
}
