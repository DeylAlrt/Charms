-- Navillera: discount codes checked and counted in the database (Stage 5).
-- Run once in the Supabase dashboard → SQL Editor → New query → paste → Run (after order_saving).
--
-- A code works when it is active, not expired, not used up, and — for
-- first_order_only codes — the customer has no earlier order (same WhatsApp
-- number or email) that went through. A use is counted when the order is
-- placed (Cash on Delivery / Bank Transfer) or paid (Ziina), and given back
-- if the order is cancelled.


alter table public.orders
  add column discount_counted boolean not null default false;   -- internal: whether this order counts as a use of its code

comment on column public.orders.discount_counted is 'Internal: whether this order counts towards its discount code''s times_used.';


-- Same number written differently ("0521234567", "+971 52 123 4567") = the last 9 digits.
create function public.phone_key(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$ select right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9) $$;

create index orders_phone_key_idx on public.orders (public.phone_key(phone));


-- ============================================================
-- check_discount: can this customer use this code right now?
-- Returns {ok: true, percent_off} or {ok: false, message} (message is for the customer).
-- Without an email and phone, the first-order rule isn't checked (e.g. when the
-- code is typed into the cart, before the customer's details are filled in).
-- ============================================================
create function public.check_discount(p_code text, p_email text default null, p_phone text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.discount_codes;
begin
  select * into d from public.discount_codes where code = upper(trim(p_code));
  if not found or not d.is_active then
    return jsonb_build_object('ok', false, 'message', 'That code isn''t valid.');
  end if;
  if d.expires_at is not null and d.expires_at <= now() then
    return jsonb_build_object('ok', false, 'message', 'That code has expired.');
  end if;
  if d.max_uses is not null and d.times_used >= d.max_uses then
    return jsonb_build_object('ok', false, 'message', 'That code has been fully used.');
  end if;
  if d.first_order_only and (coalesce(p_email, '') <> '' or coalesce(p_phone, '') <> '') and exists (
    select 1 from public.orders o
    where o.status not in ('cancelled', 'awaiting_payment')
      and (
        (coalesce(p_email, '') <> '' and lower(o.email) = lower(trim(p_email)))
        or (length(public.phone_key(p_phone)) >= 7 and public.phone_key(o.phone) = public.phone_key(p_phone))
      )
  ) then
    return jsonb_build_object('ok', false, 'message', 'That code is for your first order only — it looks like you''ve ordered with us before.');
  end if;
  return jsonb_build_object('ok', true, 'code', d.code, 'percent_off', d.percent_off);
end;
$$;


-- ============================================================
-- create_order: now also re-checks the code (with the code locked, so two
-- orders can't both take its last use) and counts the use when the stock is taken.
-- ============================================================
create or replace function public.create_order(p_order jsonb, p_stock_lines jsonb, p_take_stock boolean)
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
  v_code text := nullif(upper(trim(p_order->>'discount_code')), '');
  verdict jsonb;
begin
  if v_code is not null then
    perform 1 from public.discount_codes where discount_codes.code = v_code for update;
    verdict := public.check_discount(v_code, p_order->>'email', p_order->>'phone');
    if not (verdict->>'ok')::boolean then
      raise exception 'DISCOUNT_INVALID' using detail = verdict->>'message';
    end if;
  end if;

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

  if v_code is not null and p_take_stock then
    update public.discount_codes set times_used = times_used + 1 where discount_codes.code = v_code;
  end if;

  insert into public.orders (
    source, status, payment_method, ziina_payment_id,
    customer_name, email, phone, address,
    delivery_option, delivery_text, bracelet_size, base_color,
    items, discount_code, subtotal_aed, discount_aed, delivery_fee_aed, total_aed, notes,
    stock_lines, stock_taken, discount_counted, email_template, email_params
  ) values (
    p_order->>'source', p_order->>'status', p_order->>'payment_method', p_order->>'ziina_payment_id',
    p_order->>'customer_name', p_order->>'email', p_order->>'phone', p_order->>'address',
    p_order->>'delivery_option', p_order->>'delivery_text', p_order->>'bracelet_size', p_order->>'base_color',
    p_order->'items', v_code,
    (p_order->>'subtotal_aed')::numeric, (p_order->>'discount_aed')::numeric,
    (p_order->>'delivery_fee_aed')::numeric, (p_order->>'total_aed')::numeric, p_order->>'notes',
    p_stock_lines, p_take_stock, v_code is not null and p_take_stock, p_order->>'email_template', p_order->'email_params'
  )
  returning id, order_number into new_id, new_number;

  return jsonb_build_object('id', new_id, 'order_number', new_number);
end;
$$;


-- ============================================================
-- mark_order_paid: now also counts the code's use once the Ziina payment is in
-- ============================================================
create or replace function public.mark_order_paid(p_ziina_payment_id text)
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
    if o.discount_code is not null and not o.discount_counted then
      update public.discount_codes set times_used = times_used + 1 where code = o.discount_code;
    end if;
    update public.orders
      set status = 'paid', stock_taken = true, discount_counted = (o.discount_code is not null)
      where id = o.id;
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
-- Cancelling an order gives its stock back — and its discount code use
-- ============================================================
create or replace function public.give_back_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  line record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if old.stock_taken then
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
    if old.discount_counted and old.discount_code is not null then
      update public.discount_codes set times_used = greatest(times_used - 1, 0) where code = old.discount_code;
      new.discount_counted := false;
    end if;
  end if;
  return new;
end;
$$;


-- ============================================================
-- Only the builder's server may call these
-- ============================================================
revoke all on function public.check_discount(text, text, text) from public, anon, authenticated;
revoke all on function public.create_order(jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.mark_order_paid(text) from public, anon, authenticated;
grant execute on function public.check_discount(text, text, text) to service_role;
grant execute on function public.create_order(jsonb, jsonb, boolean) to service_role;
grant execute on function public.mark_order_paid(text) to service_role;
