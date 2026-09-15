-- Replace the former marketplace-listing/dummy price history with daily,
-- aggregate-only Naver Shopping Search API data. No product title, seller,
-- link, or identifier is retained.
delete from public.ram_price;

create table public.ram_market_daily_prices (
  collected_on date not null,
  ram_generation text not null check (ram_generation in ('DDR4', 'DDR5')),
  capacity_gb smallint not null check (capacity_gb between 1 and 128),
  sample_count smallint not null check (sample_count between 1 and 100),
  min_price integer not null check (min_price > 0),
  max_price integer not null check (max_price >= min_price),
  median_price integer not null check (median_price between min_price and max_price),
  created_at timestamptz not null default now(),
  primary key (collected_on, ram_generation, capacity_gb)
);

create index ram_market_daily_prices_lookup_idx
  on public.ram_market_daily_prices (ram_generation, capacity_gb, collected_on desc);

alter table public.ram_market_daily_prices enable row level security;
create policy "daily RAM market prices are publicly readable"
  on public.ram_market_daily_prices for select using (true);
