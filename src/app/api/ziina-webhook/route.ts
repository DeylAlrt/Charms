import { NextRequest, NextResponse } from 'next/server';
import { getPaymentIntent } from '@/lib/ziina';
import { sendOrderNotificationEmail } from '@/lib/emailNotify';
import { markEmailSent, markOrderPaid, withOrderNumber } from '@/lib/orderStore';

/**
 * Ziina calls this when a payment's status changes.
 *
 * The webhook body is never trusted for the payment status: it's only used to
 * learn the payment id, and the real status is fetched from Ziina directly
 * (server to server, with the secret key). So a forged call can't fake a
 * payment. Once paid, the order in Supabase is marked 'paid' (taking its
 * stock) and the order email is sent — once, even if Ziina repeats the call.
 */

/** The payment id — the exact payload shape isn't fully documented, so a few likely places are checked. */
function extractPaymentIntentId(body: unknown): string | null {
  const b = body as { data?: { id?: string; object?: { id?: string } }; payment_intent?: { id?: string }; id?: string } | null;
  const id = b?.data?.id || b?.data?.object?.id || b?.payment_intent?.id || b?.id;
  return typeof id === 'string' && id ? id : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const paymentIntentId = extractPaymentIntentId(body);
  if (!paymentIntentId) {
    console.error('Ziina webhook: no payment id in payload:', body);
    return NextResponse.json({ success: false, error: 'No payment intent ID in payload.' }, { status: 400 });
  }

  try {
    const intent = await getPaymentIntent(paymentIntentId);
    if (intent.status !== 'completed') {
      return NextResponse.json({ success: true, status: intent.status, action: 'ignored' });
    }

    const order = await markOrderPaid(paymentIntentId);
    if (!order) {
      console.error(`Ziina webhook: no order in Supabase for completed payment ${paymentIntentId}`);
      return NextResponse.json({ success: false, error: 'No matching order found.' }, { status: 404 });
    }
    if (order.email_sent) {
      return NextResponse.json({ success: true, action: 'already_processed' });
    }

    await sendOrderNotificationEmail(withOrderNumber(order.email_params, order.order_number), order.email_template);
    await markEmailSent(order.id);
    return NextResponse.json({ success: true, action: 'order_confirmed', orderNumber: order.order_number });
  } catch (error) {
    console.error('Ziina webhook processing failed:', error);
    // Not 2xx, so Ziina tries again later.
    return NextResponse.json({ success: false, error: 'Processing failed.' }, { status: 500 });
  }
}
