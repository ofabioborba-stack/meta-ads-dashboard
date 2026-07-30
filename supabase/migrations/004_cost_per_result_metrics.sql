-- v4 — custo_por_lead e custo_por_mensagem agregados nos cards do dashboard
-- drop necessário: alterar o "returns table" não é permitido com create or replace

drop function if exists dashboard_metrics(date);

-- Sumário por conta para os cards do dashboard (todas as métricas selecionáveis)
create or replace function dashboard_metrics(p_start date)
returns table (
  cliente_id text,
  cliques bigint,
  leads bigint,
  mensagens bigint,
  resultados bigint,
  impressoes bigint,
  alcance bigint,
  profile_visits bigint,
  custo numeric,
  custo_por_lead numeric,
  custo_por_mensagem numeric
)
language sql stable
as $$
  select
    m.cliente_id,
    coalesce(sum(m.cliques), 0)::bigint,
    coalesce(sum(m.leads), 0)::bigint,
    coalesce(sum(m.mensagens_iniciadas), 0)::bigint,
    coalesce(sum(m.resultados), 0)::bigint,
    coalesce(sum(m.impressoes), 0)::bigint,
    coalesce(sum(m.alcance), 0)::bigint,
    coalesce(sum(m.instagram_profile_visits), 0)::bigint,
    coalesce(sum(m.custo_total), 0),
    sum(m.custo_total) / nullif(sum(m.leads), 0),
    sum(m.custo_total) / nullif(sum(m.mensagens_iniciadas), 0)
  from meta_ads_raw_data m
  where m.data >= p_start
  group by m.cliente_id
$$;
