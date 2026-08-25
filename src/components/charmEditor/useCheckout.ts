import { useEffect, useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import type { BaseColor, Charm } from '../charmEditorUtils';

/** Extracts a human-readable message from a caught value of unknown shape. */
const getErrorMessage = (err: unknown, fallback = 'Unknown error'): string => {
  if (err && typeof err === 'object') {
    const { text, message } = err as { text?: unknown; message?: unknown };
    if (typeof text === 'string') return text;
    if (typeof message === 'string') return message;
  }
  return typeof err === 'string' ? err : fallback;
};

const stripExtension = (filename: string) => filename.replace(/\.(png|jpg|jpeg)$/i, '');

export const getDeliveryFee = (place: string): number => {
  if (place.includes('Mall of the Emirates Metro') || place.includes('DMCC Metro')) return 5;
  if (place.includes('Union Metro') || place.includes('Burjuman Metro')) return 10;
  if (place.includes('Dubai: 20 AED')) return 20;
  if (place.includes('Other Emirates: 25 AED')) return 25;
  return 0; // Free delivery
};

// Same promo codes and new-customer-only restriction as the main site's
// cart (Js_Folder/cart.js) — one-time use tracked per browser.
const PROMO_CODES: Record<string, number> = {
  NEWBABE: 0.05,
};
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

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [meetupPlace, setMeetupPlace] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoLocked, setPromoLocked] = useState(false);

  const [orderStatus, setOrderStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pay on pickup/delivery (the flow above) vs. pay online now via Ziina,
  // embedded in an iframe right in the drawer.
  const [paymentMethod, setPaymentMethod] = useState<'pickup' | 'online'>('pickup');
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
    const plainCharmUrl = `${baseUrl}/charms/${selectedBaseColor}_Plain_Charm.png`;

    for (let i = 0; i < 22; i++) {
      const item = i < maxSlots ? bracelet[i] : undefined;
      const isEmpty = !item || item.isPlaceholder;
      const imageUrl = isEmpty ? plainCharmUrl : baseUrl + item.img;
      const charmName = isEmpty
        ? (i < maxSlots ? `${selectedBaseColor} Plain` : 'Empty')
        : stripExtension(item.filename);

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
    setCustomerName('');
    setPhoneNumber('');
    setEmail('');
    setPickupTime('');
    setMeetupPlace('');
    setDeliveryDate('');
    setNotes('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!customerName || !phoneNumber || !pickupTime || !meetupPlace || !deliveryDate) {
      setOrderStatus({ text: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setOrderStatus(null);

    const deliveryFee = getDeliveryFee(meetupPlace);
    const total = subtotalAfterDiscount + deliveryFee;
    const charmsList = bracelet
      .filter(item => item && !item.isPlaceholder)
      .map(item => item.displayName)
      .join(', ');
    const baseUrl = window.location.origin;

    if (paymentMethod === 'online') {
      setZiinaSubmitting(true);
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName,
            phone: phoneNumber,
            pickupTime,
            meetupPlace,
            deliveryDate,
            braceletSize: `${maxSlots} charms`,
            baseColor: selectedBaseColor,
            subtotal: subtotalAfterDiscount,
            deliveryFee,
            total,
            charmsList,
            emailFields: buildCharmEmailFields(baseUrl),
          }),
        });
        const data = await response.json();
        if (!data.success) {
          setOrderStatus({ text: 'Could not start online payment: ' + data.error, type: 'error' });
          return;
        }
        setZiinaEmbedUrl(data.embedded_url);
      } catch (error) {
        setOrderStatus({ text: 'Could not start online payment: ' + getErrorMessage(error), type: 'error' });
      } finally {
        setZiinaSubmitting(false);
        setSubmitting(false);
      }
      return;
    }

    // --- Pay on pickup/delivery: existing flow, unchanged below ---
    const emailParams = {
      to_email: 'Navilleracharmstudio@gmail.com',
      customer_name: customerName,
      phone: phoneNumber,
      customer_email: email || 'None',
      pickup_time: pickupTime,
      meetup_place: meetupPlace,
      delivery_date: deliveryDate,
      notes: notes || 'None',
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
    // Columns are unchanged from before (no promo/email/notes columns) so an
    // already-configured sheet doesn't need to change to keep working.
    try {
      const sheetResponse = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderData: {
            customerName,
            phone: phoneNumber,
            pickupTime,
            meetupPlace,
            deliveryDate,
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
      setOrderStatus({ text: "Thanks! Your order request has been sent — we'll confirm within 1-2 days.", type: 'success' });
      markAsOrdered();
      setPromoLocked(true);
      setAppliedPromo(null);
      setPromoInput('');
      setPromoMessage(null);
      resetForm();
      setTimeout(() => setDrawerOpen(false), 2500);
    } catch (error) {
      console.error('Email sending failed:', error);
      setOrderStatus({ text: 'Something went wrong sending your order: ' + getErrorMessage(error), type: 'error' });
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
      pickupTime, setPickupTime,
      meetupPlace, setMeetupPlace,
      deliveryDate, setDeliveryDate,
      notes, setNotes,
    },
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
