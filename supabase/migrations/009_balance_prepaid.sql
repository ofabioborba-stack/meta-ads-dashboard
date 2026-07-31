-- Correção do saldo das contas:
-- O campo `balance` da Meta API é o gasto ainda não faturado (em centavos),
-- NÃO o saldo disponível. O valor correto (o mesmo do Gerenciador de Anúncios)
-- vem em funding_source_details.display_string — e só existe em contas
-- pré-pagas. Contas pós-pagas (cartão) não têm conceito de "saldo restante".
--
-- A partir desta migração:
--   balance     = saldo disponível em reais (pré-pagas) | null (pós-pagas)
--   is_prepaid  = distingue os dois casos na UI e nos alertas

alter table account_balance
  add column if not exists is_prepaid boolean not null default true;

-- Contas pós-pagas (cartão de crédito) não têm saldo disponível.
-- O sync diário detecta automaticamente via funding_source_details.type.
-- Se quiser marcar contas existentes como pós-pagas manualmente:
--
-- update account_balance
-- set is_prepaid = false, balance = null
-- where account_id in (
--   select id from client_accounts
--   where account_id in ('act_SEU_ID_AQUI')
-- );
