-- v11 — Tenants, grupos, extensões nas tabelas de clientes e tabelas auxiliares
-- Todos os objetos criados manualmente no banco que não constavam nas migrations anteriores.

-- ============================================================
-- tenants — configuração por agência / gestor
-- ============================================================

create table if not exists tenants (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  domain           text not null unique,
  logo_url         text,
  primary_color    text not null default '#4F6EF7',
  secondary_color  text not null default '#6B7280',
  accent_color     text,
  background_color text not null default '#0F1117',
  card_color       text not null default '#1A1D27',
  -- Meta Ads
  meta_bm_id           text,
  meta_access_token     text,
  meta_token_expires_at timestamptz,
  meta_token_user_id    text,
  meta_token_user_name  text,
  -- WhatsApp (Evolution API)
  evolution_instance text,
  evolution_api_key  text,
  created_at timestamptz default now()
);

alter table tenants enable row level security;

create policy "authenticated read tenants"
  on tenants for select to authenticated using (true);

-- ============================================================
-- groups — agrupamento de clientes por tenant
-- ============================================================

create table if not exists groups (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  color     text not null,
  tenant_id uuid references tenants(id) on delete cascade,
  created_at timestamptz default now()
);

alter table groups enable row level security;

create policy "authenticated read groups"
  on groups for select to authenticated using (true);

-- ============================================================
-- clients — colunas adicionadas após o schema inicial
-- ============================================================

alter table clients
  add column if not exists group_id        uuid references groups(id),
  add column if not exists owner_user_id   uuid,
  add column if not exists sheets_leads_url text,
  -- notificações WhatsApp
  add column if not exists whatsapp_notify        text,
  add column if not exists whatsapp_group_jid      text,
  add column if not exists notify_leads_number     boolean not null default true,
  add column if not exists notify_leads_group      boolean not null default false,
  add column if not exists notify_balance_number   boolean not null default true,
  add column if not exists notify_balance_group    boolean not null default false;

-- ============================================================
-- client_accounts — colunas de backfill (sincronização histórica)
-- ============================================================

alter table client_accounts
  add column if not exists backfill_status text default 'pending',
  add column if not exists backfill_from   date,
  add column if not exists backfill_until  date;

-- ============================================================
-- leads — leads capturados via formulários Meta
-- ============================================================

create table if not exists leads (
  id                uuid primary key default gen_random_uuid(),
  lead_id_meta      text not null unique,
  client_account_id uuid references client_accounts(id) on delete cascade,
  cliente_id        text,
  nome              text,
  email             text,
  telefone          text,
  ad_id             text,
  ad_name           text,
  adset_id          text,
  adset_name        text,
  campaign_id       text,
  campaign_name     text,
  form_id           text,
  form_name         text,
  is_organic        boolean default false,
  platform          text default 'facebook',
  custom_fields     jsonb default '{}',
  lead_status       text default 'CREATED',
  created_time      timestamptz,
  updated_at        timestamptz default now()
);

alter table leads enable row level security;

create policy "authenticated read leads"
  on leads for select to authenticated using (true);

create policy "authenticated update leads"
  on leads for update to authenticated using (true) with check (true);

-- ============================================================
-- user_meta_tokens — token OAuth do gestor para a Meta API
-- ============================================================

create table if not exists user_meta_tokens (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  access_token   text not null,
  expires_at     timestamptz,
  meta_user_id   text,
  meta_user_name text,
  updated_at     timestamptz default now()
);

alter table user_meta_tokens enable row level security;

create policy "user reads own meta token"
  on user_meta_tokens for select to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- client_tokens — links de relatório compartilhável por cliente
-- ============================================================

create table if not exists client_tokens (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references clients(id) on delete cascade,
  token            text not null unique,
  label            text,
  expires_at       timestamptz,
  active           boolean default true,
  last_accessed_at timestamptz,
  access_count     integer default 0,
  created_at       timestamptz default now()
);

alter table client_tokens enable row level security;

create policy "authenticated read client_tokens"
  on client_tokens for select to authenticated using (true);

-- ============================================================
-- social_accounts — contas Instagram/Facebook vinculadas ao cliente
-- ============================================================

create table if not exists social_accounts (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients(id) on delete cascade,
  platform            text not null check (platform in ('instagram', 'facebook')),
  platform_account_id text not null,
  account_name        text,
  fb_page_id          text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

alter table social_accounts enable row level security;

create policy "authenticated read social_accounts"
  on social_accounts for select to authenticated using (true);

-- ============================================================
-- social_insights_daily — métricas diárias da conta social (orgânico)
-- ============================================================

create table if not exists social_insights_daily (
  id                uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  date              date not null,
  impressions       integer not null default 0,
  reach             integer not null default 0,
  views             integer not null default 0,
  views_organic     integer not null default 0,
  views_paid        integer not null default 0,
  interactions      integer not null default 0,
  profile_visits    integer not null default 0,
  link_clicks       integer not null default 0,
  followers_gained  integer not null default 0,
  video_views_3s    integer not null default 0,
  watch_time_ms     bigint  not null default 0,
  unique_viewers    integer not null default 0,
  updated_at        timestamptz not null default now(),
  unique(social_account_id, date)
);

alter table social_insights_daily enable row level security;

create policy "authenticated read social_insights_daily"
  on social_insights_daily for select to authenticated using (true);

-- ============================================================
-- social_posts — posts individuais com métricas de engajamento
-- ============================================================

create table if not exists social_posts (
  id                   uuid primary key default gen_random_uuid(),
  social_account_id    uuid not null references social_accounts(id) on delete cascade,
  platform_post_id     text not null unique,
  platform             text not null check (platform in ('instagram', 'facebook')),
  media_type           text,
  caption              text,
  permalink            text,
  thumbnail_url        text,
  thumbnail_storage_url text,
  published_at         timestamptz,
  views                integer not null default 0,
  reach                integer not null default 0,
  impressions          integer not null default 0,
  likes                integer not null default 0,
  comments             integer not null default 0,
  shares               integer not null default 0,
  saves                integer not null default 0,
  reel_plays           integer not null default 0,
  taps_forward         integer default 0,
  taps_back            integer default 0,
  exits                integer default 0,
  replies_count        integer default 0,
  engagement_rate      numeric,
  updated_at           timestamptz not null default now()
);

alter table social_posts enable row level security;

create policy "authenticated read social_posts"
  on social_posts for select to authenticated using (true);
