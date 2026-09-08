-- A post remains in the database until its seller explicitly changes it.
-- Past chat participants can still read the referenced listing after it is
-- hidden or marked sold, preserving the context of a 1:1 conversation.

drop policy if exists "active products are readable" on public.products;
create policy "active products and participant history are readable"
on public.products for select using (
  status = 'active'
  or seller_id = auth.uid()
  or exists (
    select 1 from public.messages m
    where m.product_id = products.id
      and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
  )
);
