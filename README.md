# Meta Ads Dashboard

Dashboard para gestores de tráfego pago gerenciarem clientes de Meta Ads. Visualize métricas, saldo de contas, criativos e receba alertas via WhatsApp.

**Stack:** Next.js 14 · Supabase · Tailwind CSS · Vercel

---

## Funcionalidades

- Cards de clientes com métricas dos últimos 7 dias (leads, cliques, CPL, gasto)
- Saldo em tempo real por conta de anúncio
- Alertas de saldo baixo via WhatsApp (Evolution API)
- Notificação de novo lead via WhatsApp
- Gestores de tráfego com acesso individual por cliente
- Insights gerados por IA (Claude/Anthropic)
- Relatório público por cliente (link compartilhável)
- Sync automático via n8n

---

## Pré-requisitos

Antes de começar, você vai precisar de contas nas seguintes plataformas:

| Serviço | Plano mínimo | Para quê |
|---|---|---|
| [Supabase](https://supabase.com) | Free | Banco de dados + Auth |
| [Vercel](https://vercel.com) | Hobby (grátis) | Deploy do dashboard |
| [Meta for Developers](https://developers.facebook.com) | Gratuito | API de métricas |
| [n8n](https://n8n.io) | Cloud ou self-hosted | Sync automático diário |
| [Evolution API](https://evolution-api.com) | Self-hosted | Notificações WhatsApp (opcional) |
| [Anthropic](https://console.anthropic.com) | Pay-as-you-go | Insights por IA (opcional) |

---

## Passo a Passo

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/meta-ads-dashboard.git
cd meta-ads-dashboard
npm install
```

---

### 2. Crie o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Anote o **Project URL** e as chaves **anon** e **service_role** em:
   `Project Settings → API`

---

### 3. Execute as migrations

No painel do Supabase, vá em **SQL Editor** e execute os arquivos da pasta `supabase/migrations/` **em ordem**:

```
001_initial.sql
002_v2_thumbnail_storage_and_metric_rpcs.sql
003_profile_visits_metric.sql
004_cost_per_result_metrics.sql
005_client_total_spend.sql
006_creatives_grid.sql
007_creative_image_url.sql
008_period_end_date.sql
009_balance_prepaid.sql
010_manual_funding.sql
011_tenants_and_groups.sql
012_client_members.sql
```

> Se aparecer o aviso "Potential issue detected" sobre RLS, clique em **"Run and enable RLS"** — isso é esperado e correto.

---

### 4. Crie o tenant no banco

Ainda no **SQL Editor**, insira o seu tenant. Substitua os valores pelos seus:

```sql
INSERT INTO tenants (slug, name, domain)
VALUES (
  'minha-agencia',              -- slug: identificador único, sem espaços
  'Minha Agência de Tráfego',  -- nome exibido no dashboard
  'dash.minhaagencia.com.br'   -- domínio que você vai usar no Vercel
);
```

Guarde o `slug` — você vai usá-lo na variável de ambiente `TENANT_SLUG`.

---

### 5. Configure o Meta App

1. Acesse [developers.facebook.com](https://developers.facebook.com) e crie um novo App
2. Adicione o produto **Marketing API**
3. Em **Ferramentas → Explorador de API**, gere um **token de sistema de longa duração** com as permissões:
   - `ads_read`
   - `ads_management`
   - `business_management`
4. Anote o **App ID**, **App Secret** e o **token gerado**

---

### 6. Configure as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env.local
```

Preencha o `.env.local` com os valores dos passos anteriores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

TENANT_SLUG=minha-agencia     # mesmo slug do INSERT acima

META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=

SYNC_SECRET=string-aleatoria-segura
```

---

### 7. Teste localmente

```bash
npm run dev
```

Acesse `http://localhost:3000`. Você verá a tela de login.

---

### 8. Crie o primeiro usuário administrador

1. No Supabase, vá em **Authentication → Users → Add user**
2. Crie um usuário com seu e-mail e uma senha
3. Após criar, clique no usuário → **Edit** → edite o campo `app_metadata`:

```json
{
  "role": "admin",
  "tenant": "minha-agencia"
}
```

> O `tenant` deve ser o mesmo slug inserido na tabela `tenants`.

Agora faça login no dashboard com esse e-mail e senha.

---

### 9. Deploy no Vercel

1. Importe o repositório no [Vercel](https://vercel.com/new)
2. Adicione todas as variáveis do `.env.local` em **Settings → Environment Variables**
3. Adicione também `TENANT_SLUG=minha-agencia`
4. Aponte seu domínio em **Domains** (ex.: `dash.minhaagencia.com.br`)

---

### 10. Conecte o Business Manager (para ativar contas Meta)

Para ver as contas do seu BM e ativá-las no dashboard, configure no **SQL Editor**:

```sql
UPDATE tenants
SET
  meta_bm_id        = 'SEU_BM_ID',
  meta_access_token = 'SEU_TOKEN'
WHERE slug = 'minha-agencia';
```

O BM ID aparece em business.facebook.com → Configurações → Informações do negócio.

---

### 11. Configure o sync automático com n8n (recomendado)

O dashboard precisa do n8n para sincronizar métricas e saldo diariamente.

**Sync de saldo** — crie um workflow no n8n com:
- Trigger: **Schedule** → todo dia às 8h
- Nó: **HTTP Request**
  - Method: `POST`
  - URL: `https://dash.minhaagencia.com.br/api/meta/sync`
  - Header: `x-sync-secret: SUA_SYNC_SECRET`

**Sync de métricas** — segundo workflow idêntico apontando para `/api/meta/sync-metrics`.

---

### 12. Configure notificações WhatsApp (opcional)

Se você tem a Evolution API rodando:

```sql
UPDATE tenants
SET
  evolution_instance = 'NomeDaSuaInstancia',
  evolution_api_key  = 'SUA_EVOLUTION_API_KEY'
WHERE slug = 'minha-agencia';
```

Depois acesse um cliente no dashboard → aba **Notificações** → configure o número.

---

## Adicionando gestores de tráfego

Em **Admin → Gestores**, convide gestores pelo e-mail. Em **Admin → Contas**, atribua clientes a cada gestor.

---

## Roles

| Role | Acesso |
|---|---|
| `admin` | Gerencia tudo do tenant (clientes, gestores, configurações) |
| `gestor` | Acessa apenas os clientes atribuídos |
| `analista` | Mesmo acesso que gestor |

Para definir o role: Supabase → Authentication → Users → edite `app_metadata`.

---

## Variáveis de ambiente — referência

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anon pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave service_role (nunca expor) |
| `TENANT_SLUG` | Sim | Slug do tenant na tabela `tenants` |
| `META_APP_ID` | Sim | App ID no Meta for Developers |
| `META_APP_SECRET` | Sim | App Secret Meta |
| `META_ACCESS_TOKEN` | Sim | Token de sistema de longa duração |
| `SYNC_SECRET` | Sim | Segredo para autorizar o n8n |
| `CRON_SECRET` | Não | Gerado pelo Vercel para cron jobs |
| `ANTHROPIC_API_KEY` | Não | Para insights por IA |
| `EVOLUTION_API_URL` | Não | URL da Evolution API |
| `EVOLUTION_API_KEY` | Não | Global API Key da Evolution |
| `EVOLUTION_INSTANCE` | Não | Nome da instância WhatsApp |
