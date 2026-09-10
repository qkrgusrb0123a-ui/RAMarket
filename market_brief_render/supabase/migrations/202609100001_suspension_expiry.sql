-- A NULL end time represents an administrator-set permanent suspension.
alter table public.users
  add column if not exists suspended_until timestamptz;

create index if not exists users_suspension_expiry_idx
  on public.users (suspended_until)
  where status = 'suspended' and suspended_until is not null;
