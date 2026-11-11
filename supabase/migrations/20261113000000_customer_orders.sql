-- Navillera: customers see and cancel their own orders.
-- Run once in the Supabase dashboard → SQL Editor → New query → paste → Run (after discount_codes).
--
-- Customers reach their orders two ways:
--   - signed in on navillera.vercel.app/account (email + one-time code): every order with their email
--   - the private "Manage my order" link in each order email: that one order
-- Cancelling online: only Cash on Delivery orders that are still 'pending' (nothing has been paid).
-- Paid online (Ziina) and Bank Transfer orders can't be cancelled on the site — customers are
-- asked to message the shop on Instagram or WhatsApp about cancelling or a refund.
-- Set an order to 'preparing' when you start making it.


-- New status: preparing (you've started making it)
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('awaiting_payment', 'pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'));

comment on column public.orders.status is 'awaiting_payment = sent to Ziina, not paid yet; pending = Cash on Delivery / Bank Transfer to confirm; paid; preparing = you''ve started making it (customers can''t cancel any more); shipped; delivered; cancelled (gives stock and promo use back).';

alter table public.orders
  add column manage_token        uuid not null default gen_random_uuid() unique,  -- the private "Manage my order" link
  add column cancel_reason       text,          -- what the customer wrote when cancelling
  add column cancelled_at        timestamptz,
  add column cancelled_by        text check (cancelled_by in ('customer', 'shop'));

comment on column public.orders.manage_token is 'Internal: the secret in the order''s "Manage my order" link.';

-- Note when (and by whom) an order is cancelled, whichever way it happens
create function public.note_cancelled()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, 'shop');
  end if;
  return new;
end;
$$;

create trigger orders_note_cancelled
  before update of status on public.orders
  for each row execute function public.note_cancelled();


-- ============================================================
-- What a customer may see of an order (no internal columns)
-- ============================================================
create function public.order_for_customer(o public.orders)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'created_at', o.created_at,
    'status', o.status,
    'payment_method', o.payment_method,
    'customer_name', o.customer_name,
    'delivery_text', o.delivery_text,
    'bracelet_size', o.bracelet_size,
    'base_color', o.base_color,
    'items', o.items,
    'source', o.source,
    'discount_code', o.discount_code,
    'subtotal_aed', o.subtotal_aed,
    'discount_aed', o.discount_aed,
    'delivery_fee_aed', o.delivery_fee_aed,
    'total_aed', o.total_aed,
    'cancelled_at', o.cancelled_at,
    'cancelled_by', o.cancelled_by,
    -- Only Cash on Delivery orders not started yet can be cancelled on the site
    'can_cancel', o.status = 'pending' and o.payment_method = 'cod'
  )
$$;


-- Every order placed with this email, newest first (orders never paid online are left out)
create function public.customer_orders(p_email text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.order_for_customer(o) order by o.created_at desc), '[]'::jsonb)
  from public.orders o
  where lower(o.email) = lower(trim(p_email))
    and o.status <> 'awaiting_payment'
$$;


-- The one order behind a "Manage my order" link (null if none)
create function public.order_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.order_for_customer(o)
  from public.orders o
  where o.manage_token = p_token and o.status <> 'awaiting_payment'
$$;


-- ============================================================
-- customer_cancel_order: the customer's Cancel button (Cash on Delivery, still pending).
-- The order must belong to them: p_email (signed in) or p_token (their link).
-- Returns {result: 'cancelled' | 'not_allowed' | 'not_found', order: …}
-- ============================================================
create function public.customer_cancel_order(p_order_id uuid, p_email text, p_token uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  result text;
begin
  select * into o from public.orders
    where id = p_order_id
      and status <> 'awaiting_payment'
      and ((p_email is not null and lower(email) = lower(trim(p_email)))
        or (p_token is not null and manage_token = p_token))
    for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  if o.status = 'pending' and o.payment_method = 'cod' then
    update public.orders
      set status = 'cancelled', cancelled_by = 'customer', cancelled_at = now(), cancel_reason = nullif(trim(p_reason), '')
      where id = o.id;          -- the existing trigger gives the stock and the promo code use back
    result := 'cancelled';
  else
    result := 'not_allowed';
  end if;

  select * into o from public.orders where id = o.id;
  return jsonb_build_object('result', result, 'order', public.order_for_customer(o));
end;
$$;


-- The private "Manage my order" link for an order (for its email)
create or replace function public.order_link_token(p_order_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select manage_token from public.orders where id = p_order_id $$;


-- ============================================================
-- Only the builder's server may call these
-- ============================================================
revoke all on function public.order_for_customer(public.orders) from public, anon, authenticated;
revoke all on function public.customer_orders(text) from public, anon, authenticated;
revoke all on function public.order_by_token(uuid) from public, anon, authenticated;
revoke all on function public.customer_cancel_order(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.order_link_token(uuid) from public, anon, authenticated;
revoke all on function public.note_cancelled() from public, anon, authenticated;
grant execute on function public.customer_orders(text) to service_role;
grant execute on function public.order_by_token(uuid) to service_role;
grant execute on function public.customer_cancel_order(uuid, text, uuid, text) to service_role;
grant execute on function public.order_link_token(uuid) to service_role;
