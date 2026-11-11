"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '../SiteHeader';
import OrderCard, { ContactUs, type CustomerOrder } from './OrderCard';

/** navillera.vercel.app/order/<token> — the "Manage my order" link in an order email. */
export default function OrderLinkClient({ token }: { token: string }) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/order/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => (data.success ? setOrder(data.order) : setError(data.error || 'This link is not valid.')))
      .catch(() => setError('We could not reach the server — please check your connection.'));
  }, [token]);

  const cancel = async (reason: string): Promise<string | null> => {
    const res = await fetch(`/api/order/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({ success: false }));
    if (data.order) setOrder(data.order);
    return data.success ? null : data.error || 'Something went wrong — please try again.';
  };

  return (
    <div className="min-h-dvh bg-sky-tint-light flex flex-col">
      <SiteHeader current="account" />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
        <h1 className="font-serif italic text-navy text-4xl sm:text-5xl">Your Order</h1>
        {!order && !error && <p className="text-muted">Loading…</p>}
        {error && (
          <div className="flex flex-col gap-4">
            <p role="alert" className="rounded-2xl px-4 py-3 font-semibold bg-pink-soft text-danger">{error}</p>
            <ContactUs title="Need help with an order?">Message us with your order number.</ContactUs>
          </div>
        )}
        {order && <OrderCard order={order} onCancel={cancel} />}
        {order && (
          <p className="text-sm text-muted">
            See all your orders in one place:{' '}
            <Link href="/account" className="font-semibold text-navy underline underline-offset-2">My Orders</Link> (sign in with your email).
          </p>
        )}
      </main>
    </div>
  );
}
