export type ClientStatus = "active" | "paused" | "alert";
export type Platform = "meta" | "google";

export type TenantSlug = string;

/** Tenant com identidade visual própria, resolvido pelo subdomínio (header x-tenant-slug). */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  domain: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  card_color: string;
  created_at: string;
  meta_access_token: string | null;
  meta_bm_id: string | null;
  evolution_instance: string | null;
  evolution_api_key: string | null;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  status: ClientStatus;
  notes: string | null;
  group_id: string | null;
  owner_user_id: string | null;
  sheets_leads_url: string | null;
  whatsapp_notify: string | null;
  whatsapp_notify_2: string | null;
  whatsapp_group_jid: string | null;
  notify_leads_number: boolean;
  notify_leads_group: boolean;
  notify_balance_number: boolean;
  notify_balance_group: boolean;
  group?: Group | null;
  created_at: string;
}

export interface ClientAccount {
  id: string;
  client_id: string;
  platform: Platform;
  account_id: string;
  account_name: string | null;
  alert_threshold: number;
  /** Recarga manual (contas sem saldo na API): valor carregado e data. */
  funding_amount: number | null;
  funding_date: string | null;
  /** % de imposto repassado pelo Meta sobre o gasto (ex.: ISS). */
  funding_tax_rate: number;
  backfill_status: string | null;
  backfill_from: string | null;
  backfill_until: string | null;
  created_at: string;
}

export interface UserMetaToken {
  user_id: string;
  access_token: string;
  expires_at: string | null;
  meta_user_id: string | null;
  meta_user_name: string | null;
  updated_at: string;
}

export interface AccountBalance {
  id: string;
  account_id: string;
  /** Saldo disponível em reais (pré-pagas); null em contas pós-pagas. */
  balance: number | null;
  currency: string;
  /** false = conta pós-paga (cartão), sem conceito de saldo restante. */
  is_prepaid: boolean;
  updated_at: string;
  alert_sent_at: string | null;
}

/** Linha ad-level sincronizada via n8n. cliente_id = ID numérico da conta Meta sem o prefixo act_. */
export interface MetaAdsRawData {
  id: number;
  data: string;
  cliente_id: string;
  ad_id: string;
  campanha: string | null;
  anuncio: string | null;
  alcance: number;
  impressoes: number;
  cliques: number;
  resultados: number;
  mensagens_iniciadas: number;
  comentarios: number;
  salvos: number;
  compartilhamentos: number;
  cpc: number;
  cpm: number;
  ctr: number;
  custo_por_lead: number;
  custo_por_mensagem: number;
  custo_por_resultado: number | null;
  custo_total: number;
  thumbnail_url: string | null;
  link_anuncio: string | null;
  account_name: string | null;
  instagram_profile_visits: number;
  leads: number;
  add_to_cart: number;
  purchases: number;
  initiate_checkout: number;
  purchase_value: number;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
}

/** Métricas agregadas de um período (SUM das linhas ad-level). */
export interface AggregatedMetrics {
  cliques: number;
  leads: number;
  mensagens: number;
  resultados: number;
  conversoes: number;
  custoTotal: number;
  cpc: number;
  cpl: number;
  custoPorMensagem: number;
  custoPorResultado: number;
  /** Funil de vendas (infoproduto) — zerados quando o cliente não vende. */
  carrinho: number;
  checkouts: number;
  compras: number;
  receita: number;
  roas: number;
  custoPorCompra: number;
}

export interface DailySpend {
  date: string;
  custo: number;
  conversoes: number;
}

/** Chaves das métricas selecionáveis nos cards do dashboard. */
export type MetricKey =
  | "clicks"
  | "leads"
  | "messages"
  | "results"
  | "cost"
  | "cpl"
  | "cpm"
  | "cpc"
  | "reach"
  | "impressions"
  | "cost_per_message"
  | "conversions"
  | "profile_visits";

/** Somas brutas por conta retornadas pela função SQL dashboard_metrics. */
export interface MetricSums {
  cliques: number;
  leads: number;
  mensagens: number;
  resultados: number;
  impressoes: number;
  alcance: number;
  visitasPerfil: number;
  custoTotal: number;
  /** SUM(custo_total) / NULLIF(SUM(leads), 0) — null quando leads = 0. */
  custoPorLead: number | null;
  /** SUM(custo_total) / NULLIF(SUM(mensagens_iniciadas), 0) — null quando mensagens = 0. */
  custoPorMensagem: number | null;
}

/** Linha agregada por campanha (função SQL campaign_metrics). */
export interface CampaignMetrics {
  campanha: string;
  alcance: number;
  cliques: number;
  leads: number;
  mensagens: number;
  profile_visits: number;
  custo: number;
  cpl: number | null;
}

/** Linha agregada por criativo (função SQL creative_metrics). */
export interface CreativeMetrics {
  anuncio: string;
  ad_id: string;
  thumbnail_storage_url: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  link_anuncio: string | null;
  campanha: string | null;
  cliques: number;
  leads: number;
  mensagens: number;
  visitas_perfil: number;
  gasto: number;
  cpl: number | null;
  custo_mensagem: number | null;
}

/** Ordenações disponíveis no grid de criativos. */
export type CreativeSort = "gasto" | "cliques" | "leads" | "cpl";

/** Token opaco de link compartilhável — dá acesso público aos dados de um cliente. */
export interface ClientToken {
  id: string;
  client_id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  active: boolean;
  last_accessed_at: string | null;
  access_count: number;
  created_at: string;
}

export interface ClientWithData extends Client {
  account: ClientAccount | null;
  balance: AccountBalance | null;
  metrics: MetricSums;
}

export type Period = "yesterday" | "7d" | "month" | "prev_month" | "custom";

/** Intervalo de datas ISO (YYYY-MM-DD), inclusivo nas duas pontas. */
export interface DateRange {
  start: string;
  end: string;
}

export type LeadStatus = "CREATED" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";

/** Lead capturado via formulário Meta, sincronizado para a tabela leads. */
export interface Lead {
  id: string;
  lead_id_meta: string;
  cliente_id: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  ad_id: string | null;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  form_name: string | null;
  custom_fields: Record<string, unknown> | null;
  lead_status: LeadStatus | null;
  created_time: string | null;
  updated_at: string | null;
}

/** Métricas da linha de cards acima do Kanban de leads. */
export interface LeadsMetricsData {
  total: number;
  convertidos: number;
  /** Convertidos / total, em %. */
  taxaConversao: number;
  /** Gasto total Meta / total de leads recebidos. null quando não há leads. */
  cplReal: number | null;
  /** Gasto total Meta / convertidos. null quando não há conversões. */
  cpa: number | null;
  /** Média em dias entre created_time e updated_at dos CONVERTED. null sem convertidos. */
  tempoMedioConversaoDias: number | null;
}
