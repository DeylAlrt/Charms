import { NextRequest, NextResponse } from 'next/server';
import { text, tooManyAttempts } from '@/lib/antiSpam';
import { DiscountInvalidError, resolveDiscount } from '@/lib/orderStore';
import { CORS_HEADERS } from '@/lib/shopOrder';

/**
 * Checks a promo code when it's typed into a cart (the builder's and the main
 * site's). Only says whether it works and how much it takes off; the code is
 * checked again — including "first order only" — when the order is placed.
 */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const headers = CORS_HEADERS;
  try {
    const body = await request.json();
    if (tooManyAttempts(request, 'check-promo', 10)) {
      return NextResponse.json({ success: false, error: 'Too many tries — please wait a few minutes.' }, { status: 429, headers });
    }
    const code = text(body.code, 30).toUpperCase();
    if (!code) return NextResponse.json({ success: false, error: 'Enter a promo code.' }, { status: 400, headers });
    const discount = await resolveDiscount(code, text(body.email, 254), text(body.phone, 30));
    return NextResponse.json({ success: true, code: discount!.code, percent: discount!.percent }, { headers });
  } catch (err) {
    if (err instanceof DiscountInvalidError) return NextResponse.json({ success: false, error: err.message }, { status: 400, headers });
    console.error('Error checking promo code:', err);
    return NextResponse.json({ success: false, error: "We couldn't check the code right now — please try again." }, { status: 500, headers });
  }
}
