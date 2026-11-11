import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookies, signOut } from '@/lib/customerAuth';

export async function POST(request: NextRequest) {
  await signOut(request);
  const res = NextResponse.json({ success: true });
  clearSessionCookies(res);
  return res;
}
