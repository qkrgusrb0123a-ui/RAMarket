-- Simplifies the public schema to: users, products, products_images,
-- messages, and ram_price. Apply after the two earlier migrations.
-- `users` is used instead of `user`, because USER is a PostgreSQL keyword.

-- 1. User accounts and product photos keep their existing rows.
alter table public.profiles rename to users;
alter table public.product_images rename to products_images;

-- The profile trigger/function created by prior migrations must point to the
-- renamed table, otherwise future Auth sign-ups would fail.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, nickname, login_id, avatar_url)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'nickname', 30), ''), left(new.raw_user_meta_data ->> 'login_id', 30), 'user'),
    nullif(new.raw_user_meta_data ->> 'login_id', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop policy if exists "profiles are publicly readable" on public.users;
drop policy if exists "users update own profile" on public.users;
create policy "users are publicly readable" on public.users for select using (true);
create policy "users update own account" on public.users for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "product images readable with product" on public.products_images;
drop policy if exists "sellers add own product images" on public.products_images;
drop policy if exists "sellers remove own product images" on public.products_images;
create policy "product images readable with product" on public.products_images for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or p.seller_id = auth.uid()))
);
create policy "sellers add own product images" on public.products_images for insert with check (
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = auth.uid())
);
create policy "sellers remove own product images" on public.products_images for delete using (
  exists (select 1 from public.products p where p.id = product_id and p.seller_id = auth.uid())
);

-- 2. A message now holds its own conversation participants and product.
-- Copy the chat metadata before removing the intermediary chats table.
drop policy if exists "chat members read messages" on public.messages;
drop policy if exists "chat members send messages" on public.messages;
drop trigger if exists messages_touch_chat on public.messages;
drop function if exists public.touch_chat();

alter table public.messages add column product_id uuid;
alter table public.messages add column recipient_id uuid;
update public.messages m
set product_id = c.product_id,
    recipient_id = case when m.sender_id = c.buyer_id then c.seller_id else c.buyer_id end
from public.chats c
where c.id = m.chat_id;

alter table public.messages alter column product_id set not null;
alter table public.messages alter column recipient_id set not null;
alter table public.messages add constraint messages_product_id_fkey foreign key (product_id) references public.products(id) on delete restrict;
alter table public.messages add constraint messages_recipient_id_fkey foreign key (recipient_id) references public.users(id) on delete restrict;
alter table public.messages add constraint messages_different_participants check (sender_id <> recipient_id);
alter table public.messages drop column chat_id;
drop table public.chats;
create index messages_participant_created_at_idx on public.messages (sender_id, created_at desc);
create index messages_recipient_created_at_idx on public.messages (recipient_id, created_at desc);
create index messages_product_created_at_idx on public.messages (product_id, created_at desc);

create policy "message participants read messages" on public.messages for select using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);
create policy "send direct product messages" on public.messages for insert with check (
  sender_id = auth.uid()
  and recipient_id <> auth.uid()
  and exists (
    select 1 from public.products p
    where p.id = product_id and (p.seller_id = sender_id or p.seller_id = recipient_id)
  )
);

-- 3. Convert product-linked snapshots into weekly RAM market prices.
create table public.ram_price (
  id uuid primary key default gen_random_uuid(),
  ram_name text not null check (char_length(ram_name) between 1 and 100),
  price integer not null check (price >= 0),
  source text not null check (char_length(source) between 1 and 100),
  week_start date not null check (extract(isodow from week_start) = 1),
  created_at timestamptz not null default now(),
  unique (ram_name, source, week_start)
);

insert into public.ram_price (ram_name, price, source, week_start)
select p.title,
       round(avg(s.price))::integer,
       s.source,
       date_trunc('week', s.captured_at at time zone 'UTC')::date
from public.price_snapshots s
join public.products p on p.id = s.product_id
group by p.title, s.source, date_trunc('week', s.captured_at at time zone 'UTC')::date;

drop policy if exists "price snapshots are publicly readable" on public.price_snapshots;
drop table public.price_snapshots;
create index ram_price_week_start_idx on public.ram_price (week_start desc);
create index ram_price_name_week_start_idx on public.ram_price (ram_name, week_start);
alter table public.ram_price enable row level security;
create policy "RAM prices are publicly readable" on public.ram_price for select using (true);
