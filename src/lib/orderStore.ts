import { sendOrderNotificationEmail } from './emailNotify';
import { SUPABASE_URL } from './products';
import { BUILDER_URL } from './siteUrls';

/**
 * Saving orders in Supabase (server only). Uses SUPABASE_SECRET_KEY from
 * Vercel's environment variables. That key can do anything in the database,
 * so it must never reach a browser or the repo.
 *
 * The SQL behind these lives in supabase/migrations/20261111000000_order_saving.sql.
 */

/** A product in the order ran out (stock reached 0) — the customer is told which. */
export class OutOfStockError extends Error {
  constructor(public productName: string) {
    super(`Sorry, "${productName}" just sold out — please remove it and try again.`);
  }
}

/** One product's share of an order's stock. */
export type StockLine = { product_id: string; qty: number };

export type NewOrder = {
  source: 'builder' | 'shop';
  status: 'awaiting_payment' | 'pending';
  payment_method: 'ziina' | 'cod' | 'bank';
  ziina_payment_id?: string;
  customer_name: string;
  email: string;
  phone: string;
  address?: string;
  delivery_option: string;
  delivery_text: string;
  bracelet_size?: string;
  base_color?: string;
  items: unknown;
  discount_code?: string;
  subtotal_aed: number;
  discount_aed: number;
  delivery_fee_aed: number;
  total_aed: number;
  notes?: string;
  email_template: 'builder' | 'site';
  email_params: Record<string, string>;
};

function secretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set in the environment.');
  return key;
}

function headers(): Record<string, string> {
  const key = secretKey();
  // New-style keys (sb_secret_…) go in `apikey` only; an old service_role key also needs Authorization.
  return key.startsWith('sb_')
    ? { apikey: key, 'Content-Type': 'application/json' }
    : { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  if (!res.ok) {
    let error: { message?: string; details?: string } = {};
    try { error = JSON.parse(text); } catch {}
    if (error.message === 'OUT_OF_STOCK') throw new OutOfStockError(error.details || 'an item');
    if (error.message === 'DISCOUNT_INVALID') throw new DiscountInvalidError(error.details || "That code isn't valid.");
    throw new Error(`Supabase ${fn} failed (${res.status}): ${text}`);
  }
  return JSON.parse(text) as T;
}

/**
 * Saves an order. With takeStock, the stock is taken now (Cash on Delivery /
 * Bank Transfer); without, it's only checked, and taken once paid (Ziina).
 * Throws OutOfStockError if something ran out.
 */
export function saveOrder(order: NewOrder, stockLines: StockLine[], takeStock: boolean) {
  return rpc<{ id: string; order_number: number }>('create_order', {
    p_order: order,
    p_stock_lines: stockLines,
    p_take_stock: takeStock,
  });
}

export type PaidOrder = {
  id: string;
  order_number: number;
  email_template: 'builder' | 'site';
  email_params: Record<string, string>;
  email_sent: boolean;
};

/** Marks a Ziina order as paid (and takes its stock). Null if no order has that payment. Safe to repeat. */
export function markOrderPaid(ziinaPaymentId: string) {
  return rpc<PaidOrder | null>('mark_order_paid', { p_ziina_payment_id: ziinaPaymentId });
}

/** Notes that the order email went out. */
export async function markEmailSent(orderId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ email_sent_at: new Date().toISOString() }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Supabase could not mark the email sent (${res.status}): ${await res.text()}`);
}

/**
 * Puts the order number in the email: in its own field (add {{order_number}}
 * to the EmailJS template to show it anywhere) and at the top of the notes,
 * which every template already shows.
 */
export function withOrderNumber(params: Record<string, string>, orderNumber: number | null, manageToken: string | null = null): Record<string, string> {
  if (orderNumber === null) {
    return { ...params, order_number: 'not saved', manage_url: '', notes: `(Saved by email only — the database was unavailable)\n${params.notes ?? ''}` };
  }
  // The private "Manage my order" link (also at the top of the notes, which every template shows)
  const manageUrl = manageToken ? `${BUILDER_URL}/order/${manageToken}` : '';
  const linkLine = manageUrl ? `View or cancel your order: ${manageUrl}\n` : '';
  return { ...params, order_number: `#${orderNumber}`, manage_url: manageUrl, notes: `Order #${orderNumber}\n${linkLine}${params.notes ?? ''}` };
}

/**
 * Cash on Delivery / Bank Transfer: saves the order (taking stock), then emails it.
 * - Out of stock: throws OutOfStockError (nothing saved, nothing sent).
 * - Supabase unavailable: the email still goes out, marked as not saved, so the order isn't lost.
 * - Saved but the email failed: still counts — the order is in Supabase.
 * Returns the order number (null if only emailed).
 */
export async function placeOrderNow(record: NewOrder, stockLines: StockLine[]): Promise<{ orderNumber: number | null }> {
  let saved: { id: string; order_number: number } | null = null;
  try {
    saved = await saveOrder(record, stockLines, true);
  } catch (err) {
    if (err instanceof OutOfStockError || err instanceof DiscountInvalidError) throw err;
    console.error('Could not save the order in Supabase — sending the email anyway:', err);
  }

  try {
    const token = saved ? await orderLinkToken(saved.id).catch(() => null) : null;
    await sendOrderNotificationEmail(withOrderNumber(record.email_params, saved?.order_number ?? null, token), record.email_template);
  } catch (err) {
    if (!saved) throw err; // neither saved nor emailed: the customer must try again
    console.error(`Order #${saved.order_number} is saved but its email failed:`, err);
    return { orderNumber: saved.order_number };
  }

  if (saved) {
    try {
      await markEmailSent(saved.id);
    } catch (err) {
      console.error(`Order #${saved.order_number}: could not note that the email was sent:`, err);
    }
  }
  return { orderNumber: saved?.order_number ?? null };
}

// ---------------------------------------------------------------------------
// Discount codes (rules in supabase/migrations/20261112000000_discount_codes.sql)
// ---------------------------------------------------------------------------

/** The promo code can't be used (unknown, expired, used up, or not the customer's first order). */
export class DiscountInvalidError extends Error {}

export type Discount = { code: string; percent: number };

/**
 * Checks a promo code (with the customer's email and WhatsApp number, for
 * first-order-only codes). Returns null when no code was given; throws
 * DiscountInvalidError with a message for the customer otherwise.
 */
export async function resolveDiscount(code: string, email?: string, phone?: string): Promise<Discount | null> {
  if (!code) return null;
  let verdict: { ok: boolean; code?: string; percent_off?: number | string; message?: string };
  try {
    verdict = await rpc('check_discount', { p_code: code, p_email: email || null, p_phone: phone || null });
  } catch (err) {
    console.error('Could not check the promo code:', err);
    throw new DiscountInvalidError("We couldn't check the promo code right now — please try again in a minute, or remove it.");
  }
  if (!verdict.ok) throw new DiscountInvalidError(verdict.message || "That code isn't valid.");
  return { code: verdict.code!, percent: Number(verdict.percent_off) / 100 };
}

// ---------------------------------------------------------------------------
// Customers' own orders (rules in supabase/migrations/20261113000000_customer_orders.sql)
// ---------------------------------------------------------------------------

/** What a customer sees of an order. */
export type CustomerOrder = {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  payment_method: 'ziina' | 'cod' | 'bank';
  customer_name: string;
  delivery_text: string;
  bracelet_size: string | null;
  base_color: string | null;
  items: unknown;
  source: 'builder' | 'shop';
  discount_code: string | null;
  subtotal_aed: number;
  discount_aed: number;
  delivery_fee_aed: number;
  total_aed: number;
  cancelled_at: string | null;
  cancelled_by: 'customer' | 'shop' | null;
  can_cancel: boolean;
};

/** The secret in an order's "Manage my order" link. */
export function orderLinkToken(orderId: string) {
  return rpc<string | null>('order_link_token', { p_order_id: orderId });
}

/** Every order placed with this (signed-in) email, newest first. */
export function customerOrders(email: string) {
  return rpc<CustomerOrder[]>('customer_orders', { p_email: email });
}

/** The order behind a "Manage my order" link, or null. */
export function orderByToken(token: string) {
  return rpc<CustomerOrder | null>('order_by_token', { p_token: token });
}

/** The customer's Cancel button. The order must be theirs: signed-in email, or its link. */
export function customerCancelOrder(orderId: string, owner: { email?: string; token?: string }, reason: string) {
  return rpc<{ result: 'cancelled' | 'not_allowed' | 'not_found'; order?: CustomerOrder }>('customer_cancel_order', {
    p_order_id: orderId,
    p_email: owner.email ?? null,
    p_token: owner.token ?? null,
    p_reason: reason,
  });
}

/** Emails the shop that a customer cancelled (with the contact form's EmailJS template). */
export async function notifyShopOfCancellation(order: CustomerOrder, reason: string, how: string) {
  await sendOrderNotificationEmail({
    name: order.customer_name,
    title: `Order #${order.order_number} cancelled by the customer`,
    time: new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' }),
    email: '',
    message: [
      `Order #${order.order_number} (${order.total_aed} AED, Cash on Delivery) was cancelled by the customer ${how}.`,
      'Its stock and any promo code use were given back automatically.',
      reason ? `Reason: ${reason}` : 'No reason given.',
    ].join('\n'),
  }, 'contact');
}
