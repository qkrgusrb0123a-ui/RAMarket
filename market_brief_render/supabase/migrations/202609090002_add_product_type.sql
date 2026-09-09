-- Keep desktop and laptop RAM as a separate product attribute from category.
alter table public.products
  add column product_type text not null default 'desktop'
  check (product_type in ('desktop', 'laptop'));
