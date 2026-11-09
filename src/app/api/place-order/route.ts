import { NextRequest, NextResponse } from 'next/server';
import { loadLiveProducts } from '@/lib/products';
import { appendOrderToSheet } from '@/lib/appendOrder';
import { sendOrderNotificationEmail } from '@/lib/emailNotify';
import { checkSpam, noteSend } from '@/lib/antiSpam';
import { braceletEmailParams, braceletSheetRow, readBraceletOrder } from '@/lib/builderOrder';
import { paymentLabel } from '@/components/charmEditor/orderOptions';

/**
 * A charm builder order paid by Cash on Delivery or Bank Transfer: emails the
 * shop and logs it to the Orders sheet. (Ziina orders go through
 * /api/create-payment-intent and are logged once paid.)
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
    const payment = paymentLabel(body.paymentMethod);

    let order;
    try {
      order = readBraceletOrder(body, request.nextUrl.origin);
    } catch (err) {
      return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 });
    }

    // The email is what tells the shop about the order, so it must go through.
    await sendOrderNotificationEmail(braceletEmailParams(order, payment), 'builder');
    noteSend(request, 'builder-order');

    // The sheet is a record; the order still counts if it fails.
    try {
      await appendOrderToSheet(braceletSheetRow(order, payment));
    } catch (err) {
      console.error('Failed to save order to Google Sheets:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error placing builder order:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong sending your order — please try again or DM us on Instagram.' }, { status: 500 });
  }
}
