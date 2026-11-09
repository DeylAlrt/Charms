# Supabase setup: notes for the main site (navilleracharms.com)

The charm builder (navillera.vercel.app, this repo) and the main site share one Supabase project.
The SQL lives in this repo's `supabase/` folder.

## Connection (safe to put in website code)

| | |
|---|---|
| Project URL | `https://bdmblwuvbcfosadnmskv.supabase.co` |
| Publishable key | `sb_publishable_pJ9zqlsj92-PfgkMmntg3w_6Zz3h588` |

The publishable key can only **read active products**. The secret key is only in the builder's
Vercel settings (`SUPABASE_SECRET_KEY`). Never put it in the main site.

## Tables

### `products` (readable by websites; hidden products are never returned)

| Column | Meaning |
|---|---|
| `id` | uuid |
| `name` | Shown on the site, e.g. "Star" |
| `category` | Collection page: `links`, `bracelets`, `watch`, `keychain` (matches `collection.html?category=…`) |
| `section` | Group heading, e.g. "Concave Links", "Gold Concave Links", "Apple Watch Connectors — 44/45/46mm" |
| `builder_category` | The builder's category (empty = not sold in the builder) |
| `kind` | `charm`, `plain`, `twin_chain`, `dangling`, `magnet`, `watch`, `other` |
| `metal` | `silver`, `gold` or empty |
| `price_aed` | Price in AED |
| `image_path` | Photo file name as used today, e.g. `Concave Links/Concave_Silver_Links (1).png` |
| `image_url` | Full photo link (ImageKit) for products added later; use it when `image_path` is empty |
| `sold_out` | true = show as sold out (still listed, can't be added to the cart) |
| `stock` | empty = unlimited; a number counts down with orders; **0 also means sold out** |
| `is_active` | false = hidden (websites never receive these rows) |
| `sort_order` | Order within a section (lower first) |

**Sold out = `sold_out` is true OR `stock` is 0.**

Products are unique by **`section` + `image_path`**. That pair is also the main site cart's item key:
`"<section>::<image_path>"`. The builder's server prices main-site orders by that key, so the cart must
keep using `subcollection = section` and `file = image_path`.

### `orders` and `discount_codes`
No website access at all. Orders are created only by the builder's server (see below).

## How the collection pages should load products

One request per page, filtered by category, in display order:

```js
const SUPABASE_URL = 'https://bdmblwuvbcfosadnmskv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pJ9zqlsj92-PfgkMmntg3w_6Zz3h588';

async function loadProducts(category) {        // 'links' | 'bracelets' | 'watch' | 'keychain'
  const url = `${SUPABASE_URL}/rest/v1/products`
    + `?select=name,section,metal,price_aed,image_path,image_url,sold_out,stock,sort_order`
    + `&category=eq.${category}&order=section,sort_order`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error('Could not load products');
  return res.json();   // [{ name, section, price_aed, image_path, sold_out, stock, ... }]
}
```

- Group the rows by `section` to build the page's sections. The order of sections themselves is up to
  the page; the old `catalogue-data.js` order is a good default.
- `isSoldOut = row.sold_out || row.stock === 0`
- The photo is `row.image_path` (same files/ImageKit paths as today) or `row.image_url` when
  `image_path` is empty.
- **Keep `catalogue-data.js` as a fallback** if the request fails, so the page never shows empty.
- No library is needed (plain `fetch`). `@supabase/supabase-js` works too if preferred.

## Orders from the main site (already live on the builder's server)

The main site doesn't talk to Supabase for orders. It posts to the builder's server, which recalculates
everything from the `products` table:

| What | Endpoint (POST, JSON) |
|---|---|
| Cash on Delivery / Bank Transfer | `https://navillera.vercel.app/api/shop-order` |
| Pay online (Ziina) | `https://navillera.vercel.app/api/shop-payment-intent` (returns `redirect_url`) |
| Contact form | `https://navillera.vercel.app/api/contact` |

Order body: `name, phone, email, address, notes, deliveryOptionId, paymentMethod ('cod'|'bank'),
promoCode, items: [{ subcollection, file, qty }], website, turnstileToken`
(+ `returnPath` for Ziina). Contact body: `name, email, message, website, turnstileToken`.

- **No prices are sent.** The server prices from Supabase.
- `website` is a hidden "honeypot" field that must stay empty. Bots fill it in.
- `turnstileToken` comes from the Cloudflare Turnstile widget, once its keys are set up.
- Send orders here instead of calling EmailJS from the browser: the server sends the emails.
  (These main site changes were lost when the old folder was removed and still need redoing there.)
