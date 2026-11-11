"use client";

import { useState } from 'react';
import { charmImageUrl } from '../charmEditorUtils';
import { thumbUrl } from '../charmEditor/stripImages';

/** An order as the account pages get it (see supabase/migrations/20261113000000_customer_orders.sql). */
export type CustomerOrder = {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  payment_method: 'ziina' | 'cod' | 'bank';
  delivery_text: string;
  bracelet_size: string | null;
  base_color: string | null;
  items: unknown;
  source: 'builder' | 'shop';
  discount_code: string | null;
  subtotal_aed: number;
  discount_aed: number;
  delivery_fee_aed: number;
  total_aed: number;
  cancelled_at: string | null;
  cancelled_by: 'customer' | 'shop' | null;
  can_cancel: boolean;
};

export const INSTAGRAM_URL = 'https://www.instagram.com/navilleracharms.ae/';
export const WHATSAPP_URL = 'https://wa.me/971521437484';

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Received', className: 'bg-sky-tint text-navy' },
  paid: { label: 'Paid', className: 'bg-sky-tint text-navy' },
  preparing: { label: 'Being made', className: 'bg-cream text-navy' },
  shipped: { label: 'On its way', className: 'bg-pastel-blue text-navy' },
  delivered: { label: 'Delivered', className: 'bg-[#e9f7ee] text-success' },
  cancelled: { label: 'Cancelled', className: 'bg-pink-soft text-danger' },
};

const PAYMENT: Record<string, string> = { ziina: 'Paid online (Ziina)', cod: 'Cash on Delivery', bank: 'Bank Transfer' };

type Line = { name: string; qty: number; file?: string };

/** The products in an order, whichever site it came from. */
function linesOf(order: CustomerOrder): Line[] {
  const raw = order.items as { charms?: Line[] } | Line[] | null;
  const list = Array.isArray(raw) ? raw : raw?.charms ?? [];
  return list.filter(l => l && l.name).map(l => ({ name: l.name, qty: Number(l.qty) || 1, file: l.file }));
}

const aed = (n: number) => `${Number(n).toFixed(2)} AED`;

export function ContactUs({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-sky-tint-light px-4 py-3.5 text-navy">
      <p className="font-semibold">{title}</p>
      {children && <p className="text-sm text-muted mt-0.5">{children}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="lift inline-flex items-center gap-2 min-h-11 px-4 rounded-full bg-navy text-white text-sm font-semibold hover:bg-pastel-blue hover:text-navy">
          Instagram
        </a>
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lift inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-pastel-blue bg-white text-navy text-sm font-semibold hover:bg-sky-tint-light">
          WhatsApp
        </a>
      </div>
    </div>
  );
}

type Props = {
  order: CustomerOrder;
  /** Cancels the order; resolves to an error message, or null when it worked. */
  onCancel: (reason: string) => Promise<string | null>;
};

export default function OrderCard({ order, onCancel }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = STATUS[order.status] ?? { label: order.status, className: 'bg-sky-tint text-navy' };
  const lines = linesOf(order);
  const date = new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' });
  const finished = order.status === 'cancelled' || order.status === 'delivered';

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const problem = await onCancel(reason);
    setBusy(false);
    if (problem) setError(problem);
    else setConfirming(false);
  };

  return (
    <article className="rounded-3xl bg-white shadow-[0_6px_24px_rgba(15,42,79,0.08)] border border-navy/5 p-5 sm:p-6 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif italic text-navy text-2xl leading-tight">Order #{order.order_number}</h2>
          <p className="text-sm text-muted mt-1">
            {date} · {order.source === 'builder' ? 'Bracelet builder' : 'Shop'}
          </p>
        </div>
        <span className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-semibold ${status.className}`}>{status.label}</span>
      </header>

      {lines.length > 0 && (
        <ul className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <li key={i} className="flex items-center gap-3 text-navy">
              {line.file ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl(line.file, charmImageUrl(line.file))} alt="" className="w-11 h-11 rounded-lg bg-sky-tint-light object-contain p-1" loading="lazy" />
              ) : (
                <span className="w-11 h-11 rounded-lg bg-sky-tint-light" />
              )}
              <span className="flex-1 min-w-0 truncate">{line.name}</span>
              <span className="text-sm text-muted">× {line.qty}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-navy">
        {order.bracelet_size && (<><dt className="text-muted">Bracelet</dt><dd>{order.bracelet_size}{order.base_color ? `, ${order.base_color}` : ''}</dd></>)}
        <dt className="text-muted">Delivery</dt><dd>{order.delivery_text}</dd>
        <dt className="text-muted">Payment</dt><dd>{PAYMENT[order.payment_method] ?? order.payment_method}</dd>
      </dl>

      <div className="border-t border-navy/10 pt-3 flex flex-col gap-1 text-navy">
        {order.discount_aed > 0 && (
          <div className="flex justify-between text-sm"><span>Discount{order.discount_code ? ` (${order.discount_code})` : ''}</span><span className="text-success font-semibold">-{aed(order.discount_aed)}</span></div>
        )}
        {order.delivery_fee_aed > 0 && (
          <div className="flex justify-between text-sm"><span>Delivery</span><span>{aed(order.delivery_fee_aed)}</span></div>
        )}
        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{aed(order.total_aed)}</span></div>
      </div>

      {order.status === 'cancelled' && (
        <p className="text-sm text-muted">
          Cancelled{order.cancelled_by === 'customer' ? ' by you' : ''}{order.cancelled_at ? ` on ${new Date(order.cancelled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })}` : ''}.
        </p>
      )}

      {order.can_cancel && !confirming && (
        <button type="button" onClick={() => setConfirming(true)} className="lift self-start min-h-11 px-5 rounded-full border-2 border-danger/70 text-danger font-semibold hover:bg-pink-soft">
          Cancel order
        </button>
      )}

      {order.can_cancel && confirming && (
        <div className="rounded-2xl bg-pink-soft/60 p-4 flex flex-col gap-3">
          <p className="font-semibold text-navy">Cancel order #{order.order_number}?</p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">
            <span>Why? <span className="font-normal text-muted">(optional)</span></span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={500} className="px-3 py-2 rounded-xl border-2 border-navy/20 bg-white text-base font-normal outline-none focus:border-accent-blue resize-none" />
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={cancel} disabled={busy} className="lift min-h-11 px-5 rounded-full bg-danger text-white font-semibold disabled:opacity-70">
              {busy ? 'Cancelling…' : 'Yes, cancel it'}
            </button>
            <button type="button" onClick={() => { setConfirming(false); setError(null); }} disabled={busy} className="lift min-h-11 px-5 rounded-full border border-pastel-blue bg-white text-navy font-semibold hover:bg-sky-tint-light">
              Keep my order
            </button>
          </div>
        </div>
      )}

      {!order.can_cancel && !finished && (
        <ContactUs title={order.payment_method === 'cod' ? 'Want to change or cancel this order?' : 'Want to cancel, or a refund?'}>
          {order.payment_method === 'cod'
            ? "We've already started on it, so please message us and we'll sort it out."
            : 'Orders paid online or by bank transfer can’t be cancelled here — message us about cancelling or a refund.'}
        </ContactUs>
      )}
    </article>
  );
}
