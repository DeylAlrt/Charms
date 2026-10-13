/**
 * Server-side order notification email, sent via EmailJS's plain REST API.
 *
 * The @emailjs/browser SDK used elsewhere in this app (CharmEditorClient)
 * can't run here — it needs a browser `window`, and this file only runs in
 * API routes (Node). EmailJS's REST endpoint works from any environment,
 * but by default EmailJS blocks requests that don't come from a browser
 * (no Origin header) as an anti-abuse measure.
 *
 * ONE-TIME DASHBOARD STEP: in the EmailJS dashboard, under
 * Account → Security, enable "Allow EmailJS API for non-browser
 * applications" — otherwise this call will fail with a 403 even though
 * the service/template/public key are all correct. This can't be done
 * from code; it's a toggle only you can flip in your account.
 */

const EMAILJS_REST_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

// The same EmailJS service/template/public keys each order form already uses
// in the browser, so paid-online orders arrive as the same emails:
//   builder — the charm builder's bracelet order (per-slot charm pictures)
//   site    — the main site's cart order (Js_Folder/cart.js, items_html)
// The "non-browser applications" setting above must be on in EACH EmailJS
// account these keys belong to.
const EMAILJS_TEMPLATES = {
  builder: { serviceId: 'service_335t5bn', templateId: 'template_dpoi8cn', publicKey: '-2tCjwFJUnT97N93w' },
  site: { serviceId: 'service_ff6chqi', templateId: 'template_k1boxcg', publicKey: 'vvg-sBt7pyZ2SOfHk' },
} as const;

export type OrderEmailTemplate = keyof typeof EMAILJS_TEMPLATES;

/** Sends an order-notification email server-side, using the builder's or the main site's template. */
export async function sendOrderNotificationEmail(
  templateParams: Record<string, string>,
  template: OrderEmailTemplate = 'builder'
): Promise<void> {
  const { serviceId, templateId, publicKey } = EMAILJS_TEMPLATES[template];
  const res = await fetch(EMAILJS_REST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: templateParams,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`EmailJS REST send failed (${res.status}): ${text}`);
  }
}
