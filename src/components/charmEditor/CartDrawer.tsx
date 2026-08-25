"use client";

import Image from "next/image";
import { getPrice, type Charm } from '../charmEditorUtils';
import { getDeliveryFee, type useCheckout } from './useCheckout';

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
          <form onSubmit={checkout.handleFormSubmit} className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-6 flex flex-col gap-4">
            <h3 className="font-serif italic text-navy text-lg">Order Details</h3>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
              Name
              <input type="text" value={checkout.form.customerName} onChange={e => checkout.form.setCustomerName(e.target.value)} className="min-h-[46px] px-4 border-2 border-navy rounded-xl text-navy outline-none focus:border-accent-blue" required />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
              Phone
              <input
                type="tel"
                inputMode="numeric"
                value={checkout.form.phoneNumber}
                onChange={(e) => {
                  const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                  if (onlyNums.length <= 15) checkout.form.setPhoneNumber(onlyNums);
                }}
                placeholder="971XXXXXXXXX"
                className="min-h-[46px] px-4 border-2 border-navy rounded-xl text-navy outline-none focus:border-accent-blue"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
              Email <span className="font-normal text-muted text-xs">(optional)</span>
              <input type="email" value={checkout.form.email} onChange={e => checkout.form.setEmail(e.target.value)} placeholder="you@example.com" className="min-h-[46px] px-4 border-2 border-navy rounded-xl text-navy outline-none focus:border-accent-blue" />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
              Pickup Time
              <select value={checkout.form.pickupTime} onChange={e => checkout.form.setPickupTime(e.target.value)} className="min-h-[46px] px-4 border-2 border-navy rounded-xl text-navy outline-none focus:border-accent-blue" required>
                <option value="">Select time</option>
                <option value="Weekdays: 6PM - 8PM">Weekdays: 6PM - 8PM</option>
                <option value="Weekends: 3PM - 8PM">Weekends: 3PM - 8PM</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
              Place of Meet Up / Delivery
              <select value={checkout.form.meetupPlace} onChange={e => checkout.form.setMeetupPlace(e.target.value)} className="min-h-[46px] px-4 border-2 border-navy rounded-xl text-navy outline-none focus:border-accent-blue" required>
                <option value="">Select location</option>
                <optgroup label="Free Delivery">
                  <option value="Dubai Internet City Metro">Dubai Internet City Metro</option>
                  <option value="Dubai Knowledge Park (Tuesday at 5:30 PM)">Dubai Knowledge Park (Tuesday at 5:30 PM)</option>
                </optgroup>
                <optgroup label="5 AED Delivery Fee">
                  <option value="Mall of the Emirates Metro">Mall of the Emirates Metro</option>
                  <option value="DMCC Metro">DMCC Metro</option>
                </optgroup>
                <optgroup label="10 AED Delivery Fee">
                  <option value="Union Metro">Union Metro</option>
                  <option value="Burjuman Metro">Burjuman Metro</option>
                </optgroup>
                <optgroup label="Home Delivery">
                  <option value="Dubai: 20 AED">Dubai: 20 AED</option>
                  <option value="Other Emirates: 25 AED">Other Emirates: 25 AED</option>
                </optgroup>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
              Date of Delivery
              <input type="date" value={checkout.form.deliveryDate} onChange={e => checkout.form.setDeliveryDate(e.target.value)} className="min-h-[46px] px-4 border-2 border-navy rounded-xl text-navy outline-none focus:border-accent-blue" required />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
              Notes <span className="font-normal text-muted text-xs">(optional)</span>
              <textarea value={checkout.form.notes} onChange={e => checkout.form.setNotes(e.target.value)} placeholder="Anything else we should know?" rows={3} className="px-4 py-3 border-2 border-navy rounded-xl text-navy outline-none focus:border-accent-blue resize-none" />
            </label>

            <div className="border-t border-navy/10 pt-3.5">
              <h3 className="font-serif italic text-navy mb-2.5">Price Details</h3>
              <div className="flex justify-between text-navy mb-1.5">
                <span>Total Product Price</span>
                <span>{subtotal.toFixed(2)} AED</span>
              </div>
              {checkout.discount > 0 && (
                <div className="flex justify-between text-navy mb-1.5">
                  <span>Discount</span>
                  <span className="text-success font-semibold">-{checkout.discount.toFixed(2)} AED</span>
                </div>
              )}
              <div className="flex justify-between text-navy mb-1.5">
                <span>Delivery Fee</span>
                <span>{getDeliveryFee(checkout.form.meetupPlace).toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-navy border-t border-navy/10 pt-2.5 mt-1">
                <span>Order Total</span>
                <span>{(checkout.subtotalAfterDiscount + getDeliveryFee(checkout.form.meetupPlace)).toFixed(2)} AED</span>
              </div>
            </div>

            <div className="flex gap-3 mt-1">
              <button type="button" onClick={checkout.backToItems} className="flex-1 min-h-12 rounded-full border border-pastel-blue bg-white text-navy font-semibold hover:bg-sky-tint-light transition-colors">
                Back
              </button>
              <button type="submit" disabled={checkout.submitting} className="flex-[2] min-h-12 rounded-full bg-navy text-white font-bold hover:bg-pastel-blue hover:text-navy transition-colors disabled:opacity-70">
                {checkout.submitting ? 'Sending...' : 'Submit Order'}
              </button>
            </div>

            {checkout.orderStatus && (
              <p className={`text-sm font-semibold text-center ${checkout.orderStatus.type === 'success' ? 'text-success' : 'text-danger'}`}>
                {checkout.orderStatus.text}
              </p>
            )}
          </form>
        )}
      </aside>
    </>
  );
}
