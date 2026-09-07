-- Adds password-based username login for both a new and an already-applied schema.
-- Password hashes themselves are managed by Supabase Auth in auth.users.
alter table public.profiles add column if not exists login_id text;

create unique index if not exists profiles_login_id_unique_idx
  on public.profiles (login_id)
  where login_id is not null;

alter table public.profiles drop constraint if exists profiles_login_id_format;
alter table public.profiles add constraint profiles_login_id_format
  check (login_id is null or login_id ~ '^[a-z0-9][a-z0-9_-]{3,19}$');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname, login_id, avatar_url)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'nickname', 30), ''), left(new.raw_user_meta_data ->> 'login_id', 30), 'user'),
    nullif(new.raw_user_meta_data ->> 'login_id', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;
