-- v3 — Visitas ao Perfil (instagram_profile_visits) nas funções de agregação
-- drop necessário: alterar o "returns table" não é permitido com create or replace

drop function if exists dashboard_metrics(date);
drop function if exists campaign_metrics(text, date);
drop function if exists creative_metrics(text, date);

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
  custo numeric
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
    coalesce(sum(m.custo_total), 0)
  from meta_ads_raw_data m
  where m.data >= p_start
  group by m.cliente_id
$$;

-- Métricas agrupadas por campanha (aba Campanhas)
create or replace function campaign_metrics(p_cliente_id text, p_start date)
returns table (
  campanha text,
  alcance bigint,
  cliques bigint,
  leads bigint,
  mensagens bigint,
  profile_visits bigint,
  custo numeric,
  cpl numeric
)
language sql stable
as $$
  select
    coalesce(m.campanha, '(sem campanha)'),
    coalesce(sum(m.alcance), 0)::bigint,
    coalesce(sum(m.cliques), 0)::bigint,
    coalesce(sum(m.leads), 0)::bigint,
    coalesce(sum(m.mensagens_iniciadas), 0)::bigint,
    coalesce(sum(m.instagram_profile_visits), 0)::bigint,
    coalesce(sum(m.custo_total), 0),
    sum(m.custo_total) / nullif(sum(m.leads), 0)
  from meta_ads_raw_data m
  where m.cliente_id = p_cliente_id
    and m.data >= p_start
  group by 1
  order by coalesce(sum(m.custo_total), 0) desc
$$;

-- Métricas agrupadas por anúncio/criativo (aba Criativos)
create or replace function creative_metrics(p_cliente_id text, p_start date)
returns table (
  anuncio text,
  thumbnail_url text,
  thumbnail_storage_url text,
  link_anuncio text,
  alcance bigint,
  cliques bigint,
  leads bigint,
  mensagens bigint,
  profile_visits bigint,
  custo numeric,
  cpl numeric
)
language sql stable
as $$
  select
    coalesce(m.anuncio, '(sem nome)'),
    m.thumbnail_url,
    m.thumbnail_storage_url,
    m.link_anuncio,
    coalesce(sum(m.alcance), 0)::bigint,
    coalesce(sum(m.cliques), 0)::bigint,
    coalesce(sum(m.leads), 0)::bigint,
    coalesce(sum(m.mensagens_iniciadas), 0)::bigint,
    coalesce(sum(m.instagram_profile_visits), 0)::bigint,
    coalesce(sum(m.custo_total), 0),
    sum(m.custo_total) / nullif(sum(m.leads), 0)
  from meta_ads_raw_data m
  where m.cliente_id = p_cliente_id
    and m.data >= p_start
  group by 1, m.thumbnail_url, m.thumbnail_storage_url, m.link_anuncio
  order by coalesce(sum(m.custo_total), 0) desc
$$;
