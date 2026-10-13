import { getCatalogueEntry } from '@/components/charmCatalogue';
import { getDeliveryOption } from '@/components/charmEditor/orderOptions';

/**
 * Order pricing shared by the cart (for display) and the server (for
 * charging). The server never trusts a total sent from the browser — it
 * recomputes it here from the catalogue prices, delivery option and promo
 * code, so an edited request can't change what Ziina charges.
 */

/** Promo codes → fraction off the charms subtotal (delivery isn't discounted). */
export const PROMO_CODES: Record<string, number> = {
  NEWBABE: 0.05,
};

export const BRACELET_SLOT_COUNTS = [16, 18, 20, 22];

export type PricedOrder = {
  subtotal: number;      // charms, after any promo discount
  discount: number;
  deliveryFee: number;
  total: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `slots` is the image path of every link on the bracelet, in order —
 * empty spots are sent as the plain link in the chosen colour, which is
 * how they're made (and priced).
 * Throws an Error with a customer-readable message if anything is invalid.
 */
export function priceOrder(params: { slots: unknown; deliveryOptionId: unknown; promoCode?: unknown }): PricedOrder {
  const { slots, deliveryOptionId, promoCode } = params;

  if (!Array.isArray(slots) || !BRACELET_SLOT_COUNTS.includes(slots.length)) {
    throw new Error('Invalid bracelet size.');
  }

  let charmsTotal = 0;
  for (const file of slots) {
    const entry = typeof file === 'string' ? getCatalogueEntry(file) : undefined;
    if (!entry) throw new Error('One of the charms is no longer available — please refresh the page.');
    if (entry.soldOut) throw new Error(`"${entry.displayName}" is sold out — please swap it for another charm.`);
    charmsTotal += entry.price;
  }

  const delivery = typeof deliveryOptionId === 'string' ? getDeliveryOption(deliveryOptionId) : undefined;
  if (!delivery) throw new Error('Please choose a delivery option.');

  const code = typeof promoCode === 'string' ? promoCode.trim().toUpperCase() : '';
  const percent = code ? PROMO_CODES[code] ?? 0 : 0;

  const discount = round2(charmsTotal * percent);
  const subtotal = round2(charmsTotal - discount);
  const deliveryFee = delivery.fee;

  return { subtotal, discount, deliveryFee, total: round2(subtotal + deliveryFee) };
}
