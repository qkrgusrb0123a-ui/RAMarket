create table public.product_favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index product_favorites_product_id_idx on public.product_favorites (product_id);
alter table public.product_favorites enable row level security;
