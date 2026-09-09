-- A new sale post must explicitly choose desktop or laptop RAM.
-- This prevents an outdated client from silently storing every new post as desktop.
alter table public.products
  alter column product_type drop default;
