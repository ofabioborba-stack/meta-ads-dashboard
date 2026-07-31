-- Função chamada pelo workflow n8n para atualizar o saldo das contas de anúncios.
-- Recebe o account_id do Meta (com ou sem prefixo 'act_') e grava em account_balance.
-- Se a conta não estiver cadastrada no dashboard, ignora sem erro.
create or replace function public.upsert_account_balance(
  p_account_id_meta text,
  p_balance         numeric default null,
  p_currency        text    default 'BRL',
  p_is_prepaid      boolean default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_account_id uuid;
begin
  select ca.id into v_account_id
  from client_accounts ca
  where ca.account_id = p_account_id_meta
     or ca.account_id = 'act_' || p_account_id_meta
  limit 1;

  if v_account_id is null then
    return;
  end if;

  insert into account_balance (account_id, balance, currency, updated_at, is_prepaid)
  values (v_account_id, p_balance, p_currency, now(), p_is_prepaid)
  on conflict (account_id) do update set
    balance    = excluded.balance,
    currency   = excluded.currency,
    updated_at = now(),
    is_prepaid = coalesce(excluded.is_prepaid, account_balance.is_prepaid);
end;
$$;
