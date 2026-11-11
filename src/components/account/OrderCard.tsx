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

/** The rubber stamp on the receipt. */
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Received', color: '#2d79ba' },
  paid: { label: 'Paid', color: '#2e7d4f' },
  preparing: { label: 'Being made', color: '#b7791f' },
  shipped: { label: 'On its way', color: '#2d79ba' },
  delivered: { label: 'Delivered', color: '#2e7d4f' },
  cancelled: { label: 'Cancelled', color: '#d1293d' },
};

const PAYMENT: Record<string, string> = { ziina: 'Paid online (Ziina)', cod: 'Cash on Delivery', bank: 'Bank Transfer' };

type Line = { name: string; qty: number; file?: string; price?: number };

/** The products in an order, whichever site it came from. */
function linesOf(order: CustomerOrder): Line[] {
  type Raw = { name?: string; qty?: number; file?: string; unit_price_aed?: number };
  const raw = order.items as { charms?: Raw[] } | Raw[] | null;
  const list = Array.isArray(raw) ? raw : raw?.charms ?? [];
  return list
    .filter(l => l && l.name)
    .map(l => ({ name: l.name!, qty: Number(l.qty) || 1, file: l.file, price: l.unit_price_aed === undefined ? undefined : Number(l.unit_price_aed) }));
}

const money = (n: number) => Number(n).toFixed(2);

// Zig-zag torn paper edges, top and bottom
const TORN_EDGES: React.CSSProperties = {
  WebkitMask: 'conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top/16px 51% repeat-x, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/16px 51% repeat-x',
  mask: 'conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top/16px 51% repeat-x, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/16px 51% repeat-x',
};

/** A dashed line across the receipt. */
const Rule = () => <div className="border-t-2 border-dashed border-navy/20 my-4" />;

/** "Label ........ value" */
function Row({ label, value, strong, accent }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${strong ? 'text-lg font-bold' : 'text-sm'} ${accent ? 'text-success' : 'text-navy'}`}>
      <span className="flex-shrink min-w-0">{label}</span>
      <span aria-hidden className="flex-1 border-b-2 border-dotted border-navy/15 translate-y-[-4px] min-w-4" />
      <span className="font-mono tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
}

/** A decorative barcode made from the order number. */
function Barcode({ seed }: { seed: number }) {
  const bars = Array.from(String(seed).padStart(6, '0').repeat(4), (d, i) => 1 + ((Number(d) + i) % 3));
  return (
    <div aria-hidden className="flex items-stretch justify-center gap-[2px] h-10">
      {bars.map((w, i) => <span key={i} className="bg-navy/80" style={{ width: w * 2, opacity: i % 5 === 4 ? 0.35 : 1 }} />)}
    </div>
  );
}

export function ContactUs({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/80 border border-navy/10 px-4 py-3.5 text-navy">
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

  const status = STATUS[order.status] ?? { label: order.status, color: '#5a6b85' };
  const lines = linesOf(order);
  const placed = new Date(order.created_at);
  const date = placed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' });
  const time = placed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
  const finished = order.status === 'cancelled' || order.status === 'delivered';
  const itemsTotal = Number(order.subtotal_aed);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const problem = await onCancel(reason);
    setBusy(false);
    if (problem) setError(problem);
    else setConfirming(false);
  };

  return (
    <article className="flex flex-col gap-3" aria-label={`Order ${order.order_number}`}>
      {/* ---- The receipt ---- */}
      <div className="drop-shadow-[0_8px_18px_rgba(15,42,79,0.12)]">
        <div className="relative bg-white px-6 sm:px-8 pt-9 pb-10" style={TORN_EDGES}>
          <header className="text-center">
            <p className="font-serif italic text-navy text-2xl">Navillera</p>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted">Charm Studio</p>
          </header>

          <Rule />

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Order</p>
              <h2 className="font-mono text-navy text-2xl font-bold tabular-nums">#{order.order_number}</h2>
              <p className="text-sm text-muted font-mono tabular-nums">{date} · {time}</p>
            </div>
            {/* Rubber stamp */}
            <span
              className="flex-shrink-0 rotate-[-10deg] px-2.5 py-1 rounded-md border-[3px] text-xs sm:text-sm font-bold uppercase tracking-[0.15em] opacity-80 whitespace-nowrap"
              style={{ color: status.color, borderColor: status.color }}
            >
              {status.label}
            </span>
          </div>

          <Rule />

          {lines.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {lines.map((line, i) => (
                <li key={i} className="flex items-center gap-3">
                  {line.file ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl(line.file, charmImageUrl(line.file))} alt="" className="w-9 h-9 flex-shrink-0 rounded-md bg-sky-tint-light object-contain p-0.5" loading="lazy" />
                  ) : (
                    <span className="w-9 h-9 flex-shrink-0 rounded-md bg-sky-tint-light" />
                  )}
                  <div className="flex-1 min-w-0">
                    <Row
                      label={<span className="truncate block">{line.name} <span className="text-muted font-mono">×{line.qty}</span></span>}
                      value={line.price === undefined ? '' : money(line.price * line.qty)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Rule />

          <div className="flex flex-col gap-1.5">
            <Row label="Items" value={money(itemsTotal)} />
            {order.discount_aed > 0 && <Row label={`Discount${order.discount_code ? ` (${order.discount_code})` : ''}`} value={`-${money(order.discount_aed)}`} accent />}
            <Row label="Delivery" value={order.delivery_fee_aed > 0 ? money(order.delivery_fee_aed) : 'FREE'} />
          </div>

          <div className="border-t-2 border-navy/80 mt-3 pt-3">
            <Row label="TOTAL" value={`${money(order.total_aed)} AED`} strong />
          </div>

          <Rule />

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-navy">
            {order.bracelet_size && (<><dt className="text-muted">Bracelet</dt><dd>{order.bracelet_size}{order.base_color ? `, ${order.base_color}` : ''}</dd></>)}
            <dt className="text-muted">Delivery</dt><dd>{order.delivery_text}</dd>
            <dt className="text-muted">Payment</dt><dd>{PAYMENT[order.payment_method] ?? order.payment_method}</dd>
            <dt className="text-muted">From</dt><dd>{order.source === 'builder' ? 'Bracelet builder' : 'Shop'}</dd>
          </dl>

          {order.status === 'cancelled' && (
            <p className="mt-3 text-sm font-semibold text-danger">
              Cancelled{order.cancelled_by === 'customer' ? ' by you' : ''}{order.cancelled_at ? ` on ${new Date(order.cancelled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })}` : ''}.
            </p>
          )}

          <Rule />

          <Barcode seed={order.order_number} />
          <p className="mt-2 text-center text-sm text-muted">Thank you for shopping with us ♡</p>
        </div>
      </div>

      {/* ---- What the customer can do ---- */}
      {order.can_cancel && !confirming && (
        <button type="button" onClick={() => setConfirming(true)} className="lift self-center min-h-11 px-6 rounded-full border-2 border-danger/70 bg-white text-danger font-semibold hover:bg-pink-soft">
          Cancel order #{order.order_number}
        </button>
      )}

      {order.can_cancel && confirming && (
        <div className="rounded-2xl bg-white border-2 border-danger/30 p-4 flex flex-col gap-3">
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
