import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/ziina';
import { savePendingPayment } from '@/lib/pendingPayments';
import { PROMO_CODES } from '@/lib/orderPricing';
import { SITE_ITEMS } from '@/lib/siteCatalogue';
import { describeDelivery, getDeliveryOption, DELIVERY_DATE_TEXT } from '@/components/charmEditor/orderOptions';

/**
 * Starts a Ziina payment for the MAIN SITE's cart (navilleracharms.vercel.app,
 * Js_Folder/cart.js). Works like /api/create-payment-intent for the builder:
 *   - the amount is computed here from SITE_ITEMS — the browser's prices
 *     and totals are never trusted
 *   - the order is only stashed as "pending"; /api/ziina-webhook logs it and
 *     emails the shop once Ziina confirms the payment
 *   - the customer is sent to Ziina's page and back to the page they came from
 */

const SITE_ORIGIN = 'https://navilleracharms.vercel.app';

// Any page may call this (the live site, a local preview, a file opened from
// disk). Restricting browsers wouldn't add safety: the price is always worked
// out here, and no cookies or secrets are involved.
const CORS_HEADERS = {
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

/** Same layout as the main site's order email (cart.js → buildOrderItemsHtml). */
function buildItemsHtml(lines: PricedLine[], discount: number, promoCode: string): string {
  const cards = lines.map(l => `
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
  const discountRow = discount > 0 ? `
    <tr><td style="padding:0 0 10px;">
      <table style="width:100%; border-collapse:collapse; background:#e9f7ee; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="padding:12px; font-family:Arial,sans-serif; color:#2e7d4f;"><div style="font-size:15px; font-weight:bold;">Promo code applied: ${escapeHtml(promoCode)}</div></td>
          <td style="padding:12px; font-family:Arial,sans-serif; font-size:15px; font-weight:bold; color:#2e7d4f; text-align:right; white-space:nowrap;">-${discount.toFixed(2)} AED</td>
        </tr>
      </table>
    </td></tr>` : '';
  return `<table style="width:100%; border-collapse:collapse;">${cards}${discountRow}</table>`;
}

/** Return address on the main site, e.g. "/collection.html?category=links" — anything else falls back to the home page. */
function returnUrl(returnPath: unknown, outcome: 'success' | 'cancel' | 'failed'): string {
  let url: URL;
  try {
    url = new URL(typeof returnPath === 'string' && returnPath.startsWith('/') ? returnPath : '/index.html', SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN) throw new Error('other site');
  } catch {
    url = new URL('/index.html', SITE_ORIGIN);
  }
  url.hash = '';
  url.searchParams.set('ziina', outcome);
  return url.toString();
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const headers = CORS_HEADERS;
  const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers });

  try {
    const { name, phone, email, address, notes, items, deliveryOptionId, promoCode, returnPath } = await request.json();

    if (![name, phone, email].every(v => typeof v === 'string' && v.trim())) return fail('Please fill in your email, WhatsApp number and name.');
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) return fail('Your cart is empty.');

    // --- Price the cart from the catalogue (never from the browser) ---
    const lines: PricedLine[] = [];
    for (const it of items) {
      const entry = SITE_ITEMS.get(`${it?.subcollection}::${it?.file}`);
      const qty = Number(it?.qty);
      if (!entry) return fail('Something in your cart is no longer available — please remove it and try again.');
      if (entry.soldOut) return fail(`"${entry.label}" is sold out — please remove it from your cart.`);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) return fail('Please check the quantities in your cart.');
      lines.push({ ...entry, qty });
    }

    const delivery = typeof deliveryOptionId === 'string' ? getDeliveryOption(deliveryOptionId) : undefined;
    if (!delivery) return fail('Please choose how you want to get your order.');
    if (delivery.needsAddress && !(typeof address === 'string' && address.trim())) return fail('Please type your home address.');

    const code = typeof promoCode === 'string' ? promoCode.trim().toUpperCase() : '';
    const percent = code ? PROMO_CODES[code] ?? 0 : 0;

    const itemsTotal = round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
    const discount = round2(itemsTotal * percent);
    const total = round2(itemsTotal - discount + delivery.fee);

    const meetupPlace = describeDelivery(delivery, typeof address === 'string' ? address : '');
    const note = typeof notes === 'string' ? notes.trim().slice(0, 1000) : '';

    const intent = await createPaymentIntent({
      amountAed: total,
      message: `Navillera order — ${String(name).trim()}`,
      successUrl: returnUrl(returnPath, 'success'),
      cancelUrl: returnUrl(returnPath, 'cancel'),
      failureUrl: returnUrl(returnPath, 'failed'),
    });

    await savePendingPayment(intent.id, {
      emailTemplate: 'site',
      // Same fields the main site's EmailJS order template already uses
      emailParams: {
        to_email: 'sales.navilleracharms@gmail.com',
        customer_name: String(name).trim(),
        phone: String(phone).trim(),
        customer_email: String(email).trim(),
        pickup_time: '',
        meetup_place: meetupPlace,
        delivery_date: DELIVERY_DATE_TEXT,
        payment_method: 'Paid Online (Ziina)',
        subtotal: itemsTotal.toFixed(2),
        promo_code: percent ? code : 'None',
        discount: discount.toFixed(2),
        delivery_fee: delivery.fee.toFixed(2),
        total: total.toFixed(2),
        notes: note ? `Payment: Paid Online (Ziina)\n${note}` : 'Payment: Paid Online (Ziina)',
        items_html: buildItemsHtml(lines, discount, code),
      },
      sheetOrderData: {
        customerName: String(name).trim(),
        phone: String(phone).trim(),
        pickupTime: 'Paid Online (Ziina)',
        meetupPlace,
        deliveryDate: DELIVERY_DATE_TEXT,
        size: 'Shop order',
        charms: lines.map(l => `${l.label} x${l.qty} (${l.section})`).join(', '),
        subtotal: round2(itemsTotal - discount).toFixed(2),
        deliveryFee: delivery.fee.toFixed(2),
        total: total.toFixed(2),
      },
    });

    return NextResponse.json({ success: true, redirect_url: intent.redirect_url, total }, { headers });
  } catch (error) {
    console.error('Error creating Ziina payment for the main site cart:', error);
    return fail((error as Error).message || 'Could not start online payment.', 500);
  }
}
