"use client";

import Image from "next/image";
import { getPrice, type Charm } from '../charmEditorUtils';
import type { useCheckout } from './useCheckout';
import { DELIVERY_METHODS, DELIVERY_OPTIONS, PAYMENT_OPTIONS, formatFee } from './orderOptions';

// 16px+ text on form fields keeps iOS Safari from zooming in when they're tapped.
const LABEL = 'flex flex-col gap-1.5 text-base font-semibold text-gray-700';
const INPUT = 'min-h-[50px] px-4 border-2 border-navy rounded-xl text-base font-normal text-navy outline-none focus:border-accent-blue';

function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <h3 className="flex items-center gap-2.5 text-navy text-lg font-bold">
      <span className="w-8 h-8 flex-shrink-0 rounded-full bg-navy text-white flex items-center justify-center text-base">{number}</span>
      {title}
    </h3>
  );
}

type OptionCardProps = {
  selected: boolean;
  onClick?: () => void;
  icon?: string;
  title: string;
  detail: string;
  price?: string;
  disabled?: boolean;
};

/** A big tap-to-choose card that behaves like a radio button. */
function OptionCard({ selected, onClick, icon, title, detail, price, disabled }: OptionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`w-full min-h-16 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        selected ? 'border-navy bg-sky-tint-light' : 'border-sky-tint bg-white hover:border-pastel-blue'
      }`}
    >
      {icon && <span className="text-2xl flex-shrink-0" aria-hidden>{icon}</span>}
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-bold text-navy text-base">{title}</span>
        <span className="text-sm text-muted">{detail}</span>
      </span>
      {price && <span className={`flex-shrink-0 font-bold text-base ${price === 'FREE' ? 'text-success' : 'text-navy'}`}>{price}</span>}
      <span
        aria-hidden
        className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center text-sm ${selected ? 'bg-navy border-navy text-white' : 'border-sky-tint'}`}
      >
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}

type CartDrawerProps = {
  checkout: ReturnType<typeof useCheckout>;
  bracelet: Charm[];
  subtotal: number;
  onDecrement: (filename: string) => void;
  onIncrement: (charm: Charm) => void;
  onRemoveAll: (filename: string) => void;
};

/** Groups the bracelet's charms by filename with counts, for the cart's quantity view. */
function groupCartItems(bracelet: Charm[]) {
  const cartItems: Record<string, { item: Charm; count: number }> = {};
  bracelet.forEach(item => {
    if (!item) return;
    const key = item.filename;
    if (cartItems[key]) {
      cartItems[key].count++;
    } else {
      cartItems[key] = { item, count: 1 };
    }
  });
  return Object.values(cartItems);
}

/**
 * The cart, as a single right-side sliding drawer with two views (items,
 * then the order form) — the same structure as the drawer on
 * navilleracharms.vercel.app's collection page (Css_Folder/cart.css,
 * Js_Folder/cart.js), rather than two separate centered popups.
 */
export default function CartDrawer({ checkout, bracelet, subtotal, onDecrement, onIncrement, onRemoveAll }: CartDrawerProps) {
  const items = groupCartItems(bracelet).filter(({ item }) => !item.isPlaceholder);
  const isEmpty = items.length === 0;

  return (
    <>
      <div
        className={`fixed inset-0 bg-navy/45 backdrop-blur-sm z-40 transition-opacity duration-300 ${checkout.drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={checkout.closeDrawer}
      />
      <aside
        aria-label="Shopping cart"
        className={`fixed top-0 right-0 h-full w-full max-w-[400px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${checkout.drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 bg-navy text-white flex-shrink-0">
          <h2 className="text-xl font-serif italic">My Cart</h2>
          <button
            type="button"
            onClick={checkout.closeDrawer}
            aria-label="Close cart"
            className="w-11 h-11 rounded-full flex items-center justify-center text-2xl hover:bg-white/10 transition-colors"
          >
            &times;
          </button>
        </div>

        {checkout.view === 'items' ? (
          <>
            {isEmpty ? (
              <p className="flex-1 flex items-center justify-center text-center px-6 text-muted text-sm">
                Your cart is empty — tap a charm below to add it to your bracelet.
              </p>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">
                {items.map(({ item, count }) => (
                  <div key={item.filename} className="relative flex items-center gap-4 p-4 rounded-2xl bg-sky-tint-light">
                    <button
                      onClick={() => onRemoveAll(item.filename)}
                      aria-label={`Remove ${item.displayName}`}
                      className="absolute top-3 right-3.5 text-muted hover:text-danger text-xl leading-none"
                    >
                      &times;
                    </button>
                    <div className="w-[72px] h-[72px] flex-shrink-0 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                      <Image src={item.img} alt="" width={60} height={60} className="w-full h-full object-contain" unoptimized />
                    </div>
                    <div className="flex-1 min-w-0 pr-6 flex flex-col gap-0.5">
                      <span className="font-bold text-navy truncate">{item.displayName}</span>
                      {item.category && <span className="text-sm text-muted truncate">{item.category}</span>}
                      <div className="flex items-center gap-2.5 mt-1.5">
                        <span className="text-sm text-muted">Qty:</span>
                        <button
                          onClick={() => onDecrement(item.filename)}
                          className="w-8 h-8 rounded-full border border-pastel-blue bg-white text-navy flex items-center justify-center hover:bg-sky-tint-light transition-colors"
                        >
                          &minus;
                        </button>
                        <span className="min-w-[20px] text-center font-bold text-navy">{count}</span>
                        <button
                          onClick={() => onIncrement(item)}
                          className="w-8 h-8 rounded-full border border-pastel-blue bg-white text-navy flex items-center justify-center hover:bg-sky-tint-light transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <span className="mt-1.5 font-bold text-navy">{(getPrice(item.filename) * count).toFixed(2)} AED</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isEmpty && (
              <div className="flex-shrink-0 px-5 pt-4 pb-5 border-t border-navy/10">
                <h3 className="font-serif italic text-navy mb-2.5">Price Details</h3>
                <div className="flex justify-between text-navy mb-1.5">
                  <span>Total Product Price</span>
                  <span>{subtotal.toFixed(2)} AED</span>
                </div>

                <div className="flex gap-2 my-2.5">
                  <input
                    type="text"
                    value={checkout.promo.input}
                    onChange={(e) => checkout.promo.setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); checkout.promo.apply(); } }}
                    disabled={checkout.promo.locked}
                    placeholder={checkout.promo.locked ? 'New customers only' : 'Promo code'}
                    autoComplete="off"
                    className="flex-1 min-w-0 min-h-10 px-3.5 border-2 border-pastel-blue rounded-full text-sm uppercase placeholder:normal-case outline-none focus:border-accent-blue text-navy disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={checkout.promo.apply}
                    disabled={checkout.promo.locked}
                    className="flex-shrink-0 min-h-10 px-4 rounded-full bg-navy text-white text-sm font-bold hover:bg-accent-blue transition-colors disabled:opacity-60"
                  >
                    Apply
                  </button>
                </div>
                {checkout.promo.message && (
                  <p className={`text-xs font-semibold mb-1.5 ${checkout.promo.message.type === 'success' ? 'text-success' : 'text-danger'}`}>
                    {checkout.promo.message.text}
                  </p>
                )}

                {checkout.discount > 0 && (
                  <div className="flex justify-between text-navy mb-1.5">
                    <span>Discount</span>
                    <span className="text-success font-semibold">-{checkout.discount.toFixed(2)} AED</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg text-navy border-t border-navy/10 pt-2.5 mt-2">
                  <span>Order Total</span>
                  <span>{checkout.subtotalAfterDiscount.toFixed(2)} AED</span>
                </div>

                <div className="flex gap-3 mt-4">
                  <button onClick={checkout.closeDrawer} className="flex-1 min-h-12 rounded-full border border-pastel-blue bg-white text-navy font-semibold hover:bg-sky-tint-light transition-colors">
                    Back
                  </button>
                  <button onClick={checkout.goToCheckout} className="flex-[2] min-h-12 rounded-full bg-navy text-white font-bold uppercase tracking-wide hover:bg-pastel-blue hover:text-navy transition-colors">
                    Proceed Order
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={checkout.handleFormSubmit} noValidate className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-6 flex flex-col gap-5">
            <p className="text-navy text-base">Just 3 easy steps ✨</p>

            <section className="flex flex-col gap-3.5">
              <StepHeading number={1} title="Your details" />
              <label className={LABEL}>
                Email address
                <input type="email" autoComplete="email" value={checkout.form.email} onChange={e => checkout.form.setEmail(e.target.value)} placeholder="you@example.com" className={INPUT} required />
              </label>
              <label className={LABEL}>
                Mobile number (WhatsApp)
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={checkout.form.phoneNumber}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                    if (onlyNums.length <= 15) checkout.form.setPhoneNumber(onlyNums);
                  }}
                  placeholder="971 5X XXX XXXX"
                  className={INPUT}
                  required
                />
                <span className="font-normal text-muted text-sm">We&apos;ll message you on WhatsApp 💬</span>
              </label>
              <label className={LABEL}>
                Your name
                <input type="text" autoComplete="name" value={checkout.form.customerName} onChange={e => checkout.form.setCustomerName(e.target.value)} className={INPUT} required />
              </label>
            </section>

            <section className="flex flex-col gap-3">
              <StepHeading number={2} title="How do you want to get it?" />
              <div role="radiogroup" aria-label="Delivery option" className="flex flex-col gap-2.5">
                {DELIVERY_METHODS.map(m => (
                  <OptionCard
                    key={m.method}
                    selected={checkout.form.deliveryMethod === m.method}
                    onClick={() => checkout.form.setDeliveryMethod(m.method)}
                    icon={m.icon}
                    title={m.title}
                    detail={m.detail}
                    price={m.price}
                  />
                ))}
                <OptionCard selected={false} disabled icon="✈️" title="International shipping" detail="Coming soon" />
              </div>

              {checkout.form.deliveryMethod === 'metro' && (
                <div className="flex flex-col gap-2 pl-3 border-l-4 border-sky-tint">
                  <span className={LABEL}>Pick a metro station</span>
                  <div role="radiogroup" aria-label="Metro station" className="flex flex-col gap-2">
                    {DELIVERY_OPTIONS.filter(o => o.method === 'metro').map(o => (
                      <OptionCard
                        key={o.id}
                        selected={checkout.form.deliveryOptionId === o.id}
                        onClick={() => checkout.form.setDeliveryOptionId(o.id)}
                        title={o.title}
                        detail={o.detail}
                        price={formatFee(o.fee)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {checkout.form.deliveryOption?.needsAddress && (
                <label className={LABEL}>
                  Your home address
                  <textarea value={checkout.form.address} onChange={e => checkout.form.setAddress(e.target.value)} placeholder="Building, street, area, emirate" rows={3} className={`${INPUT} py-3 resize-none`} required />
                </label>
              )}

            </section>

            <section className="flex flex-col gap-3">
              <StepHeading number={3} title="How do you want to pay?" />
              <div role="radiogroup" aria-label="Payment option" className="flex flex-col gap-2.5">
                {PAYMENT_OPTIONS.map(p => (
                  <OptionCard
                    key={p.id}
                    selected={checkout.paymentMethod === p.id}
                    onClick={() => checkout.setPaymentMethod(p.id)}
                    icon={p.icon}
                    title={p.title}
                    detail={p.detail}
                  />
                ))}
              </div>
            </section>

            <label className={LABEL}>
              <span>Anything else? <span className="font-normal text-muted text-sm">(optional)</span></span>
              <textarea value={checkout.form.notes} onChange={e => checkout.form.setNotes(e.target.value)} placeholder="e.g. a gift message" rows={2} className={`${INPUT} py-3 resize-none`} />
            </label>

            <p className="rounded-2xl bg-sky-tint-light text-navy text-base px-4 py-3">
              📱 <strong>Note:</strong> Further details will be sent to your WhatsApp number.
            </p>

            <div className="border-t border-navy/10 pt-3.5">
              <h3 className="font-serif italic text-navy mb-2.5">Price Details</h3>
              <div className="flex justify-between text-navy mb-1.5">
                <span>Charms</span>
                <span>{subtotal.toFixed(2)} AED</span>
              </div>
              {checkout.discount > 0 && (
                <div className="flex justify-between text-navy mb-1.5">
                  <span>Discount</span>
                  <span className="text-success font-semibold">-{checkout.discount.toFixed(2)} AED</span>
                </div>
              )}
              <div className="flex justify-between text-navy mb-1.5">
                <span>Delivery</span>
                <span>{checkout.form.deliveryOption ? formatFee(checkout.deliveryFee) : '—'}</span>
              </div>
              <div className="flex justify-between font-bold text-xl text-navy border-t border-navy/10 pt-2.5 mt-1">
                <span>Total to pay</span>
                <span>{(checkout.subtotalAfterDiscount + checkout.deliveryFee).toFixed(2)} AED</span>
              </div>
            </div>

            {checkout.orderStatus && (
              <p role="status" className={`text-base font-semibold text-center ${checkout.orderStatus.type === 'success' ? 'text-success' : 'text-danger'}`}>
                {checkout.orderStatus.text}
              </p>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={checkout.backToItems} className="flex-1 min-h-14 rounded-full border border-pastel-blue bg-white text-navy font-semibold hover:bg-sky-tint-light transition-colors">
                Back
              </button>
              <button type="submit" disabled={checkout.submitting || checkout.ziinaSubmitting} className="flex-[2] min-h-14 rounded-full bg-navy text-white text-lg font-bold hover:bg-pastel-blue hover:text-navy transition-colors disabled:opacity-70">
                {checkout.ziinaSubmitting
                  ? 'Opening payment...'
                  : checkout.submitting
                    ? 'Sending...'
                    : checkout.paymentMethod === 'ziina' ? 'Continue to payment' : 'Place my order'}
              </button>
            </div>
          </form>
        )}
      </aside>

      {checkout.ziinaEmbedUrl && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]">
          <div className="absolute inset-0 bg-navy/60" />
          <div className="relative bg-white rounded-lg shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={() => checkout.setZiinaEmbedUrl(null)}
              className="absolute top-2 right-2 z-10 bg-sky-tint-light hover:bg-sky-tint rounded-full w-8 h-8 flex items-center justify-center text-navy"
              aria-label="Close payment"
            >
              &times;
            </button>
            <iframe
              ref={checkout.ziinaIframeRef}
              src={`${checkout.ziinaEmbedUrl}?version=latest`}
              width={500}
              height={820}
              style={{ maxWidth: '92vw', maxHeight: '85vh', border: 'none' }}
              allow="payment"
              title="Ziina Payment"
            />
          </div>
        </div>
      )}

      {checkout.ziinaResult && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]">
          <div className="absolute inset-0 bg-navy/60" onClick={checkout.closeZiinaResult} />
          <div className="relative bg-white rounded-lg shadow-lg p-6 w-80 text-center">
            {checkout.ziinaResult === 'success' ? (
              <>
                <p className="text-lg font-semibold text-success mb-2">Payment successful!</p>
                <p className="text-sm text-navy mb-4">Your order has been confirmed. If you have any concerns, DM us on Instagram: @navilleracharms.ae</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-danger mb-2">
                  {checkout.ziinaResult === 'canceled' ? 'Payment canceled' : 'Payment failed'}
                </p>
                <p className="text-sm text-navy mb-4">You can try again, or choose Cash on Delivery or Bank Transfer instead.</p>
              </>
            )}
            <button
              type="button"
              onClick={checkout.closeZiinaResult}
              className="bg-navy hover:bg-pastel-blue hover:text-navy text-white px-4 py-2 rounded-full font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
