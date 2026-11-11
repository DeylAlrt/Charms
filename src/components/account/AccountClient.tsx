"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '../SiteHeader';
import OrderCard, { ContactUs, type CustomerOrder } from './OrderCard';
import CodeBoxes from './CodeBoxes';

type Step = 'loading' | 'email' | 'code' | 'orders';

const INPUT = 'min-h-[52px] px-4 border-2 border-navy rounded-xl text-base text-navy outline-none focus:border-accent-blue bg-white';
const PRIMARY = 'lift min-h-[52px] px-6 rounded-full bg-navy text-white text-lg font-bold hover:bg-pastel-blue hover:text-navy disabled:opacity-70';

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ success: false, error: 'No answer from the server — please try again.' }));
}

/** navillera.vercel.app/account — sign in with an email code, then see and cancel your orders. */
export default function AccountClient() {
  const [step, setStep] = useState<Step>('loading');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [website, setWebsite] = useState('');      // hidden field only bots fill in
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOrders = async () => {
    try {
      const data = await (await fetch('/api/account/orders', { cache: 'no-store' })).json();
      if (data.signedIn) {
        setEmail(data.email);
        setOrders(data.orders ?? []);
        setStep('orders');
      } else {
        setStep('email');
      }
      if (!data.success && data.error) setMessage({ text: data.error, type: 'error' });
    } catch {
      setStep('email');
      setMessage({ text: 'We could not reach the server — please check your connection.', type: 'error' });
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const data = await post('/api/account/send-code', { email, website });
    setBusy(false);
    if (!data.success) { setMessage({ text: data.error || 'Something went wrong — please try again.', type: 'error' }); return; }
    setCode('');
    setStep('code');
    setMessage({ text: `We sent a code to ${email.trim()}. It can take a minute — check your spam folder too.`, type: 'info' });
  };

  /** Checks the code — runs by itself once all six boxes are filled. */
  const checkCode = async (value: string = code) => {
    if (busy || value.length < 6) return;
    setBusy(true);
    setMessage(null);
    const data = await post('/api/account/verify', { email, code: value });
    if (!data.success) {
      setBusy(false);
      setCode('');   // empty boxes, ready to type again
      setMessage({ text: data.error || 'That code did not work.', type: 'error' });
      return;
    }
    await loadOrders();
    setBusy(false);
  };

  const signOut = async () => {
    await post('/api/account/sign-out', {});
    setOrders([]);
    setCode('');
    setMessage(null);
    setStep('email');
  };

  const cancelOrder = (order: CustomerOrder) => async (reason: string): Promise<string | null> => {
    const data = await post('/api/account/cancel', { orderId: order.id, reason });
    if (data.order) setOrders(list => list.map(o => (o.id === order.id ? data.order : o)));
    if (data.success) return null;
    if (data.error === 'Please sign in again.') setStep('email');
    return data.error || 'Something went wrong — please try again.';
  };

  return (
    <div className="min-h-dvh bg-sky-tint-light flex flex-col">
      <SiteHeader current="account" />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <h1 className="font-serif italic text-navy text-4xl sm:text-5xl">My Orders</h1>
          {step === 'orders' && (
            <p className="mt-2 text-muted">
              Signed in as <span className="font-semibold text-navy">{email}</span> ·{' '}
              <button type="button" onClick={signOut} className="underline underline-offset-2 hover:text-navy">Sign out</button>
            </p>
          )}
        </div>

        {message && (
          <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 font-semibold ${message.type === 'error' ? 'bg-pink-soft text-danger' : 'bg-white text-navy'}`}>
            {message.text}
          </p>
        )}

        {step === 'loading' && <p className="text-muted">Loading…</p>}

        {step === 'email' && (
          <form onSubmit={sendCode} noValidate className="rounded-3xl bg-white shadow-[0_6px_24px_rgba(15,42,79,0.08)] p-6 flex flex-col gap-4">
            <p className="text-navy">
              Type the email you used when ordering. We&apos;ll send you a code to sign in — no password needed.
            </p>
            <label className="flex flex-col gap-1.5 font-semibold text-navy">
              Email address
              <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={INPUT} />
            </label>
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Website <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
            </div>
            <button type="submit" disabled={busy || !email.trim()} className={PRIMARY}>{busy ? 'Sending…' : 'Send me a code'}</button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={e => { e.preventDefault(); checkCode(); }} noValidate className="rounded-3xl bg-white shadow-[0_6px_24px_rgba(15,42,79,0.08)] p-6 flex flex-col gap-4">
            <p className="font-semibold text-navy">Code from the email</p>
            <CodeBoxes value={code} onChange={setCode} onComplete={checkCode} disabled={busy} />
            <button type="submit" disabled={busy || code.length < 6} className={PRIMARY}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" onClick={() => { setStep('email'); setMessage(null); }} className="text-sm text-muted underline underline-offset-2 hover:text-navy self-center">
              Use a different email or send a new code
            </button>
          </form>
        )}

        {step === 'orders' && orders.length === 0 && (
          <div className="rounded-3xl bg-white shadow-[0_6px_24px_rgba(15,42,79,0.08)] p-6 text-navy flex flex-col gap-3">
            <p className="font-semibold">No orders with this email yet.</p>
            <p className="text-sm text-muted">If you ordered with a different email, sign out and use that one.</p>
            <Link href="/" className={`${PRIMARY} self-start inline-flex items-center`}>Design a bracelet</Link>
          </div>
        )}

        {step === 'orders' && orders.map(order => (
          <OrderCard key={order.id} order={order} onCancel={cancelOrder(order)} />
        ))}

        {step === 'orders' && orders.length > 0 && (
          <ContactUs title="Questions about an order?">Message us — we usually reply quickly.</ContactUs>
        )}
      </main>
    </div>
  );
}
