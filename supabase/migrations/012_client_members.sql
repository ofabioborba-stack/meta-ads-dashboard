-- v12 — Múltiplos gestores por cliente e segundo número WhatsApp

-- client_members: relação N-N entre clients e usuários (gestores)
create table if not exists client_members (
  client_id uuid not null references clients(id) on delete cascade,
  user_id   uuid not null,
  primary key (client_id, user_id)
);

alter table client_members enable row level security;

create policy "authenticated read client_members"
  on client_members for select to authenticated using (true);

-- Segundo número WhatsApp para notificações (ex.: segundo analista)
alter table clients
  add column if not exists whatsapp_notify_2 text;
