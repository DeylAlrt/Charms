import { NextRequest, NextResponse } from 'next/server';
import { loadLiveProducts } from '@/lib/products';
import { checkSpam, noteSend, text } from '@/lib/antiSpam';
import { publicOrigin } from '@/lib/siteUrls';
import { braceletRecord, readBraceletOrder } from '@/lib/builderOrder';
import { DiscountInvalidError, OutOfStockError, placeOrderNow, resolveDiscount } from '@/lib/orderStore';
import { paymentLabel } from '@/components/charmEditor/orderOptions';

/**
 * A charm builder order paid by Cash on Delivery or Bank Transfer: saved in
 * Supabase (taking stock), then emailed to the shop. Ziina orders go through
 * /api/create-payment-intent instead.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Price with the latest products from Supabase (prices, sold out, hidden).
    await loadLiveProducts();
    const spam = await checkSpam(request, body, 'builder-order');
    if (!spam.ok) {
      return spam.silent
        ? NextResponse.json({ success: true })
        : NextResponse.json({ success: false, error: spam.error }, { status: spam.status });
    }

    if (body.paymentMethod !== 'cod' && body.paymentMethod !== 'bank') {
      return NextResponse.json({ success: false, error: 'Please choose how you want to pay.' }, { status: 400 });
    }

    // The promo code is checked with Supabase (active, not expired or used up, first order only…)
    let discount;
    try {
      discount = await resolveDiscount(text(body.promoCode, 30).toUpperCase(), text(body.email, 254), text(body.phone, 30));
    } catch (err) {
      if (err instanceof DiscountInvalidError) return NextResponse.json({ success: false, error: err.message, promoInvalid: true }, { status: 400 });
      throw err;
    }

    let order;
    try {
      order = readBraceletOrder(body, publicOrigin(request), discount);
    } catch (err) {
      return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 });
    }

    const { record, stockLines } = braceletRecord(order, { method: body.paymentMethod, label: paymentLabel(body.paymentMethod) });
    let orderNumber: number | null;
    try {
      ({ orderNumber } = await placeOrderNow(record, stockLines));
    } catch (err) {
      if (err instanceof DiscountInvalidError) return NextResponse.json({ success: false, error: err.message, promoInvalid: true }, { status: 400 });
      if (err instanceof OutOfStockError) return NextResponse.json({ success: false, error: err.message }, { status: 409 });
      throw err;
    }
    noteSend(request, 'builder-order');

    return NextResponse.json({ success: true, orderNumber });
  } catch (error) {
    console.error('Error placing builder order:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong sending your order — please try again or DM us on Instagram.' }, { status: 500 });
  }
}
