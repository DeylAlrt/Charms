-- Navillera: saving orders (Stage 4).
-- Run once in the Supabase dashboard → SQL Editor → New query → paste → Run (after create_tables).
--
-- The builder's server saves every order here (both websites) through create_order(), which
-- checks and takes stock in the same step, so two customers can't both buy the last one.
-- Ziina orders are saved as 'awaiting_payment' and turned into 'paid' by mark_order_paid()
-- once Ziina confirms the payment. Setting an order to 'cancelled' gives its stock back.
-- Only the server (secret key) can call these; websites can't.


-- Internal columns (you can ignore these in the Table Editor)
alter table public.orders
  add column stock_lines    jsonb,   -- which products' stock this order uses: [{product_id, qty}]
  add column email_template text,    -- which order email to send ('builder' or 'site')
  add column email_params   jsonb;   -- the order email, kept so it can be sent once a Ziina payment is confirmed

comment on column public.orders.stock_lines is 'Internal: products and quantities this order takes from stock.';
comment on column public.orders.email_params is 'Internal: the order email, sent once the payment is confirmed (Ziina).';


-- ============================================================
-- create_order: check (and take) stock, then save the order
-- ============================================================
create function public.create_order(p_order jsonb, p_stock_lines jsonb, p_take_stock boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  line record;
  current_stock integer;
  product_name text;
  new_id uuid;
  new_number bigint;
begin
  for line in
    select (e->>'product_id')::uuid as product_id, sum((e->>'qty')::int) as qty
    from jsonb_array_elements(coalesce(p_stock_lines, '[]'::jsonb)) e
    where e->>'product_id' is not null
    group by 1
    order by 1          -- always lock products in the same order, so two orders can't block each other
  loop
    select stock, name into current_stock, product_name
      from public.products where id = line.product_id
      for update;
    if current_stock is not null and current_stock < line.qty then
      raise exception 'OUT_OF_STOCK' using detail = coalesce(product_name, 'an item');
    end if;
    if p_take_stock and current_stock is not null then
      update public.products set stock = stock - line.qty where id = line.product_id;
    end if;
  end loop;

  insert into public.orders (
    source, status, payment_method, ziina_payment_id,
    customer_name, email, phone, address,
    delivery_option, delivery_text, bracelet_size, base_color,
    items, discount_code, subtotal_aed, discount_aed, delivery_fee_aed, total_aed, notes,
    stock_lines, stock_taken, email_template, email_params
  ) values (
    p_order->>'source', p_order->>'status', p_order->>'payment_method', p_order->>'ziina_payment_id',
    p_order->>'customer_name', p_order->>'email', p_order->>'phone', p_order->>'address',
    p_order->>'delivery_option', p_order->>'delivery_text', p_order->>'bracelet_size', p_order->>'base_color',
    p_order->'items', p_order->>'discount_code',
    (p_order->>'subtotal_aed')::numeric, (p_order->>'discount_aed')::numeric,
    (p_order->>'delivery_fee_aed')::numeric, (p_order->>'total_aed')::numeric, p_order->>'notes',
    p_stock_lines, p_take_stock, p_order->>'email_template', p_order->'email_params'
  )
  returning id, order_number into new_id, new_number;

  return jsonb_build_object('id', new_id, 'order_number', new_number);
end;
$$;


-- ============================================================
-- mark_order_paid: a Ziina payment was confirmed
-- Returns the order's email details, or null if there's no such order.
-- Safe to call twice (Ziina may send the same confirmation again).
-- ============================================================
create function public.mark_order_paid(p_ziina_payment_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  line record;
begin
  select * into o from public.orders where ziina_payment_id = p_ziina_payment_id for update;
  if not found then
    return null;
  end if;

  if o.status = 'awaiting_payment' then
    for line in
      select (e->>'product_id')::uuid as product_id, sum((e->>'qty')::int) as qty
      from jsonb_array_elements(coalesce(o.stock_lines, '[]'::jsonb)) e
      where e->>'product_id' is not null
      group by 1
      order by 1
    loop
      -- Already paid, so never refuse here; stock just can't go below 0
      update public.products set stock = greatest(stock - line.qty, 0)
        where id = line.product_id and stock is not null;
    end loop;
    update public.orders set status = 'paid', stock_taken = true where id = o.id;
  end if;

  return jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'email_template', o.email_template,
    'email_params', o.email_params,
    'email_sent', o.email_sent_at is not null
  );
end;
$$;


-- ============================================================
-- Cancelling an order gives its stock back
-- ============================================================
create function public.give_back_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  line record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and old.stock_taken then
    for line in
      select (e->>'product_id')::uuid as product_id, sum((e->>'qty')::int) as qty
      from jsonb_array_elements(coalesce(new.stock_lines, '[]'::jsonb)) e
      where e->>'product_id' is not null
      group by 1
    loop
      update public.products set stock = stock + line.qty
        where id = line.product_id and stock is not null;
    end loop;
    new.stock_taken := false;
  end if;
  return new;
end;
$$;

create trigger orders_give_back_stock
  before update of status on public.orders
  for each row execute function public.give_back_stock();


-- ============================================================
-- Only the builder's server may call these
-- ============================================================
revoke all on function public.create_order(jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.mark_order_paid(text) from public, anon, authenticated;
revoke all on function public.give_back_stock() from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, boolean) to service_role;
grant execute on function public.mark_order_paid(text) to service_role;
