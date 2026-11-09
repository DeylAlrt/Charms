import { NextRequest, NextResponse } from 'next/server';
import { loadLiveProducts } from '@/lib/products';
import { createPaymentIntent } from '@/lib/ziina';
import { checkSpam, noteSend } from '@/lib/antiSpam';
import { publicOrigin } from '@/lib/siteUrls';
import { braceletRecord, readBraceletOrder } from '@/lib/builderOrder';
import { OutOfStockError, saveOrder } from '@/lib/orderStore';

const PAYMENT = { method: 'ziina', label: 'Paid Online (Ziina)' } as const;

/**
 * Starts a Ziina payment for a charm builder order.
 *
 * The order is saved in Supabase as 'awaiting_payment' (stock checked, not
 * taken yet). /api/ziina-webhook marks it paid, takes the stock and emails the
 * shop once Ziina confirms the payment.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Price with the latest products from Supabase (prices, sold out, hidden).
    await loadLiveProducts();
    const spam = await checkSpam(request, body, 'builder-order');
    if (!spam.ok) {
      return spam.silent
        ? NextResponse.json({ success: false, error: 'Could not start online payment.' }, { status: 400 })
        : NextResponse.json({ success: false, error: spam.error }, { status: spam.status });
    }

    let order;
    try {
      order = readBraceletOrder(body, publicOrigin(request));
    } catch (err) {
      return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 });
    }

    const origin = publicOrigin(request);
    const intent = await createPaymentIntent({
      amountAed: order.priced.total,
      message: `Navillera Charm Bracelet — ${order.customer.name}`,
      successUrl: `${origin}/?ziina=success`,
      cancelUrl: `${origin}/?ziina=cancel`,
      failureUrl: `${origin}/?ziina=failed`,
    });

    const { record, stockLines } = braceletRecord(order, PAYMENT, intent.id);
    try {
      await saveOrder(record, stockLines, false);
    } catch (err) {
      if (err instanceof OutOfStockError) return NextResponse.json({ success: false, error: err.message }, { status: 409 });
      // Without the saved order, a payment couldn't be matched to it — so don't send the customer to pay.
      console.error('Could not save the Ziina order in Supabase:', err);
      return NextResponse.json({ success: false, error: 'Online payment is unavailable right now — please choose Cash on Delivery or Bank Transfer.' }, { status: 503 });
    }
    noteSend(request, 'builder-order');

    return NextResponse.json({ success: true, id: intent.id, redirect_url: intent.redirect_url, embedded_url: intent.embedded_url });
  } catch (error) {
    console.error('Error creating Ziina payment intent:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong on our side — please try again, or choose Cash on Delivery or Bank Transfer.' }, { status: 500 });
  }
}
