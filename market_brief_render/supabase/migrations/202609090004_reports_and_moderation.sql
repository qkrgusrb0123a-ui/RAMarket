-- Moderation data is deliberately not exposed through the Supabase client.
-- The API uses the service-role key after authenticating either a user or an
-- administrator, while RLS prevents direct reads/writes from app clients.

alter table public.users
  add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended'));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('product', 'chat')),
  reporter_id uuid references public.users(id) on delete set null,
  reported_user_id uuid references public.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null default '',
  created_at timestamptz not null default now(),
  check (reporter_id is null or reported_user_id is null or reporter_id <> reported_user_id)
);

create index reports_target_created_at_idx on public.reports (target_type, created_at desc);
create index reports_reported_user_idx on public.reports (reported_user_id);

alter table public.reports enable row level security;
