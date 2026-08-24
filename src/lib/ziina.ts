/**
 * Server-only Ziina payment client.
 *
 * ZIINA_API_KEY is a secret Bearer token — Ziina has no client-safe
 * "publishable key" equivalent, so every call here MUST run server-side
 * (API routes only). Never import this from a "use client" component.
 *
 * Set ZIINA_API_KEY in the environment (.env.local locally, or your host's
 * environment variables in production).
 */

const ZIINA_API_BASE = 'https://api-v2.ziina.com/api';

function getApiKey(): string {
  const key = process.env.ZIINA_API_KEY;
  if (!key) throw new Error('ZIINA_API_KEY is not set in the environment.');
  return key;
}

async function ziinaFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${ZIINA_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message || data?.error || `Ziina API error (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export type ZiinaPaymentIntent = {
  id: string;
  status: 'requires_payment_instrument' | 'requires_user_action' | 'pending' | 'completed' | 'failed' | 'canceled';
  amount: number;
  currency_code: string;
  redirect_url: string;
  embedded_url: string;
  [key: string]: unknown;
};

/** Creates a payment intent. `amountAed` is a normal decimal AED amount (e.g. 45.50) — converted to fils here. */
export async function createPaymentIntent(params: {
  amountAed: number;
  message: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
}): Promise<ZiinaPaymentIntent> {
  const amountFils = Math.round(params.amountAed * 100);

  return ziinaFetch('/payment_intent', {
    method: 'POST',
    body: JSON.stringify({
      amount: amountFils,
      currency_code: 'AED',
      message: params.message,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      failure_url: params.failureUrl,
      test: process.env.ZIINA_TEST_MODE === 'true',
    }),
  });
}

/**
 * Fetches the authoritative current status of a payment intent directly
 * from Ziina. Used by the webhook handler so a spoofed or malformed
 * webhook payload can never be trusted on its own — only this server-to-
 * server lookup decides whether an order is actually marked paid.
 */
export async function getPaymentIntent(id: string): Promise<ZiinaPaymentIntent> {
  return ziinaFetch(`/payment_intent/${encodeURIComponent(id)}`, { method: 'GET' });
}
