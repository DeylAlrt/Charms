import { NextRequest, NextResponse } from 'next/server';
import { loadLiveProducts } from '@/lib/products';
import { checkSpam, noteSend } from '@/lib/antiSpam';
import { CORS_HEADERS, readShopOrder, shopRecord } from '@/lib/shopOrder';
import { OutOfStockError, placeOrderNow } from '@/lib/orderStore';

/**
 * A MAIN SITE cart order paid by Cash on Delivery or Bank Transfer
 * (navilleracharms.com): priced from the products in Supabase, saved there
 * (taking stock), then emailed to the shop.
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

    const label = typeof body.paymentMethod === 'string' ? PAYMENTS[body.paymentMethod] : undefined;
    if (!label) return fail('Please choose how you want to pay.');

    let order;
    try {
      order = readShopOrder(body);
    } catch (err) {
      return fail((err as Error).message);
    }

    const { record, stockLines } = shopRecord(order, { method: body.paymentMethod, label });
    let orderNumber: number | null;
    try {
      ({ orderNumber } = await placeOrderNow(record, stockLines));
    } catch (err) {
      if (err instanceof OutOfStockError) return fail(err.message, 409);
      throw err;
    }
    noteSend(request, 'shop-order');

    return NextResponse.json({ success: true, total: order.total, orderNumber }, { headers });
  } catch (error) {
    console.error('Error placing main site order:', error);
    return fail('Something went wrong sending your order — please try again or DM us on Instagram.', 500);
  }
}
