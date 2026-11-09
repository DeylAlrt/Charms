-- Navillera: products, orders and discount codes.
-- Run once in the Supabase dashboard → SQL Editor → New query → paste → Run.
--
-- Who can do what:
--   products        anyone can READ active products (the websites need them); nobody can change them from a website
--   orders          no public access at all; only the builder's server (secret key) reads and writes them
--   discount_codes  no public access at all; only the builder's server checks them
-- You can always see and edit everything yourself in the dashboard's Table Editor.


-- ============================================================
-- products: every charm, link, watch, bracelet and keychain
-- ============================================================
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                    -- shown on the sites, e.g. "Star"
  category      text not null                     -- which collection page it's on
                check (category in ('links', 'bracelets', 'watch', 'keychain')),
  section       text not null,                    -- the group it's listed under, e.g. "Gold Premium Charms"
  builder_category text,                          -- the charm builder's category pill, e.g. "Premium Charms" (empty = not in the builder)
  kind          text not null default 'charm'     -- how the builder places it on a bracelet
                check (kind in ('charm', 'plain', 'twin_chain', 'dangling', 'magnet', 'watch', 'other')),
  metal         text check (metal in ('silver', 'gold')),
  price_aed     numeric(10, 2) not null check (price_aed >= 0),
  image_path    text,                             -- the photo inside the sites, e.g. "Premium Links/Premium_Silver_Links (1).png"
  image_url     text,                             -- or a full photo link (e.g. ImageKit) for products added later
  sold_out      boolean not null default false,   -- tick to show it as sold out
  stock         integer check (stock >= 0),       -- empty = unlimited; a number counts down with each order (0 = sold out)
  is_active     boolean not null default true,    -- untick to hide it from the sites completely
  sort_order    integer not null default 0,       -- lower numbers are listed first within a section
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (image_path is not null or image_url is not null),
  unique (section, image_path)                    -- the same photo can be in two sections (e.g. connector sizes)
);

create index products_listing_idx on public.products (category, section, sort_order) where is_active;

comment on table  public.products is 'Everything sold on navilleracharms.com and the charm builder. Edit prices, sold out, stock and visibility here.';
comment on column public.products.sold_out is 'Tick to show the item as sold out (it stays visible but cannot be ordered).';
comment on column public.products.stock is 'Leave empty for unlimited. A number is counted down by each order and given back if the order is cancelled; 0 means sold out.';
comment on column public.products.is_active is 'Untick to hide the item from both websites.';


-- ============================================================
-- orders: every order from both websites, saved before any email is sent
-- ============================================================
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    bigint generated always as identity (start with 1001) unique,  -- short number for emails and WhatsApp, e.g. #1001
  created_at      timestamptz not null default now(),
  source          text not null check (source in ('builder', 'shop')),           -- charm builder or main site cart
  status          text not null default 'pending'
                  check (status in ('awaiting_payment', 'pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  payment_method  text not null check (payment_method in ('ziina', 'cod', 'bank')),
  ziina_payment_id text unique,
  customer_name   text not null,
  email           text not null,
  phone           text not null,
  address         text,
  delivery_option text not null,                  -- e.g. "metro-dmcc"
  delivery_text   text not null,                  -- e.g. "Metro meet-up: DMCC Metro (Thursday or Friday)"
  bracelet_size   text,                           -- builder orders, e.g. "18 charms"
  base_color      text,                           -- builder orders
  items           jsonb not null,                 -- what was ordered, with the prices charged
  discount_code   text,
  subtotal_aed    numeric(10, 2) not null,        -- items, before the discount
  discount_aed    numeric(10, 2) not null default 0,
  delivery_fee_aed numeric(10, 2) not null default 0,
  total_aed       numeric(10, 2) not null,
  notes           text,
  email_sent_at   timestamptz,                    -- empty = the order email hasn't gone out (yet)
  stock_taken     boolean not null default false  -- internal: whether this order has counted stock down
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_phone_idx on public.orders (phone);
create index orders_email_idx on public.orders (lower(email));

comment on table public.orders is 'Every order from both websites. Change the status here as you pack, ship and deliver.';
comment on column public.orders.status is 'awaiting_payment = sent to Ziina but not paid yet; pending = Cash on Delivery / Bank Transfer to confirm; paid; shipped; delivered; cancelled (gives stock back).';


-- ============================================================
-- discount_codes
-- ============================================================
create table public.discount_codes (
  code             text primary key check (code = upper(code)),
  percent_off      numeric(5, 2) not null check (percent_off > 0 and percent_off <= 100),
  first_order_only boolean not null default false,
  expires_at       timestamptz,                   -- empty = never expires
  max_uses         integer check (max_uses > 0),  -- empty = unlimited
  times_used       integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

comment on table public.discount_codes is 'Promo codes. Codes are written in CAPITALS. percent_off 5 = 5% off the items (not delivery).';

insert into public.discount_codes (code, percent_off, first_order_only) values ('NEWBABE', 5, true);


-- ============================================================
-- Keep products.updated_at current
-- ============================================================
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();


-- ============================================================
-- Security (Row Level Security)
-- ============================================================
alter table public.products       enable row level security;
alter table public.orders         enable row level security;
alter table public.discount_codes enable row level security;

-- Websites may read products that aren't hidden. No insert/update/delete policies,
-- so websites can't change anything.
create policy "Anyone can see active products"
  on public.products for select
  to anon, authenticated
  using (is_active);

-- orders and discount_codes get NO policies: websites can't read or write them.
-- The builder's server uses the secret key, which skips these rules.
revoke all on public.orders, public.discount_codes from anon, authenticated;
revoke insert, update, delete, truncate on public.products from anon, authenticated;
