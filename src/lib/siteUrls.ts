import type { NextRequest } from 'next/server';

/** The builder's public address. */
export const BUILDER_URL = 'https://navillera.vercel.app';

/**
 * The address to put in links that leave the site: pictures in order emails
 * and Ziina's return pages. Always the public one — the address a request
 * arrived on can be one of Vercel's deployment addresses, which are
 * login-protected (Gmail can't load pictures from them, and customers would
 * land on a Vercel sign-in page). Local testing keeps its own address.
 */
export function publicOrigin(request: NextRequest): string {
  const origin = request.nextUrl.origin;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : BUILDER_URL;
}
