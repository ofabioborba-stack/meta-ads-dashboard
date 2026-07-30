-- Controle manual de recarga para contas em que a Meta API não expõe o saldo
-- (pós-pagas com fundos pré-carregados, ex.: CEM — o cartão é só reserva).
--
-- Quando funding_amount/funding_date estão preenchidos em uma conta pós-paga,
-- o saldo passa a ser calculado: funding_amount - gasto acumulado desde
-- funding_date (meta_ads_raw_data). O cálculo roda no sync diário e ao salvar
-- a recarga no painel; o resultado fica em account_balance como nas pré-pagas.

-- funding_tax_rate: % de imposto (ex.: ISS) que o Meta repassa sobre o gasto.
-- Saldo = funding_amount - gasto x (1 + funding_tax_rate/100).
alter table client_accounts
  add column if not exists funding_amount numeric,
  add column if not exists funding_date date,
  add column if not exists funding_tax_rate numeric not null default 0;
