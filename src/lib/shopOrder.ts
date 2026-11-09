import { describeDelivery, getDeliveryOption, DELIVERY_DATE_TEXT } from '@/components/charmEditor/orderOptions';
import { checkContactDetails, text } from './antiSpam';
import { PROMO_CODES } from './orderPricing';
import { getSiteItem } from './siteCatalogue';
import type { NewOrder, StockLine } from './orderStore';
import { productIdForSiteKey } from './products';

/**
 * A main site cart order (navilleracharms.com, Js_Folder/cart.js),
 * priced and described on the server from the products in Supabase — the browser's
 * prices, totals and item names are never used.
 */

/** Any page may call the main site's order routes (the live site, a local preview, a file opened from disk). */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const IMAGE_URL = (file: string) =>
  `https://navillera.vercel.app/_next/image?url=${encodeURIComponent('/charms/' + file)}&w=256&q=75`;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const round2 = (n: number) => Math.round(n * 100) / 100;

type PricedLine = { label: string; section: string; file: string; price: number; qty: number };

export type ShopOrder = {
  customer: { name: string; phone: string; email: string; notes: string };
  lines: PricedLine[];
  deliveryOptionId: string;
  address: string;
  meetupPlace: string;
  code: string;
  itemsTotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
};

/** Reads and prices the cart. Throws an Error with a customer-readable message. */
export function readShopOrder(body: Record<string, unknown>): ShopOrder {
  const name = text(body.name, 100);
  const phone = text(body.phone, 30);
  const email = text(body.email, 254);
  const problem = checkContactDetails(email, phone, name);
  if (problem) throw new Error(problem);

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) throw new Error('Your cart is empty.');

  const lines: PricedLine[] = [];
  for (const it of items) {
    const entry = getSiteItem(`${it?.subcollection}::${it?.file}`);
    const qty = Number(it?.qty);
    if (!entry) throw new Error('Something in your cart is no longer available — please remove it and try again.');
    if (entry.soldOut) throw new Error(`"${entry.label}" is sold out — please remove it from your cart.`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error('Please check the quantities in your cart.');
    lines.push({ ...entry, qty });
  }

  const delivery = typeof body.deliveryOptionId === 'string' ? getDeliveryOption(body.deliveryOptionId) : undefined;
  if (!delivery) throw new Error('Please choose how you want to get your order.');
  const address = text(body.address, 300);
  if (delivery.needsAddress && !address) throw new Error('Please type your home address.');

  const code = text(body.promoCode, 30).toUpperCase();
  const percent = code ? PROMO_CODES[code] ?? 0 : 0;

  const itemsTotal = round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const discount = round2(itemsTotal * percent);
  return {
    customer: { name, phone, email, notes: text(body.notes, 1000) },
    lines,
    deliveryOptionId: delivery.id,
    address,
    meetupPlace: describeDelivery(delivery, address),
    code: percent ? code : '',
    itemsTotal,
    discount,
    deliveryFee: delivery.fee,
    total: round2(itemsTotal - discount + delivery.fee),
  };
}

/** Same layout as the main site's order email used to have (cart.js → buildOrderItemsHtml). */
function buildItemsHtml(order: ShopOrder): string {
  const cards = order.lines.map(l => `
    <tr><td style="padding:0 0 10px;">
      <table style="width:100%; border-collapse:collapse; background:#f7f9fc; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="width:72px; padding:12px;"><img src="${IMAGE_URL(l.file)}" alt="${escapeHtml(l.label)}" width="60" height="60" style="width:60px;height:60px;object-fit:contain;border-radius:8px;background:#ffffff;display:block;"></td>
          <td style="padding:12px 12px 12px 0; font-family:Arial,sans-serif; color:#1a2a44;">
            <div style="font-size:16px; font-weight:bold;">${escapeHtml(l.label)}</div>
            <div style="font-size:12px; color:#6b7a90; margin-top:2px;">${escapeHtml(l.section)}</div>
            <div style="font-size:13px; margin-top:6px;">Qty: ${l.qty} &middot; ${l.price.toFixed(2)} AED each</div>
          </td>
          <td style="padding:12px; font-family:Arial,sans-serif; font-size:15px; font-weight:bold; color:#1a2a44; text-align:right; white-space:nowrap; vertical-align:middle;">${(l.price * l.qty).toFixed(2)} AED</td>
        </tr>
      </table>
    </td></tr>`).join('');
  const discountRow = order.discount > 0 ? `
    <tr><td style="padding:0 0 10px;">
      <table style="width:100%; border-collapse:collapse; background:#e9f7ee; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="padding:12px; font-family:Arial,sans-serif; color:#2e7d4f;"><div style="font-size:15px; font-weight:bold;">Promo code applied: ${escapeHtml(order.code)}</div></td>
          <td style="padding:12px; font-family:Arial,sans-serif; font-size:15px; font-weight:bold; color:#2e7d4f; text-align:right; white-space:nowrap;">-${order.discount.toFixed(2)} AED</td>
        </tr>
      </table>
    </td></tr>` : '';
  return `<table style="width:100%; border-collapse:collapse;">${cards}${discountRow}</table>`;
}

/** The main site's EmailJS order email. */
export function shopEmailParams(order: ShopOrder, payment: string): Record<string, string> {
  const { customer } = order;
  return {
    to_email: 'sales.navilleracharms@gmail.com',
    customer_name: customer.name,
    phone: customer.phone,
    customer_email: customer.email,
    pickup_time: '',
    meetup_place: order.meetupPlace,
    delivery_date: DELIVERY_DATE_TEXT,
    payment_method: payment,
    subtotal: order.itemsTotal.toFixed(2),
    promo_code: order.code || 'None',
    discount: order.discount.toFixed(2),
    delivery_fee: order.deliveryFee.toFixed(2),
    total: order.total.toFixed(2),
    // Payment is repeated in the notes so it shows even in a template without {{payment_method}}.
    notes: customer.notes ? `Payment: ${payment}\n${customer.notes}` : `Payment: ${payment}`,
    items_html: buildItemsHtml(order),
  };
}

/** The order as saved in Supabase, and the stock it uses. */
export function shopRecord(
  order: ShopOrder,
  payment: { method: 'ziina' | 'cod' | 'bank'; label: string },
  ziinaPaymentId?: string,
): { record: NewOrder; stockLines: StockLine[] } {
  const { customer } = order;
  const stockLines = order.lines
    .map(l => ({ product_id: productIdForSiteKey(`${l.section}::${l.file}`), qty: l.qty }))
    .filter((l): l is StockLine => !!l.product_id);
  return {
    record: {
      source: 'shop',
      status: payment.method === 'ziina' ? 'awaiting_payment' : 'pending',
      payment_method: payment.method,
      ziina_payment_id: ziinaPaymentId,
      customer_name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: order.address || undefined,
      delivery_option: order.deliveryOptionId,
      delivery_text: order.meetupPlace,
      items: order.lines.map(l => ({ name: l.label, section: l.section, file: l.file, qty: l.qty, unit_price_aed: l.price })),
      discount_code: order.code || undefined,
      subtotal_aed: order.itemsTotal,
      discount_aed: order.discount,
      delivery_fee_aed: order.deliveryFee,
      total_aed: order.total,
      notes: customer.notes || undefined,
      email_template: 'site',
      email_params: shopEmailParams(order, payment.label),
    },
    stockLines,
  };
}
