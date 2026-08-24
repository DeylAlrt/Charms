import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/ziina';
import { savePendingPayment } from '@/lib/pendingPayments';

/**
 * Starts a Ziina online-payment checkout for an order.
 *
 * This does NOT log the order to the Orders sheet or email the shop yet —
 * per the chosen flow, that only happens once /api/ziina-webhook confirms
 * the payment actually completed. Here, the order is just stashed in the
 * PendingPayments sheet keyed by the new payment intent's ID.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      phone,
      pickupTime,
      meetupPlace,
      deliveryDate,
      braceletSize,
      baseColor,
      subtotal,
      deliveryFee,
      total,
      charmsList,
      emailFields,
    } = body;

    if (!customerName || !phone || !pickupTime || !meetupPlace || !deliveryDate) {
      return NextResponse.json({ success: false, error: 'Missing required order fields.' }, { status: 400 });
    }

    const totalAed = Number(total);
    if (!Number.isFinite(totalAed) || totalAed <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid order total.' }, { status: 400 });
    }

    const origin = request.nextUrl.origin;

    const intent = await createPaymentIntent({
      amountAed: totalAed,
      message: `Navillera Charm Bracelet — ${customerName}`,
      successUrl: `${origin}/?ziina=success`,
      cancelUrl: `${origin}/?ziina=cancel`,
      failureUrl: `${origin}/?ziina=failed`,
    });

    const subtotalStr = Number(subtotal).toFixed(2);
    const deliveryFeeStr = Number(deliveryFee).toFixed(2);
    const totalStr = totalAed.toFixed(2);

    await savePendingPayment(intent.id, {
      emailParams: {
        to_email: 'Navilleracharmstudio@gmail.com',
        customer_name: customerName,
        phone,
        pickup_time: pickupTime,
        meetup_place: meetupPlace,
        delivery_date: deliveryDate,
        bracelet_size: braceletSize,
        base_color: baseColor,
        subtotal: subtotalStr,
        delivery_fee: deliveryFeeStr,
        total: totalStr,
        payment_method: 'Paid Online (Ziina)',
        ...(emailFields || {}),
      },
      sheetOrderData: {
        customerName,
        phone,
        pickupTime,
        meetupPlace: `${meetupPlace} (Paid Online)`,
        deliveryDate,
        size: braceletSize,
        charms: charmsList || '',
        subtotal: subtotalStr,
        deliveryFee: deliveryFeeStr,
        total: totalStr,
      },
    });

    return NextResponse.json({ success: true, id: intent.id, embedded_url: intent.embedded_url });
  } catch (error: any) {
    console.error('Error creating Ziina payment intent:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
