import { NextRequest, NextResponse } from 'next/server';
import { appendOrderToSheet } from '@/lib/appendOrder';

/**
 * Logs a Cash on Delivery / Bank Transfer order to the Orders sheet.
 * (Ziina orders are logged by /api/ziina-webhook once payment is confirmed.)
 */
export async function POST(request: NextRequest) {
  try {
    const { orderData } = await request.json();

    if (!orderData?.customerName || !orderData?.phone) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const field = (key: string) => String(orderData[key] ?? '').slice(0, 2000);
    await appendOrderToSheet({
      customerName: field('customerName'),
      phone: field('phone'),
      pickupTime: field('pickupTime'),
      meetupPlace: field('meetupPlace'),
      deliveryDate: field('deliveryDate'),
      size: field('size'),
      charms: field('charms'),
      subtotal: field('subtotal'),
      deliveryFee: field('deliveryFee'),
      total: field('total'),
    });

    return NextResponse.json({ success: true, message: 'Order submitted successfully!' });
  } catch (error) {
    console.error('Error saving order:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
