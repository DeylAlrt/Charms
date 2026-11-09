import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/ziina';
import { savePendingPayment } from '@/lib/pendingPayments';
import { checkSpam, noteSend } from '@/lib/antiSpam';
import { CORS_HEADERS, readShopOrder, shopEmailParams, shopSheetRow } from '@/lib/shopOrder';

/**
 * Starts a Ziina payment for the MAIN SITE's cart (navilleracharms.com,
 * Js_Folder/cart.js). The amount and order details are worked out here from
 * SITE_ITEMS; the order is only stashed as "pending", and /api/ziina-webhook
 * logs it and emails the shop once Ziina confirms the payment.
 */

const SITE_ORIGIN = 'https://navilleracharms.com';
const PAYMENT = 'Paid Online (Ziina)';

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
    const spam = await checkSpam(request, body, 'shop-order');
    if (!spam.ok) return spam.silent ? fail('Could not start online payment.') : fail(spam.error, spam.status);

    let order;
    try {
      order = readShopOrder(body);
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

    noteSend(request, 'shop-order');
    await savePendingPayment(intent.id, {
      emailTemplate: 'site',
      emailParams: shopEmailParams(order, PAYMENT),
      sheetOrderData: shopSheetRow(order, PAYMENT),
    });

    return NextResponse.json({ success: true, redirect_url: intent.redirect_url, total: order.total }, { headers });
  } catch (error) {
    console.error('Error creating Ziina payment for the main site cart:', error);
    return fail('Something went wrong on our side — please try again, or choose Cash on Delivery or Bank Transfer.', 500);
  }
}
