import { getCatalogueEntry } from '@/components/charmCatalogue';
import { baseColorOptions, charmImageUrl, plainCharmFile, type BaseColor } from '@/components/charmEditorUtils';
import { describeDelivery, getDeliveryOption, DELIVERY_DATE_TEXT } from '@/components/charmEditor/orderOptions';
import { isTwinChain } from '@/components/charmEditor/twinChains';
import { WATCH_LINKS, getWatch } from '@/components/charmEditor/watches';
import { checkContactDetails, text } from './antiSpam';
import { priceOrder, type PricedOrder } from './orderPricing';

/**
 * A charm builder order, worked out entirely on the server from the bracelet
 * the customer sent (`slots`: the picture of every link, in order). The price,
 * the charm list, the pictures in the email and the Sheet row all come from
 * the catalogue here, so an edited request can't make them disagree with
 * what's actually being paid for.
 */
export type BraceletOrder = {
  customer: { name: string; phone: string; email: string; notes: string };
  deliveryText: string;
  sizeText: string;
  baseColor: BaseColor;
  promoCode: string;
  priced: PricedOrder;
  /** Each charm once (a twin chain / watch once, plain links left out), for the Sheet. */
  charmsList: string;
  /** charm_1_url … charm_22_name and text_layout, for the EmailJS order template. */
  slotFields: Record<string, string>;
};

const MAX_EMAIL_SLOTS = 22;

/** Reads and checks an order from the builder's checkout. Throws an Error with a customer-readable message. */
export function readBraceletOrder(body: Record<string, unknown>, origin: string): BraceletOrder {
  const name = text(body.customerName, 100);
  const phone = text(body.phone, 30);
  const email = text(body.email, 254);
  const problem = checkContactDetails(email, phone, name);
  if (problem) throw new Error(problem);

  const baseColor = baseColorOptions.find(c => c === body.baseColor);
  if (!baseColor) throw new Error('Please choose a bracelet colour.');

  const delivery = typeof body.deliveryOptionId === 'string' ? getDeliveryOption(body.deliveryOptionId) : undefined;
  if (!delivery) throw new Error('Please choose how you want to get your order.');
  const address = text(body.address, 300);
  if (delivery.needsAddress && !address) throw new Error('Please type your home address.');

  const promoCode = text(body.promoCode, 30).toUpperCase();
  const priced = priceOrder({ slots: body.slots, deliveryOptionId: delivery.id, promoCode });
  const slots = body.slots as string[];

  const plainFile = plainCharmFile(baseColor);
  const twinSeen = new Map<string, number>();
  const watchSeen = new Map<string, number>();
  const listed: string[] = [];
  const slotFields: Record<string, string> = {};
  const layout: string[] = [];

  for (let i = 0; i < MAX_EMAIL_SLOTS; i++) {
    const file = slots[i];
    if (file === undefined) {
      slotFields[`charm_${i + 1}_url`] = origin + charmImageUrl(plainFile);
      slotFields[`charm_${i + 1}_name`] = 'Empty';
      continue;
    }
    const entry = getCatalogueEntry(file);
    const watch = getWatch(file);
    let label: string;
    if (file === plainFile) {
      label = `${baseColor} Plain`;
    } else if (entry && isTwinChain(entry.file)) {
      const n = (twinSeen.get(file) ?? 0) + 1;
      twinSeen.set(file, n);
      const base = `${entry.displayName} (${entry.category})`;
      if (n % 2 === 1) listed.push(base);
      label = `${base} — twin chain, half ${n % 2 === 1 ? 1 : 2} of 2`;
    } else if (watch) {
      const n = (watchSeen.get(file) ?? 0) + 1;
      watchSeen.set(file, n);
      if (n === 1) listed.push(watch.name);
      label = `${watch.name} — watch, part ${n} of ${WATCH_LINKS}`;
    } else {
      label = `${entry!.displayName} (${entry!.category})`;
      listed.push(label);
    }
    slotFields[`charm_${i + 1}_url`] = origin + charmImageUrl(file);
    slotFields[`charm_${i + 1}_name`] = label;
    layout.push(file === plainFile ? `[${i + 1}] ${baseColor} Plain Charm` : `[${i + 1}] ${label}`);
  }
  slotFields.text_layout = layout.join('\n');

  const watch = [...watchSeen.keys()].map(getWatch)[0];
  const sizeText = watch ? `${slots.length} links incl. ${watch.name} (takes ${WATCH_LINKS})` : `${slots.length} charms`;

  return {
    customer: { name, phone, email, notes: text(body.notes, 1000) },
    deliveryText: describeDelivery(delivery, address),
    sizeText,
    baseColor,
    promoCode: priced.discount > 0 ? promoCode : '',
    priced,
    charmsList: listed.join(', '),
    slotFields,
  };
}

/** The EmailJS order email for a builder order. */
export function braceletEmailParams(order: BraceletOrder, payment: string): Record<string, string> {
  const { customer, priced } = order;
  return {
    to_email: 'sales.navilleracharms@gmail.com',
    customer_name: customer.name,
    phone: customer.phone,
    customer_email: customer.email,
    pickup_time: '',
    meetup_place: order.deliveryText,
    delivery_date: DELIVERY_DATE_TEXT,
    payment_method: payment,
    // Payment is repeated in the notes so it shows even in a template without {{payment_method}}.
    notes: customer.notes ? `Payment: ${payment}\n${customer.notes}` : `Payment: ${payment}`,
    bracelet_size: order.sizeText,
    base_color: order.baseColor,
    subtotal: (priced.subtotal + priced.discount).toFixed(2),
    promo_code: order.promoCode || 'None',
    discount: priced.discount.toFixed(2),
    delivery_fee: priced.deliveryFee.toFixed(2),
    total: priced.total.toFixed(2),
    ...order.slotFields,
  };
}

/** The Orders sheet row for a builder order. The old "Pickup Time" column holds the payment method. */
export function braceletSheetRow(order: BraceletOrder, payment: string) {
  return {
    customerName: order.customer.name,
    phone: order.customer.phone,
    pickupTime: payment,
    meetupPlace: order.deliveryText,
    deliveryDate: DELIVERY_DATE_TEXT,
    size: order.sizeText,
    charms: order.charmsList,
    subtotal: order.priced.subtotal.toFixed(2),
    deliveryFee: order.priced.deliveryFee.toFixed(2),
    total: order.priced.total.toFixed(2),
  };
}
