/**
 * Delivery and payment choices for the order form. Kept in sync with the
 * main site's cart (navilleracharms.vercel.app → Js_Folder/cart.js).
 */

export type DeliveryMethod = 'pickup' | 'metro' | 'home';

export type DeliveryOption = {
  id: string;
  method: DeliveryMethod;
  title: string;
  detail: string;
  fee: number;
  needsAddress?: boolean;
};

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: 'pickup', method: 'pickup', title: 'Pick up', detail: 'Barsha Heights (Tecom)', fee: 0 },
  { id: 'metro-dic-sat', method: 'metro', title: 'DIC Metro', detail: 'Saturday', fee: 0 },
  { id: 'metro-dic', method: 'metro', title: 'DIC Metro', detail: 'Thursday or Friday', fee: 3 },
  { id: 'metro-moe', method: 'metro', title: 'MOE Metro', detail: 'Thursday or Friday', fee: 6 },
  { id: 'metro-dmcc', method: 'metro', title: 'DMCC Metro', detail: 'Thursday or Friday', fee: 6 },
  { id: 'metro-burjuman', method: 'metro', title: 'Burjuman Metro', detail: 'Thursday or Friday', fee: 9 },
  { id: 'metro-union', method: 'metro', title: 'Union Metro', detail: 'Thursday or Friday', fee: 9 },
  { id: 'home', method: 'home', title: 'Home delivery', detail: 'Anywhere in the UAE (Jeebly)', fee: 20, needsAddress: true },
];

export const DELIVERY_METHODS: { method: DeliveryMethod; icon: string; title: string; detail: string; price: string }[] = [
  { method: 'pickup', icon: '🛍️', title: 'Pick up', detail: 'Barsha Heights (Tecom)', price: 'FREE' },
  { method: 'metro', icon: '🚇', title: 'Metro meet-up', detail: 'We meet you at a metro station', price: 'FREE – 9 AED' },
  { method: 'home', icon: '🏠', title: 'Home delivery', detail: 'Anywhere in the UAE (Jeebly)', price: '20 AED' },
];

export const getDeliveryOption = (id: string): DeliveryOption | undefined =>
  DELIVERY_OPTIONS.find(option => option.id === id);

export const getDeliveryFee = (id: string): number => getDeliveryOption(id)?.fee ?? 0;

export const formatFee = (fee: number) => (fee === 0 ? 'FREE' : `${fee} AED`);

/** One-line description for the order email / sheet, e.g. "Metro meet-up: DMCC Metro (Thursday or Friday)". */
export const describeDelivery = (option: DeliveryOption, address: string): string => {
  if (option.method === 'pickup') return `Pick up: ${option.detail}`;
  if (option.method === 'metro') return `Metro meet-up: ${option.title} (${option.detail})`;
  return `Home delivery (Jeebly) — Address: ${address.trim()}`;
};

export type PaymentMethod = 'ziina' | 'cod' | 'bank';

export const PAYMENT_OPTIONS: { id: PaymentMethod; icon: string; title: string; detail: string }[] = [
  { id: 'ziina', icon: '💳', title: 'Pay online now (Ziina)', detail: 'Card, Apple Pay or Google Pay' },
  { id: 'cod', icon: '💵', title: 'Cash on Delivery', detail: 'Pay in cash when you get your order' },
  { id: 'bank', icon: '🏦', title: 'Bank Transfer', detail: "We'll send our bank details on WhatsApp" },
];

export const paymentLabel = (id: PaymentMethod) => PAYMENT_OPTIONS.find(option => option.id === id)!.title;

/** What goes in the order's date field: the exact day is agreed with the customer on WhatsApp. */
export const DELIVERY_DATE_TEXT = 'To be arranged on WhatsApp';
