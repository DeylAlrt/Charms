import type { NextRequest } from 'next/server';

/**
 * Spam protection shared by every route that sends an order or a message:
 *   1. a hidden "website" form field that people never see, so only bots fill it in
 *   2. a per-visitor limit on how often they can send
 *   3. Cloudflare Turnstile (the "I'm human" check) — only once TURNSTILE_SECRET_KEY
 *      is set in Vercel; until then the site works without it
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** At most LIMIT sends per visitor every WINDOW_MS. */
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

// Kept in the server's memory, so it resets when Vercel starts a fresh server
// and isn't shared between servers. It still stops one visitor sending a flood.
const recentSends = new Map<string, number[]>();

export const visitorIp = (request: NextRequest) =>
  request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

const sendsInWindow = (key: string) => (recentSends.get(key) ?? []).filter(t => Date.now() - t < WINDOW_MS);

const tooManySends = (key: string) => sendsInWindow(key).length >= LIMIT;

/** Counts a send that went through (mistakes in the form don't count towards the limit). */
export function noteSend(request: NextRequest, route: string) {
  const key = `${route}:${visitorIp(request)}`;
  recentSends.set(key, [...sendsInWindow(key), Date.now()]);
  if (recentSends.size > 5000) {
    for (const [k, list] of recentSends) if (list.every(t => Date.now() - t >= WINDOW_MS)) recentSends.delete(k);
  }
}

async function passesTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== 'string' || !token) return false;
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data?.success === true;
  } catch (err) {
    console.error('Turnstile check failed:', err);
    return false;
  }
}

export type SpamCheck =
  | { ok: true }
  /** A bot filled in the hidden field: pretend it worked so it doesn't try again. */
  | { ok: false; silent: true }
  | { ok: false; silent: false; status: number; error: string };

/** Runs all three checks for a send to `route`. */
export async function checkSpam(request: NextRequest, body: { website?: unknown; turnstileToken?: unknown }, route: string): Promise<SpamCheck> {
  if (typeof body.website === 'string' && body.website.trim()) return { ok: false, silent: true };

  const ip = visitorIp(request);
  if (!(await passesTurnstile(body.turnstileToken, ip))) {
    return { ok: false, silent: false, status: 400, error: "Please tick the \"I'm human\" check and try again." };
  }
  if (tooManySends(`${route}:${ip}`)) {
    return { ok: false, silent: false, status: 429, error: "You've sent a few already — please wait a few minutes, or message us on WhatsApp or Instagram." };
  }
  return { ok: true };
}

// --- Checking what customers type in ---

/** Trimmed text, cut to `max` characters; '' for anything that isn't text. */
export const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export const isEmail = (value: string) => value.length <= 254 && /^[^\s@<>()[\]",;:]+@[^\s@<>()[\]",;:]+\.[^\s@<>()[\]",;:]{2,}$/.test(value);

/** Digits with an optional leading +, spaces or dashes, 7–15 digits. */
export const isPhone = (value: string) => /^\+?[\d\s-]+$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7 && (value.match(/\d/g)?.length ?? 0) <= 15;

/** Checks the email / WhatsApp / name every order form asks for; returns a message for the customer, or null. */
export function checkContactDetails(email: string, phone: string, name: string): string | null {
  if (!email || !phone || !name) return 'Please fill in your email, WhatsApp number and name.';
  if (!isEmail(email)) return 'Please check your email address.';
  if (!isPhone(phone)) return 'Please check your WhatsApp number.';
  return null;
}
