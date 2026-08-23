import crypto from 'crypto';

/**
 * Server-only admin authentication.
 *
 * The password is checked and the session cookie is verified entirely on
 * the server — none of this ever ships to the browser bundle, so nothing
 * here is visible via "View Source" or the DevTools console. The cookie
 * itself is HttpOnly, so client-side JavaScript can't read it either.
 *
 * Set ADMIN_PASSWORD in the environment (e.g. .env.local, or your host's
 * environment variables) to change the password without touching code.
 */

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Navillera1101';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const SESSION_SECRET = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

export const ADMIN_COOKIE = 'navillera_admin';

export function checkPassword(password: unknown): boolean {
  return typeof password === 'string' && password.length > 0 && password === ADMIN_PASSWORD;
}

/** Creates a signed, expiring session token to store in the admin cookie. */
export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(String(expires)).digest('hex');
  return `${expires}.${signature}`;
}

function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresPart, signature] = token.split('.');
  if (!expiresPart || !signature) return false;

  const expires = Number(expiresPart);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(expiresPart).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false; // signature length mismatch, e.g. a tampered cookie
  }
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** True if the request carries a valid, unexpired admin session cookie. */
export function isAdminRequest(req: Request): boolean {
  return isValidSessionToken(readCookie(req, ADMIN_COOKIE));
}
