-- v5 — gasto total por conta para o CPL real do Kanban de leads

create or replace function client_total_spend(p_cliente_id text)
returns numeric
language sql stable
as $$
  select coalesce(sum(m.custo_total), 0)
  from meta_ads_raw_data m
  where m.cliente_id = p_cliente_id
$$;
