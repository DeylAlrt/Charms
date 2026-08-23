import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';

/** Lets the client check on load whether it already has a valid admin session. */
export async function GET(req: Request) {
  return NextResponse.json({ authenticated: isAdminRequest(req) });
}
