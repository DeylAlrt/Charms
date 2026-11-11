import { NextResponse } from 'next/server';
import type { CustomerOrder } from './orderStore';

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** The answer to a Cancel button press, in words for the customer. */
export function cancelAnswer(outcome: { result: string; order?: CustomerOrder }) {
  if (outcome.result === 'cancelled') return NextResponse.json({ success: true, order: outcome.order });
  if (outcome.result === 'not_found') return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
  return NextResponse.json({
    success: false,
    order: outcome.order,
    error: 'This order can no longer be cancelled on the site — please message us on Instagram or WhatsApp.',
  }, { status: 409 });
}
