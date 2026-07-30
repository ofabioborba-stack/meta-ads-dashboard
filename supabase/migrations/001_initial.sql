-- Traffic Dashboard — Schema inicial
-- Tabelas: clients, client_accounts, account_balance
-- A tabela meta_ads_raw_data deve já existir (dados ad-level sincronizados via n8n).

-- ============================================================
-- Tabelas
-- ============================================================

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  status text default 'active', -- active | paused | alert
  notes text,
  created_at timestamptz default now()
);

create table if not exists client_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  platform text not null, -- 'meta' | 'google'
  account_id text not null unique,
  account_name text,
  alert_threshold numeric default 200,
  created_at timestamptz default now()
);

create table if not exists account_balance (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references client_accounts(id) on delete cascade unique,
  balance numeric default 0,
  currency text default 'BRL',
  updated_at timestamptz default now(),
  alert_sent_at timestamptz
);

-- ============================================================
-- RLS — leitura para usuários autenticados; escrita via service role
-- ============================================================

alter table clients enable row level security;
alter table client_accounts enable row level security;
alter table account_balance enable row level security;
alter table meta_ads_raw_data enable row level security;

create policy "authenticated read clients"
  on clients for select to authenticated using (true);

create policy "authenticated update clients"
  on clients for update to authenticated using (true) with check (true);

create policy "authenticated read client_accounts"
  on client_accounts for select to authenticated using (true);

create policy "authenticated update client_accounts"
  on client_accounts for update to authenticated using (true) with check (true);

create policy "authenticated read account_balance"
  on account_balance for select to authenticated using (true);

create policy "authenticated read meta_ads_raw_data"
  on meta_ads_raw_data for select to authenticated using (true);
