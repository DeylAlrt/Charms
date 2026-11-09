import { getCatalogueEntry } from '@/components/charmCatalogue';
import { baseColorOptions, charmImageUrl, plainCharmFile, type BaseColor } from '@/components/charmEditorUtils';
import { describeDelivery, getDeliveryOption, DELIVERY_DATE_TEXT } from '@/components/charmEditor/orderOptions';
import { isTwinChain } from '@/components/charmEditor/twinChains';
import { WATCH_LINKS, getWatch } from '@/components/charmEditor/watches';
import { checkContactDetails, text } from './antiSpam';
import { priceOrder, type PricedOrder } from './orderPricing';
import type { NewOrder, StockLine } from './orderStore';
import { productIdForBuilderFile } from './products';

/**
 * A charm builder order, worked out entirely on the server from the bracelet
 * the customer sent (`slots`: the picture of every link, in order). The price,
 * the charm list and the pictures in the email all come from
 * the catalogue here (the saved order too), so an edited request can't make them disagree with
 * what's actually being paid for.
 */

/** One product on the bracelet, as charged. */
export type BraceletLine = { file: string; name: string; category: string; qty: number; unit_price_aed: number };

export type BraceletOrder = {
  customer: { name: string; phone: string; email: string; notes: string };
  deliveryText: string;
  sizeText: string;
  baseColor: BaseColor;
  promoCode: string;
  priced: PricedOrder;
  deliveryOptionId: string;
  address: string;
  /** Each product once with its quantity (a twin chain / watch counts as 1). */
  lines: BraceletLine[];
  /** "[1] Silver Plain Charm", … one per spot. */
  layout: string[];
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
      label = `${base} — twin chain, half ${n % 2 === 1 ? 1 : 2} of 2`;
    } else if (watch) {
      const n = (watchSeen.get(file) ?? 0) + 1;
      watchSeen.set(file, n);
      label = `${watch.name} — watch, part ${n} of ${WATCH_LINKS}`;
    } else {
      label = `${entry!.displayName} (${entry!.category})`;
    }
    slotFields[`charm_${i + 1}_url`] = origin + charmImageUrl(file);
    slotFields[`charm_${i + 1}_name`] = label;
    layout.push(file === plainFile ? `[${i + 1}] ${baseColor} Plain Charm` : `[${i + 1}] ${label}`);
  }
  slotFields.text_layout = layout.join('\n');

  const watch = [...watchSeen.keys()].map(getWatch)[0];
  const sizeText = watch ? `${slots.length} links incl. ${watch.name} (takes ${WATCH_LINKS})` : `${slots.length} charms`;

  // One line per product: a twin chain covers 2 spots and a watch WATCH_LINKS, each sold as one
  const spotsByFile = new Map<string, number>();
  for (const file of slots) spotsByFile.set(file, (spotsByFile.get(file) ?? 0) + 1);
  const lines: BraceletLine[] = [...spotsByFile].map(([file, spots]) => {
    const entry = getCatalogueEntry(file);
    const w = getWatch(file);
    if (w) return { file, name: w.name, category: 'Watch', qty: spots / WATCH_LINKS, unit_price_aed: w.price };
    const twin = isTwinChain(file);
    return {
      file,
      name: file === plainFile ? `${baseColor} Plain` : entry!.displayName,
      category: entry!.category,
      qty: twin ? spots / 2 : spots,
      unit_price_aed: entry!.price,
    };
  });

  return {
    customer: { name, phone, email, notes: text(body.notes, 1000) },
    deliveryOptionId: delivery.id,
    address,
    deliveryText: describeDelivery(delivery, address),
    sizeText,
    baseColor,
    promoCode: priced.discount > 0 ? promoCode : '',
    priced,
    lines,
    layout,
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

/** The order as saved in Supabase, and the stock it uses. */
export function braceletRecord(
  order: BraceletOrder,
  payment: { method: 'ziina' | 'cod' | 'bank'; label: string },
  ziinaPaymentId?: string,
): { record: NewOrder; stockLines: StockLine[] } {
  const { customer, priced } = order;
  const stockLines = order.lines
    .map(l => ({ product_id: productIdForBuilderFile(l.file), qty: l.qty }))
    .filter((l): l is StockLine => !!l.product_id);
  return {
    record: {
      source: 'builder',
      status: payment.method === 'ziina' ? 'awaiting_payment' : 'pending',
      payment_method: payment.method,
      ziina_payment_id: ziinaPaymentId,
      customer_name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: order.address || undefined,
      delivery_option: order.deliveryOptionId,
      delivery_text: order.deliveryText,
      bracelet_size: order.sizeText,
      base_color: order.baseColor,
      items: { charms: order.lines, layout: order.layout },
      discount_code: order.promoCode || undefined,
      subtotal_aed: Math.round((priced.subtotal + priced.discount) * 100) / 100,
      discount_aed: priced.discount,
      delivery_fee_aed: priced.deliveryFee,
      total_aed: priced.total,
      notes: customer.notes || undefined,
      email_template: 'builder',
      email_params: braceletEmailParams(order, payment.label),
    },
    stockLines,
  };
}
