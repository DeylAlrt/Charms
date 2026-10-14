import { useEffect, useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import { PROMO_CODES } from '@/lib/orderPricing';
import { charmImageUrl, plainCharmFile, type BaseColor, type Charm } from '../charmEditorUtils';
import {
  DELIVERY_DATE_TEXT, DELIVERY_OPTIONS, describeDelivery, getDeliveryOption, paymentLabel,
  type DeliveryMethod, type PaymentMethod,
} from './orderOptions';

/** Extracts a human-readable message from a caught value of unknown shape. */
const getErrorMessage = (err: unknown, fallback = 'Unknown error'): string => {
  if (err && typeof err === 'object') {
    const { text, message } = err as { text?: unknown; message?: unknown };
    if (typeof text === 'string') return text;
    if (typeof message === 'string') return message;
  }
  return typeof err === 'string' ? err : fallback;
};

/** Charm name for orders and emails; the category disambiguates labels like "Star" that appear in several sections. */
const orderName = (item: Charm) =>
  item.category ? `${item.displayName} (${item.category})` : item.displayName ?? item.filename;

// Same promo codes and new-customer-only restriction as the main site's
// cart (Js_Folder/cart.js) — one-time use tracked per browser.
const HAS_ORDERED_KEY = 'navillera-has-ordered';

const hasOrderedBefore = (): boolean => {
  try {
    return localStorage.getItem(HAS_ORDERED_KEY) === '1';
  } catch {
    return false;
  }
};

const markAsOrdered = () => {
  try {
    localStorage.setItem(HAS_ORDERED_KEY, '1');
  } catch {
    // Storage unavailable (private browsing, etc.) — the promo lock is
    // best-effort, so just skip it silently.
  }
};

type CheckoutContext = {
  bracelet: Charm[];
  maxSlots: number;
  selectedBaseColor: BaseColor;
  subtotal: number;
};

/**
 * The cart drawer's full lifecycle: which of its two views is showing,
 * the checkout form's fields, the promo code, and submitting the finished
 * order (Sheets log + email) — mirrors the drawer on
 * navilleracharms.vercel.app's collection page (Js_Folder/cart.js).
 */
export function useCheckout({ bracelet, maxSlots, selectedBaseColor, subtotal }: CheckoutContext) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<'items' | 'form'>('items');

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [deliveryMethod, setDeliveryMethodState] = useState<DeliveryMethod | null>(null);
  const [deliveryOptionId, setDeliveryOptionId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  /** Picking pick-up or home delivery settles the option; metro still needs a station. */
  const setDeliveryMethod = (method: DeliveryMethod) => {
    setDeliveryMethodState(method);
    setDeliveryOptionId(method === 'metro' ? '' : DELIVERY_OPTIONS.find(o => o.method === method)!.id);
  };
  const deliveryOption = getDeliveryOption(deliveryOptionId);
  const deliveryFee = deliveryOption?.fee ?? 0;

  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoLocked, setPromoLocked] = useState(false);

  const [orderStatus, setOrderStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ziina is paid right here in an embedded iframe; Cash on Delivery and
  // Bank Transfer just send the order, and the details follow on WhatsApp.
  const [ziinaSubmitting, setZiinaSubmitting] = useState(false);
  const [ziinaEmbedUrl, setZiinaEmbedUrl] = useState<string | null>(null);
  const [ziinaResult, setZiinaResult] = useState<'success' | 'failed' | 'canceled' | null>(null);
  const ziinaIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    emailjs.init('-2tCjwFJUnT97N93w'); // EmailJS Public Key
  }, []);

  useEffect(() => {
    setPromoLocked(hasOrderedBefore());
  }, []);

  // Back from Ziina's payment page (?ziina=success / cancel / failed): show
  // the result and tidy the address bar. The order itself is only confirmed
  // by the Ziina webhook, which re-checks the payment with Ziina, so editing
  // this address can't create a paid order.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('ziina');
    if (!outcome) return;
    if (outcome === 'success') {
      setZiinaResult('success');
      markAsOrdered();
    } else if (outcome === 'cancel') {
      setZiinaResult('canceled');
    } else if (outcome === 'failed') {
      setZiinaResult('failed');
    }
    params.delete('ziina');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
  }, []);

  // Listens for Ziina's embedded-checkout postMessage events. The order
  // itself isn't confirmed here — that only happens once the Ziina webhook
  // re-verifies payment status server-side — this just drives the UI.
  useEffect(() => {
    function handleZiinaMessage(event: MessageEvent) {
      const iframe = ziinaIframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;
      if (event.origin !== 'https://pay.ziina.com') return;

      const { type, data } = (event.data || {}) as { type?: string; data?: { status?: string } };
      if (type !== 'ZIINA_PAYMENT_STATUS_CHANGE') return;

      if (data?.status === 'COMPLETED') {
        setZiinaResult('success');
        setZiinaEmbedUrl(null);
      } else if (data?.status === 'FAILED') {
        setZiinaResult('failed');
        setZiinaEmbedUrl(null);
      } else if (data?.status === 'CANCELED') {
        setZiinaResult('canceled');
        setZiinaEmbedUrl(null);
      }
    }

    window.addEventListener('message', handleZiinaMessage);
    return () => window.removeEventListener('message', handleZiinaMessage);
  }, []);

  const openCart = () => {
    setView('items');
    setOrderStatus(null);
    setDrawerOpen(true);
  };
  const closeDrawer = () => setDrawerOpen(false);
  const goToCheckout = () => setView('form');
  const backToItems = () => setView('items');

  const applyPromoCode = () => {
    if (promoLocked) {
      setAppliedPromo(null);
      setPromoMessage({ text: "This code is for new customers only — looks like you've already placed an order from this device.", type: 'error' });
      return;
    }
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoMessage({ text: 'Enter a promo code.', type: 'error' });
      return;
    }
    const percent = PROMO_CODES[code];
    if (percent === undefined) {
      setAppliedPromo(null);
      setPromoMessage({ text: "That code isn't valid.", type: 'error' });
      return;
    }
    setAppliedPromo({ code, percent });
    setPromoMessage({ text: `"${code}" applied — ${Math.round(percent * 100)}% off!`, type: 'success' });
  };

  const discount = subtotal * (appliedPromo?.percent ?? 0);
  const subtotalAfterDiscount = subtotal - discount;

  /** Builds the per-slot image/name fields EmailJS' order template expects. */
  const buildCharmEmailFields = (baseUrl: string) => {
    const fields: Record<string, string> = {};
    const textLayoutLines: string[] = [];
    const plainCharmUrl = baseUrl + charmImageUrl(plainCharmFile(selectedBaseColor));

    for (let i = 0; i < 22; i++) {
      const item = i < maxSlots ? bracelet[i] : undefined;
      const isEmpty = !item || item.isPlaceholder;
      const imageUrl = isEmpty ? plainCharmUrl : baseUrl + item.img;
      const charmName = isEmpty
        ? (i < maxSlots ? `${selectedBaseColor} Plain` : 'Empty')
        : orderName(item);

      fields[`charm_${i + 1}_url`] = imageUrl;
      fields[`charm_${i + 1}_name`] = charmName;
      if (i < maxSlots) {
        textLayoutLines.push(isEmpty ? `[${i + 1}] ${selectedBaseColor} Plain Charm` : `[${i + 1}] ${charmName}`);
      }
    }

    fields.text_layout = textLayoutLines.join('\n');
    return fields;
  };

  const resetForm = () => {
    setEmail('');
    setPhoneNumber('');
    setCustomerName('');
    setDeliveryMethodState(null);
    setDeliveryOptionId('');
    setAddress('');
    setNotes('');
    setPaymentMethod(null);
  };

  /** Plain-language reason the form can't be sent yet, or null when it's complete. */
  const findMissingStep = (): string | null => {
    if (!email || !phoneNumber || !customerName) return 'Please fill in your email, WhatsApp number and name (step 1).';
    if (!deliveryMethod) return 'Please choose how you want to get your order (step 2).';
    if (!deliveryOption) return 'Please choose a metro station (step 2).';
    if (deliveryOption.needsAddress && !address.trim()) return 'Please type your home address (step 2).';
    if (!paymentMethod) return 'Please choose how you want to pay (step 3).';
    return null;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const missing = findMissingStep();
    if (missing || !deliveryOption || !paymentMethod) {
      setOrderStatus({ text: missing ?? 'Please complete every step.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setOrderStatus(null);

    const deliveryText = describeDelivery(deliveryOption, address);
    const total = subtotalAfterDiscount + deliveryFee;
    const charmsList = bracelet
      .filter(item => item && !item.isPlaceholder)
      .map(orderName)
      .join(', ');
    const baseUrl = window.location.origin;

    if (paymentMethod === 'ziina') {
      setZiinaSubmitting(true);
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName,
            phone: phoneNumber,
            email,
            meetupPlace: deliveryText,
            deliveryDate: DELIVERY_DATE_TEXT,
            notes,
            braceletSize: `${maxSlots} charms`,
            baseColor: selectedBaseColor,
            // The server recomputes the price from these — it never trusts a total from the browser
            slots: Array.from({ length: maxSlots }, (_, i) => bracelet[i]?.filename ?? plainCharmFile(selectedBaseColor)),
            deliveryOptionId,
            promoCode: appliedPromo?.code ?? '',
            charmsList,
            emailFields: buildCharmEmailFields(baseUrl),
          }),
        });
        const data = await response.json();
        if (!data.success) {
          setOrderStatus({ text: 'Could not start online payment: ' + data.error, type: 'error' });
          return;
        }
        // Go to Ziina's secure payment page; Ziina sends the customer back to
        // ?ziina=success / cancel / failed (handled in the effect above).
        window.location.assign(data.redirect_url);
        return;
      } catch (error) {
        setOrderStatus({ text: 'Could not start online payment: ' + getErrorMessage(error), type: 'error' });
      } finally {
        setZiinaSubmitting(false);
        setSubmitting(false);
      }
      return;
    }

    // --- Cash on Delivery / Bank Transfer: send the order now, details follow on WhatsApp ---
    const payment = paymentLabel(paymentMethod);
    const emailParams = {
      to_email: 'sales.navilleracharms@gmail.com',
      customer_name: customerName,
      phone: phoneNumber,
      customer_email: email,
      pickup_time: '',
      meetup_place: deliveryText,
      delivery_date: DELIVERY_DATE_TEXT,
      payment_method: payment,
      // Payment is repeated in the notes so it shows even in a template without {{payment_method}}.
      notes: notes ? `Payment: ${payment}\n${notes}` : `Payment: ${payment}`,
      bracelet_size: `${maxSlots} charms`,
      base_color: selectedBaseColor,
      subtotal: subtotal.toFixed(2),
      promo_code: appliedPromo ? appliedPromo.code : 'None',
      discount: discount.toFixed(2),
      delivery_fee: deliveryFee.toFixed(2),
      total: total.toFixed(2),
      ...buildCharmEmailFields(baseUrl),
    };

    // Log the order to Google Sheets. Non-fatal: the email is what actually
    // notifies the shop, so an order should still go through if this fails.
    // The sheet's old "Pickup Time" column (C) now holds the payment method.
    try {
      const sheetResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderData: {
            customerName,
            phone: phoneNumber,
            pickupTime: payment,
            meetupPlace: deliveryText,
            deliveryDate: DELIVERY_DATE_TEXT,
            size: `${maxSlots} charms`,
            charms: charmsList,
            subtotal: subtotalAfterDiscount.toFixed(2),
            deliveryFee: deliveryFee.toFixed(2),
            total: total.toFixed(2),
          },
        }),
      });
      const sheetData = await sheetResponse.json();
      if (!sheetData.success) {
        console.error('Failed to save order to Google Sheets:', sheetData.error);
      }
    } catch (sheetError) {
      console.error('Google Sheets request failed:', sheetError);
    }

    try {
      await emailjs.send('service_335t5bn', 'template_dpoi8cn', emailParams);
      setOrderStatus({ text: "Thank you! 🎉 Your order is sent. We'll message you on WhatsApp soon.", type: 'success' });
      markAsOrdered();
      setPromoLocked(true);
      setAppliedPromo(null);
      setPromoInput('');
      setPromoMessage(null);
      resetForm();
      setTimeout(() => setDrawerOpen(false), 3500);
    } catch (error) {
      console.error('Email sending failed:', error);
      setOrderStatus({ text: 'Sorry, something went wrong sending your order: ' + getErrorMessage(error), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const closeZiinaResult = () => {
    const wasSuccess = ziinaResult === 'success';
    setZiinaResult(null);
    if (wasSuccess) {
      resetForm();
      setDrawerOpen(false);
    }
  };

  return {
    drawerOpen,
    view,
    openCart,
    closeDrawer,
    goToCheckout,
    backToItems,
    paymentMethod,
    setPaymentMethod,
    ziinaSubmitting,
    ziinaEmbedUrl,
    setZiinaEmbedUrl,
    ziinaResult,
    ziinaIframeRef,
    closeZiinaResult,
    form: {
      customerName, setCustomerName,
      phoneNumber, setPhoneNumber,
      email, setEmail,
      deliveryMethod, setDeliveryMethod,
      deliveryOptionId, setDeliveryOptionId,
      deliveryOption,
      address, setAddress,
      notes, setNotes,
    },
    deliveryFee,
    promo: {
      input: promoInput, setInput: setPromoInput,
      message: promoMessage,
      applied: appliedPromo,
      locked: promoLocked,
      apply: applyPromoCode,
    },
    discount,
    subtotalAfterDiscount,
    orderStatus,
    submitting,
    handleFormSubmit,
  };
}
