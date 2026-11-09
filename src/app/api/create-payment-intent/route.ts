import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/ziina';
import { savePendingPayment } from '@/lib/pendingPayments';
import { checkSpam, noteSend } from '@/lib/antiSpam';
import { braceletEmailParams, braceletSheetRow, readBraceletOrder } from '@/lib/builderOrder';

const PAYMENT = 'Paid Online (Ziina)';

/**
 * Starts a Ziina payment for a charm builder order.
 *
 * The order isn't logged or emailed yet: it's stashed in the PendingPayments
 * sheet, and /api/ziina-webhook logs and emails it once Ziina confirms the
 * payment. Everything in it is worked out here from the bracelet's pictures.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const spam = await checkSpam(request, body, 'builder-order');
    if (!spam.ok) {
      return spam.silent
        ? NextResponse.json({ success: false, error: 'Could not start online payment.' }, { status: 400 })
        : NextResponse.json({ success: false, error: spam.error }, { status: spam.status });
    }

    let order;
    try {
      order = readBraceletOrder(body, request.nextUrl.origin);
    } catch (err) {
      return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    const intent = await createPaymentIntent({
      amountAed: order.priced.total,
      message: `Navillera Charm Bracelet — ${order.customer.name}`,
      successUrl: `${origin}/?ziina=success`,
      cancelUrl: `${origin}/?ziina=cancel`,
      failureUrl: `${origin}/?ziina=failed`,
    });

    noteSend(request, 'builder-order');
    await savePendingPayment(intent.id, {
      emailParams: braceletEmailParams(order, PAYMENT),
      sheetOrderData: braceletSheetRow(order, PAYMENT),
    });

    return NextResponse.json({ success: true, id: intent.id, redirect_url: intent.redirect_url, embedded_url: intent.embedded_url });
  } catch (error) {
    console.error('Error creating Ziina payment intent:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong on our side — please try again, or choose Cash on Delivery or Bank Transfer.' }, { status: 500 });
  }
}
