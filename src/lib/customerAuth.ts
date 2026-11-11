import type { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './products';

/**
 * Customer sign-in with Supabase Auth: the customer types their email, gets
 * a one-time code by email, and types it in. No passwords.
 *
 * The session is kept in two cookies the page's scripts can't read
 * (httpOnly): a short-lived access token and a refresh token. Every account
 * request checks the access token with Supabase, renewing it when it expires.
 */

const AUTH = `${SUPABASE_URL}/auth/v1`;
const ACCESS_COOKIE = 'nv_access';
const REFRESH_COOKIE = 'nv_refresh';
const REFRESH_DAYS = 30;

type Session = { access_token: string; refresh_token: string; expires_in: number };

async function auth(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${AUTH}${path}`, {
    method: init.method ?? 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Emails a sign-in code. Throws an Error with a message for the customer if it can't. */
export async function sendSignInCode(email: string): Promise<void> {
  const { ok, status, data } = await auth('/otp', { body: { email, create_user: true } });
  if (ok) return;
  console.error('Supabase could not send a sign-in code:', status, data);
  if (status === 429) throw new Error('A code was just sent — please wait a minute before asking for another.');
  throw new Error("We couldn't send the code right now — please try again in a few minutes.");
}

/** Checks the code. Returns the new session, or null if the code is wrong or expired. */
export async function verifySignInCode(email: string, code: string): Promise<Session | null> {
  const { ok, data } = await auth('/verify', { body: { type: 'email', email, token: code } });
  return ok && data.access_token ? (data as Session) : null;
}

/** Puts the session in the cookies of a response. */
export function setSessionCookies(res: NextResponse, session: Session) {
  const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  res.cookies.set(ACCESS_COOKIE, session.access_token, { ...base, maxAge: session.expires_in });
  res.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...base, maxAge: REFRESH_DAYS * 24 * 60 * 60 });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}

export type Customer = { email: string; renewed: Session | null };

/**
 * The signed-in customer, or null. If the access token has expired, the
 * refresh token renews it — pass the result to applyRenewal() on the response.
 */
export async function getCustomer(request: NextRequest): Promise<Customer | null> {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access) {
    const { ok, data } = await auth('/user', { method: 'GET', token: access });
    if (ok && data.email) return { email: String(data.email), renewed: null };
  }
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const { ok, data } = await auth('/token?grant_type=refresh_token', { body: { refresh_token: refresh } });
  if (!ok || !data.access_token || !data.user?.email) return null;
  return { email: String(data.user.email), renewed: data as Session };
}

/** Saves a renewed session (if any) on the response. */
export function applyRenewal(res: NextResponse, customer: Customer | null) {
  if (customer?.renewed) setSessionCookies(res, customer.renewed);
  return res;
}

/** Signs the customer out at Supabase too (best effort). */
export async function signOut(request: NextRequest): Promise<void> {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access) await auth('/logout', { token: access }).catch(() => undefined);
}
