import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, checkPassword, createSessionToken } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (!checkPassword(password)) {
      // Same generic message either way so a caller can't tell a missing
      // field from a wrong password.
      return NextResponse.json({ success: false, error: 'Wrong password' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12, // 12 hours, matches the token's own expiry
    });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
