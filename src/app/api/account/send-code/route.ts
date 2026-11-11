import { NextRequest, NextResponse } from 'next/server';
import { isEmail, text, tooManyAttempts } from '@/lib/antiSpam';
import { sendSignInCode } from '@/lib/customerAuth';

/** Emails a one-time sign-in code to the customer. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = text(body.email, 254).toLowerCase();
    if (!isEmail(email)) return NextResponse.json({ success: false, error: 'Please check your email address.' }, { status: 400 });
    if (typeof body.website === 'string' && body.website) return NextResponse.json({ success: true }); // a bot filled the hidden field
    if (tooManyAttempts(request, 'send-code', 5) || tooManyAttempts(request, `send-code:${email}`, 3)) {
      return NextResponse.json({ success: false, error: 'Too many codes asked for — please wait a few minutes.' }, { status: 429 });
    }
    await sendSignInCode(email);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message || 'Something went wrong — please try again.' }, { status: 500 });
  }
}
