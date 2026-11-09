import { getCatalogueEntry } from '@/components/charmCatalogue';
import { getDeliveryOption } from '@/components/charmEditor/orderOptions';
import { isTwinChain } from '@/components/charmEditor/twinChains';
import { WATCH_LINKS, getWatch } from '@/components/charmEditor/watches';

/**
 * Order pricing shared by the cart (for display) and the server (for
 * charging). The server never trusts a total sent from the browser — it
 * recomputes it here from the catalogue prices, delivery option and promo
 * code, so an edited request can't change what Ziina charges.
 */

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
/** `discountPercent`: the fraction off the charms (0.05 = 5%), from a promo code already checked with Supabase. */
export function priceOrder(params: { slots: unknown; deliveryOptionId: unknown; discountPercent?: number }): PricedOrder {
  const { slots, deliveryOptionId, discountPercent = 0 } = params;

  if (!Array.isArray(slots) || !BRACELET_SLOT_COUNTS.includes(slots.length)) {
    throw new Error('Invalid bracelet size.');
  }

  // A twin chain covers 2 spots and a watch WATCH_LINKS spots, each sold as
  // one item: every spot they cover counts its share of the price.
  let charmsTotal = 0;
  const twinSpots = new Map<string, number>();
  const watchSpotsByFile = new Map<string, number>();
  for (const file of slots) {
    const entry = typeof file === 'string' ? getCatalogueEntry(file) : undefined;
    const watch = typeof file === 'string' ? getWatch(file) : undefined;
    if (entry) {
      if (entry.soldOut) throw new Error(`"${entry.displayName}" is sold out — please swap it for another charm.`);
      if (isTwinChain(entry.file)) {
        twinSpots.set(entry.file, (twinSpots.get(entry.file) ?? 0) + 1);
        charmsTotal += entry.price / 2;
      } else {
        charmsTotal += entry.price;
      }
    } else if (watch) {
      if (watch.soldOut) throw new Error(`The "${watch.name}" is sold out — please choose another watch.`);
      watchSpotsByFile.set(watch.file, (watchSpotsByFile.get(watch.file) ?? 0) + 1);
      charmsTotal += watch.price / WATCH_LINKS;
    } else {
      throw new Error('One of the charms is no longer available — please refresh the page.');
    }
  }
  if ([...twinSpots.values()].some(count => count % 2 !== 0)) {
    throw new Error('A twin chain is missing one of its halves — please refresh the page.');
  }
  if (watchSpotsByFile.size > 1 || [...watchSpotsByFile.values()].some(count => count !== WATCH_LINKS)) {
    throw new Error('Something is wrong with the watch on this bracelet — please refresh the page.');
  }

  const delivery = typeof deliveryOptionId === 'string' ? getDeliveryOption(deliveryOptionId) : undefined;
  if (!delivery) throw new Error('Please choose a delivery option.');

  const discount = round2(charmsTotal * discountPercent);
  const subtotal = round2(charmsTotal - discount);
  const deliveryFee = delivery.fee;

  return { subtotal, discount, deliveryFee, total: round2(subtotal + deliveryFee) };
}
