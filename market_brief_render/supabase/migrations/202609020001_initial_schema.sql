-- RAMarket initial schema. Run with `supabase db push` or paste in Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.product_condition as enum ('new', 'like_new', 'good', 'fair');
create type public.product_status as enum ('active', 'reserved', 'sold', 'hidden');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 30),
  login_id text check (login_id ~ '^[a-z0-9][a-z0-9_-]{3,19}$'),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 100),
  description text not null check (char_length(description) between 1 and 5000),
  category text not null check (char_length(category) between 1 and 50),
  condition public.product_condition not null,
  asking_price integer not null check (asking_price >= 0),
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_active_created_at_idx on public.products (created_at desc) where status = 'active';
create index products_category_idx on public.products (category);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 7),
  created_at timestamptz not null default now(),
  unique (product_id, sort_order)
);

create table public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price integer not null check (price >= 0),
  source text not null check (char_length(source) between 1 and 100),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index price_snapshots_product_captured_at_idx on public.price_snapshots (product_id, captured_at);

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  unique (product_id, buyer_id)
);
create index chats_buyer_updated_at_idx on public.chats (buyer_id, updated_at desc);
create index chats_seller_updated_at_idx on public.chats (seller_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_chat_created_at_idx on public.messages (chat_id, created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute procedure public.set_updated_at();
create trigger chats_set_updated_at before update on public.chats for each row execute procedure public.set_updated_at();
create or replace function public.touch_chat()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.chats set updated_at = now() where id = new.chat_id;
  return new;
end;
$$;
create trigger messages_touch_chat after insert on public.messages for each row execute procedure public.touch_chat();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'nickname', 30), ''), left(split_part(new.email, '@', 1), 30), 'user'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;

create policy "profiles are publicly readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "active products are readable" on public.products for select using (status = 'active' or seller_id = auth.uid());
create policy "authenticated users create own products" on public.products for insert with check (seller_id = auth.uid());
create policy "sellers update own products" on public.products for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "sellers delete own products" on public.products for delete using (seller_id = auth.uid());

create policy "product images readable with product" on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or p.seller_id = auth.uid()))
);
create policy "sellers add own product images" on public.product_images for insert with check (
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = auth.uid())
);
create policy "sellers remove own product images" on public.product_images for delete using (
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = auth.uid())
);

create policy "price snapshots are publicly readable" on public.price_snapshots for select using (true);

create policy "chat members read chats" on public.chats for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "buyers create chats" on public.chats for insert with check (
  buyer_id = auth.uid() and seller_id <> auth.uid() and
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = seller_id and p.status = 'active')
);

create policy "chat members read messages" on public.messages for select using (
  exists (select 1 from public.chats c where c.id = chat_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid()))
);
create policy "chat members send messages" on public.messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.chats c where c.id = chat_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

-- Storage bucket and per-user object paths: products/<auth.uid()>/<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "users upload product images to own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'product-images' and (storage.foldername(name))[1] = 'products' and (storage.foldername(name))[2] = (select auth.uid()::text)
);
create policy "users delete own product images" on storage.objects for delete to authenticated using (
  bucket_id = 'product-images' and (storage.foldername(name))[1] = 'products' and (storage.foldername(name))[2] = (select auth.uid()::text)
);
create policy "product images are publicly readable" on storage.objects for select using (bucket_id = 'product-images');
