import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/ziina';
import { savePendingPayment } from '@/lib/pendingPayments';
import { priceOrder } from '@/lib/orderPricing';

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
      email,
      meetupPlace,
      notes,
      deliveryDate,
      braceletSize,
      baseColor,
      slots,
      deliveryOptionId,
      promoCode,
      charmsList,
      emailFields,
    } = body;

    if (!customerName || !phone || !meetupPlace) {
      return NextResponse.json({ success: false, error: 'Missing required order fields.' }, { status: 400 });
    }

    // The amount charged is worked out here from the catalogue — never taken from the browser.
    let priced;
    try {
      priced = priceOrder({ slots, deliveryOptionId, promoCode });
    } catch (err) {
      return NextResponse.json({ success: false, error: (err as Error).message }, { status: 400 });
    }
    const { subtotal, deliveryFee, total: totalAed } = priced;

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
        to_email: 'sales.navilleracharms@gmail.com',
        customer_name: customerName,
        phone,
        customer_email: email || '',
        pickup_time: '',
        meetup_place: meetupPlace,
        delivery_date: deliveryDate,
        bracelet_size: braceletSize,
        base_color: baseColor,
        subtotal: subtotalStr,
        delivery_fee: deliveryFeeStr,
        total: totalStr,
        payment_method: 'Paid Online (Ziina)',
        notes: notes ? `Payment: Paid Online (Ziina)\n${notes}` : 'Payment: Paid Online (Ziina)',
        ...(emailFields || {}),
      },
      sheetOrderData: {
        customerName,
        phone,
        pickupTime: 'Paid Online (Ziina)',
        meetupPlace,
        deliveryDate,
        size: braceletSize,
        charms: charmsList || '',
        subtotal: subtotalStr,
        deliveryFee: deliveryFeeStr,
        total: totalStr,
      },
    });

    // redirect_url = Ziina's full-page checkout (embedded checkout isn't enabled on the account)
    return NextResponse.json({ success: true, id: intent.id, redirect_url: intent.redirect_url, embedded_url: intent.embedded_url });
  } catch (error: any) {
    console.error('Error creating Ziina payment intent:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
