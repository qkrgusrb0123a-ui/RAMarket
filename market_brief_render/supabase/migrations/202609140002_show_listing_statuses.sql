-- Reserved and sold listings remain visible in the marketplace so buyers can
-- see the seller-selected transaction status.
drop policy if exists "active products and participant history are readable" on public.products;
drop policy if exists "active products are readable" on public.products;
create policy "products are publicly readable" on public.products for select using (true);
