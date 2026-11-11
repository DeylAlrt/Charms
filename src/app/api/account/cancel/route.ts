import { NextRequest, NextResponse } from 'next/server';
import { text } from '@/lib/antiSpam';
import { applyRenewal, getCustomer } from '@/lib/customerAuth';
import { customerCancelOrder, notifyShopOfCancellation } from '@/lib/orderStore';
import { cancelAnswer, isUuid } from '@/lib/cancelAnswer';

/** The signed-in customer's Cancel button. */
export async function POST(request: NextRequest) {
  try {
    const customer = await getCustomer(request);
    if (!customer) return NextResponse.json({ success: false, error: 'Please sign in again.' }, { status: 401 });
    const body = await request.json();
    if (!isUuid(body.orderId)) return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    const reason = text(body.reason, 500);
    const outcome = await customerCancelOrder(body.orderId, { email: customer.email }, reason);
    if (outcome.result === 'cancelled' && outcome.order) {
      await notifyShopOfCancellation(outcome.order, reason, 'from their account')
        .catch(err => console.error('Cancel email to the shop failed:', err));
    }
    return applyRenewal(cancelAnswer(outcome), customer);
  } catch (err) {
    console.error('Customer cancel failed:', err);
    return NextResponse.json({ success: false, error: 'Something went wrong — please try again.' }, { status: 500 });
  }
}
