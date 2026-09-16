-- Operational administration: all mutable moderator actions are retained as
-- records.  App clients have no policies for these tables; the API accesses
-- them using the service role after administrator authentication.

alter table public.reports
  add column if not exists status text not null default 'received'
    check (status in ('received', 'reviewing', 'resolved', 'rejected')),
  add column if not exists handler_id text,
  add column if not exists resolution_reason text,
  add column if not exists processed_at timestamptz,
  add column if not exists result_notified_at timestamptz;
create index if not exists reports_status_created_at_idx on public.reports (status, created_at desc);

alter table public.products
  add column if not exists blinded_at timestamptz,
  add column if not exists blinded_reason text,
  add column if not exists blinded_by text,
  add column if not exists normalized_master_id uuid,
  add column if not exists anomaly_flags text[] not null default '{}';
create index if not exists products_moderation_idx on public.products (status, created_at desc);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  kind text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_created_idx on public.user_notifications (user_id, created_at desc);

create table if not exists public.user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('suspension', 'release')),
  reason text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  handled_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists user_sanctions_user_created_idx on public.user_sanctions (user_id, created_at desc);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  admin_role text not null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

create table if not exists public.banned_terms (
  id uuid primary key default gen_random_uuid(),
  pattern text not null unique,
  category text not null default 'custom' check (category in ('profanity', 'external_trade', 'contact', 'account', 'custom')),
  enabled boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.product_masters (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  generation text not null check (generation in ('DDR4', 'DDR5')),
  capacity_gb integer not null check (capacity_gb > 0),
  clock_mhz integer,
  model_name text not null,
  aliases text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (manufacturer, generation, capacity_gb, model_name)
);

alter table public.products add constraint products_normalized_master_id_fkey
  foreign key (normalized_master_id) references public.product_masters(id) on delete set null;

create table if not exists public.product_normalization_queue (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  raw_spec text not null,
  suggested_master_id uuid references public.product_masters(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'mapped', 'excluded')),
  handled_by text,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.price_calculation_policies (
  id boolean primary key default true check (id),
  aggregate_method text not null default 'median' check (aggregate_method in ('average', 'median')),
  window_days integer not null default 30 check (window_days between 1 and 365),
  minimum_samples integer not null default 5 check (minimum_samples between 1 and 100),
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.price_calculation_policies (id) values (true) on conflict (id) do nothing;

create table if not exists public.price_recalculation_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.product_registration_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.users(id) on delete set null,
  raw_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  master_id uuid references public.product_masters(id) on delete set null,
  handled_by text,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_detection_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages(id) on delete cascade,
  flag_type text not null check (flag_type in ('account', 'contact', 'external_messenger')),
  matched_value text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notice', 'popup', 'banner', 'faq', 'terms', 'privacy')),
  title text not null,
  body text not null,
  audience text not null default 'all',
  active boolean not null default true,
  revision integer not null default 1,
  published_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  revision integer not null,
  title text not null,
  body text not null,
  changed_by text not null,
  created_at timestamptz not null default now(),
  unique (content_id, revision)
);

alter table public.user_notifications enable row level security;
alter table public.user_sanctions enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.banned_terms enable row level security;
alter table public.product_masters enable row level security;
alter table public.product_normalization_queue enable row level security;
alter table public.price_calculation_policies enable row level security;
alter table public.price_recalculation_runs enable row level security;
alter table public.product_registration_requests enable row level security;
alter table public.chat_detection_flags enable row level security;
alter table public.content_items enable row level security;
alter table public.content_revisions enable row level security;

-- Product entries are screened at insert/update time.  Flags are deliberately
-- only signals: a human operator decides whether to blind the listing.
create or replace function public.flag_listing_anomalies()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare flags text[] := '{}'; median_price numeric;
begin
  if new.asking_price = 0 then flags := array_append(flags, 'zero_price'); end if;
  select percentile_cont(0.5) within group (order by asking_price)
    into median_price from public.products
    where category = new.category and status in ('active', 'reserved', 'sold') and asking_price > 0 and id <> new.id;
  if median_price is not null and new.asking_price > 0 and new.asking_price < median_price * 0.35 then
    flags := array_append(flags, 'extreme_low_price');
  end if;
  new.anomaly_flags := flags;
  return new;
end;
$$;
drop trigger if exists products_flag_anomalies on public.products;
create trigger products_flag_anomalies before insert or update of asking_price, category on public.products
  for each row execute procedure public.flag_listing_anomalies();
