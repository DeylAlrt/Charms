import { NextRequest, NextResponse } from 'next/server';
import { text, tooManyAttempts } from '@/lib/antiSpam';
import { customerCancelOrder, notifyShopOfCancellation, orderByToken } from '@/lib/orderStore';
import { cancelAnswer, isUuid } from '@/lib/cancelAnswer';

/**
 * An order reached through the private "Manage my order" link in its email
 * (navillera.vercel.app/order/<token>): no sign-in needed, only this order.
 */

type Params = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  if (tooManyAttempts(request, 'order-link', 30)) {
    return NextResponse.json({ success: false, error: 'Too many tries — please wait a few minutes.' }, { status: 429 });
  }
  if (!isUuid(token)) return NextResponse.json({ success: false, error: 'This link is not valid.' }, { status: 404 });
  try {
    const order = await orderByToken(token);
    if (!order) return NextResponse.json({ success: false, error: 'This link is not valid.' }, { status: 404 });
    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error('Order link failed:', err);
    return NextResponse.json({ success: false, error: 'We could not load the order right now — please try again.' }, { status: 500 });
  }
}

/** The Cancel button on that page. */
export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params;
  if (!isUuid(token)) return NextResponse.json({ success: false, error: 'This link is not valid.' }, { status: 404 });
  try {
    const body = await request.json();
    const order = await orderByToken(token);
    if (!order) return NextResponse.json({ success: false, error: 'This link is not valid.' }, { status: 404 });
    const reason = text(body.reason, 500);
    const outcome = await customerCancelOrder(order.id, { token }, reason);
    if (outcome.result === 'cancelled' && outcome.order) {
      await notifyShopOfCancellation(outcome.order, reason, 'with the link in their order email')
        .catch(err => console.error('Cancel email to the shop failed:', err));
    }
    return cancelAnswer(outcome);
  } catch (err) {
    console.error('Order link cancel failed:', err);
    return NextResponse.json({ success: false, error: 'Something went wrong — please try again.' }, { status: 500 });
  }
}
