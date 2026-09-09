-- Category values now include RAM standard, clock, capacity, and manufacturer.
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (char_length(category) between 1 and 80);
