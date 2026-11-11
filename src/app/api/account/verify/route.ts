import { NextRequest, NextResponse } from 'next/server';
import { text, tooManyAttempts } from '@/lib/antiSpam';
import { setSessionCookies, verifySignInCode } from '@/lib/customerAuth';

/** Checks the code from the email and signs the customer in. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = text(body.email, 254).toLowerCase();
    const code = text(body.code, 12).replace(/\s/g, '');
    if (!email || !/^\d{6,10}$/.test(code)) {
      return NextResponse.json({ success: false, error: 'Please type the code from the email.' }, { status: 400 });
    }
    if (tooManyAttempts(request, 'verify', 10)) {
      return NextResponse.json({ success: false, error: 'Too many tries — please wait a few minutes.' }, { status: 429 });
    }
    const session = await verifySignInCode(email, code);
    if (!session) {
      return NextResponse.json({ success: false, error: 'That code is not right or has expired — check the email, or ask for a new one.' }, { status: 400 });
    }
    const res = NextResponse.json({ success: true, email });
    setSessionCookies(res, session);
    return res;
  } catch (err) {
    console.error('Sign-in check failed:', err);
    return NextResponse.json({ success: false, error: 'Something went wrong — please try again.' }, { status: 500 });
  }
}
