import { NextRequest, NextResponse } from 'next/server';
import { getPaymentIntent } from '@/lib/ziina';
import { findPendingPayment, markPendingPaymentStatus } from '@/lib/pendingPayments';
import { appendOrderToSheet } from '@/lib/appendOrder';
import { sendOrderNotificationEmail } from '@/lib/emailNotify';

/**
 * Ziina calls this when a payment intent's status changes
 * (event: "payment_intent.status.updated").
 *
 * Security note: the webhook body itself is NEVER trusted for the actual
 * payment status — it's only used to learn which payment intent ID to look
 * up. The real status is re-fetched directly from Ziina's API (Bearer-
 * token authenticated, server-to-server) before an order is ever marked
 * paid and logged/emailed. This means even a forged or malformed webhook
 * call can't fake a payment — it can only point us at a real intent ID,
 * whose real status Ziina alone controls.
 */

/** Best-effort extraction of the payment intent ID — the exact webhook payload shape isn't fully documented, so a few likely locations are checked. */
function extractPaymentIntentId(body: any): string | null {
  return (
    body?.data?.id ||
    body?.data?.object?.id ||
    body?.payment_intent?.id ||
    body?.id ||
    null
  );
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const paymentIntentId = extractPaymentIntentId(body);
  if (!paymentIntentId) {
    console.error('Ziina webhook: could not find a payment intent ID in payload:', body);
    return NextResponse.json({ success: false, error: 'No payment intent ID in payload.' }, { status: 400 });
  }

  try {
    // Re-verify with Ziina directly — never trust the webhook body's own status field.
    const intent = await getPaymentIntent(paymentIntentId);

    if (intent.status !== 'completed') {
      // Not a success event (or not yet) — nothing to do. Not an error.
      return NextResponse.json({ success: true, status: intent.status, action: 'ignored' });
    }

    const pending = await findPendingPayment(paymentIntentId);
    if (!pending) {
      console.error(`Ziina webhook: no pending order found for completed payment ${paymentIntentId}`);
      return NextResponse.json({ success: false, error: 'No matching pending order found.' }, { status: 404 });
    }

    if (pending.status === 'processed') {
      // Already handled on a previous (retried) webhook delivery — idempotent no-op.
      return NextResponse.json({ success: true, action: 'already_processed' });
    }

    await appendOrderToSheet(pending.order.sheetOrderData as any);
    await sendOrderNotificationEmail(pending.order.emailParams);
    await markPendingPaymentStatus(pending.rowNumber, 'processed');

    return NextResponse.json({ success: true, action: 'order_confirmed' });
  } catch (error: any) {
    console.error('Ziina webhook processing failed:', error);
    // Non-2xx so Ziina retries delivery.
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
