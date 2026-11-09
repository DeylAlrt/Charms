import { NextRequest, NextResponse } from 'next/server';
import { loadLiveProducts } from '@/lib/products';
import { sendOrderNotificationEmail } from '@/lib/emailNotify';
import { checkSpam, noteSend } from '@/lib/antiSpam';
import { CORS_HEADERS, readShopOrder, shopEmailParams } from '@/lib/shopOrder';

/**
 * A MAIN SITE cart order paid by Cash on Delivery or Bank Transfer
 * (navilleracharms.com, Js_Folder/cart.js): emails the shop, with the
 * items and prices worked out here from SITE_ITEMS.
 */

const PAYMENTS: Record<string, string> = { cod: 'Cash on Delivery', bank: 'Bank Transfer' };

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
    if (!spam.ok) return spam.silent ? NextResponse.json({ success: true }, { headers }) : fail(spam.error, spam.status);

    const payment = typeof body.paymentMethod === 'string' ? PAYMENTS[body.paymentMethod] : undefined;
    if (!payment) return fail('Please choose how you want to pay.');

    let order;
    try {
      order = readShopOrder(body);
    } catch (err) {
      return fail((err as Error).message);
    }

    await sendOrderNotificationEmail(shopEmailParams(order, payment), 'site');
    noteSend(request, 'shop-order');
    return NextResponse.json({ success: true, total: order.total }, { headers });
  } catch (error) {
    console.error('Error placing main site order:', error);
    return fail('Something went wrong sending your order — please try again or DM us on Instagram.', 500);
  }
}
