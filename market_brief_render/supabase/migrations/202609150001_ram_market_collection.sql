-- Auditable, licensed RAM market data.  This schema deliberately stores no
-- HTML or account-derived data from a marketplace; a licensed provider sends
-- normalized product observations to the server.
create table public.ram_market_collection_runs (
  id uuid primary key default gen_random_uuid(),
  scheduled_for date not null,
  source text not null check (char_length(source) between 1 and 100),
  authorization_reference text not null check (char_length(authorization_reference) between 8 and 500),
  status text not null check (status in ('running', 'completed', 'partial', 'failed')),
  target_per_spec smallint not null default 1000 check (target_per_spec between 1 and 1000),
  received_count integer not null default 0 check (received_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  failure_reason text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (scheduled_for, source)
);

create table public.ram_market_observations (
  id uuid primary key default gen_random_uuid(),
  collection_run_id uuid not null references public.ram_market_collection_runs(id) on delete restrict,
  collected_on date not null,
  ram_spec text not null check (char_length(ram_spec) between 1 and 100),
  ram_generation text not null check (ram_generation in ('DDR3', 'DDR4', 'DDR5')),
  capacity_gb smallint not null check (capacity_gb between 1 and 1024),
  clock_mhz integer not null check (clock_mhz between 400 and 20000),
  price integer not null check (price >= 0),
  source text not null check (char_length(source) between 1 and 100),
  source_product_id text not null check (char_length(source_product_id) between 1 and 200),
  source_product_name text not null check (char_length(source_product_name) between 1 and 300),
  source_url text,
  created_at timestamptz not null default now(),
  unique (collected_on, source, source_product_id)
);
create index ram_market_observations_spec_date_idx on public.ram_market_observations (ram_spec, collected_on desc);
create index ram_market_observations_run_idx on public.ram_market_observations (collection_run_id);

create table public.ram_market_daily_summaries (
  collected_on date not null,
  ram_spec text not null check (char_length(ram_spec) between 1 and 100),
  source text not null check (char_length(source) between 1 and 100),
  product_count integer not null check (product_count between 1 and 1000),
  min_price integer not null check (min_price >= 0),
  max_price integer not null check (max_price >= min_price),
  average_price integer not null check (average_price >= min_price and average_price <= max_price),
  collection_run_id uuid not null references public.ram_market_collection_runs(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (collected_on, ram_spec, source)
);
create index ram_market_daily_summaries_spec_date_idx on public.ram_market_daily_summaries (ram_spec, collected_on desc);

alter table public.ram_market_collection_runs enable row level security;
alter table public.ram_market_observations enable row level security;
alter table public.ram_market_daily_summaries enable row level security;

-- Public charts only expose aggregate values.  Product-level observations and
-- collection evidence remain available through the server-side admin API.
create policy "RAM market summaries are publicly readable" on public.ram_market_daily_summaries for select using (true);
