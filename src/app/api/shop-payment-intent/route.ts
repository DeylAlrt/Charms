import { NextRequest, NextResponse } from 'next/server';
import { loadLiveProducts } from '@/lib/products';
import { createPaymentIntent } from '@/lib/ziina';
import { DiscountInvalidError, OutOfStockError, resolveDiscount, saveOrder } from '@/lib/orderStore';
import { checkSpam, noteSend, text } from '@/lib/antiSpam';
import { CORS_HEADERS, readShopOrder, shopRecord } from '@/lib/shopOrder';

/**
 * Starts a Ziina payment for the MAIN SITE's cart (navilleracharms.com,
 * Js_Folder/cart.js). The amount and order details are worked out here from
 * Supabase; the order is saved as 'awaiting_payment', and /api/ziina-webhook
 * marks it paid and emails the shop once Ziina confirms the payment.
 */

const SITE_ORIGIN = 'https://navilleracharms.com';
const PAYMENT = { method: 'ziina', label: 'Paid Online (Ziina)' } as const;

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
    const body = await request.json();
    // Price with the latest products from Supabase (prices, sold out, hidden).
    await loadLiveProducts();
    const spam = await checkSpam(request, body, 'shop-order');
    if (!spam.ok) return spam.silent ? fail('Could not start online payment.') : fail(spam.error, spam.status);

    // The promo code is checked with Supabase (active, not expired or used up, first order only…)
    let discount;
    try {
      discount = await resolveDiscount(text(body.promoCode, 30).toUpperCase(), text(body.email, 254), text(body.phone, 30));
    } catch (err) {
      if (err instanceof DiscountInvalidError) return NextResponse.json({ success: false, error: err.message, promoInvalid: true }, { status: 400, headers });
      throw err;
    }

    let order;
    try {
      order = readShopOrder(body, discount);
    } catch (err) {
      return fail((err as Error).message);
    }

    const intent = await createPaymentIntent({
      amountAed: order.total,
      message: `Navillera order — ${order.customer.name}`,
      successUrl: returnUrl(body.returnPath, 'success'),
      cancelUrl: returnUrl(body.returnPath, 'cancel'),
      failureUrl: returnUrl(body.returnPath, 'failed'),
    });

    const { record, stockLines } = shopRecord(order, PAYMENT, intent.id);
    try {
      await saveOrder(record, stockLines, false);
    } catch (err) {
      if (err instanceof DiscountInvalidError) return NextResponse.json({ success: false, error: err.message, promoInvalid: true }, { status: 400, headers });
      if (err instanceof OutOfStockError) return fail(err.message, 409);
      // Without the saved order, a payment couldn't be matched to it — so don't send the customer to pay.
      console.error('Could not save the Ziina order in Supabase:', err);
      return fail('Online payment is unavailable right now — please choose Cash on Delivery or Bank Transfer.', 503);
    }
    noteSend(request, 'shop-order');

    return NextResponse.json({ success: true, redirect_url: intent.redirect_url, total: order.total }, { headers });
  } catch (error) {
    console.error('Error creating Ziina payment for the main site cart:', error);
    return fail('Something went wrong on our side — please try again, or choose Cash on Delivery or Bank Transfer.', 500);
  }
}
