-- v6 — grid de criativos: agregação por anúncio/ad_id, período fechado e custo por mensagem
-- drop necessário: assinatura e colunas de retorno mudaram

drop function if exists creative_metrics(text, date);

create or replace function creative_metrics(p_cliente_id text, p_start date, p_end date)
returns table (
  anuncio text,
  ad_id text,
  thumbnail_storage_url text,
  thumbnail_url text,
  link_anuncio text,
  campanha text,
  cliques bigint,
  leads bigint,
  mensagens bigint,
  visitas_perfil bigint,
  gasto numeric,
  cpl numeric,
  custo_mensagem numeric
)
language sql stable
as $$
  select
    coalesce(m.anuncio, '(sem nome)'),
    m.ad_id,
    max(m.thumbnail_storage_url),
    max(m.thumbnail_url),
    max(m.link_anuncio),
    max(m.campanha),
    coalesce(sum(m.cliques), 0)::bigint,
    coalesce(sum(m.leads), 0)::bigint,
    coalesce(sum(m.mensagens_iniciadas), 0)::bigint,
    coalesce(sum(m.instagram_profile_visits), 0)::bigint,
    round(coalesce(sum(m.custo_total), 0)::numeric, 2),
    round((sum(m.custo_total) / nullif(sum(m.leads), 0))::numeric, 2),
    round((sum(m.custo_total) / nullif(sum(m.mensagens_iniciadas), 0))::numeric, 2)
  from meta_ads_raw_data m
  where m.cliente_id = p_cliente_id
    and m.data >= p_start
    and m.data <= p_end
  group by 1, m.ad_id
  order by 11 desc
$$;
