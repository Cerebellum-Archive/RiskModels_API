-- Webhook subscriptions for async notifications (e.g. batch analysis completed).
-- Apply via Supabase SQL editor or: supabase db push (when linked to project).

create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webhook_subscriptions_user_id_idx
  on public.webhook_subscriptions (user_id);

create index if not exists webhook_subscriptions_active_idx
  on public.webhook_subscriptions (user_id, active);

alter table public.webhook_subscriptions enable row level security;

create policy "webhook_subscriptions_select_own"
  on public.webhook_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "webhook_subscriptions_insert_own"
  on public.webhook_subscriptions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "webhook_subscriptions_update_own"
  on public.webhook_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "webhook_subscriptions_delete_own"
  on public.webhook_subscriptions
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.webhook_subscriptions is 'User webhook targets; secrets used for HMAC-SHA256 signing outbound POSTs.';
