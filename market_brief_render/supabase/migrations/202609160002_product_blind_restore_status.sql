alter table public.products
  add column if not exists status_before_blind text
    check (status_before_blind in ('active', 'reserved', 'sold'));

update public.products
set status_before_blind = 'active'
where status = 'hidden' and status_before_blind is null;
