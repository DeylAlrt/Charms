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

// Same service/template/public key already used for the pay-on-pickup
// order flow in CharmEditorClient.tsx — reuse it rather than paying for
// a second EmailJS service.
const EMAILJS_SERVICE_ID = 'service_335t5bn';
const EMAILJS_TEMPLATE_ID = 'template_dpoi8cn';
const EMAILJS_PUBLIC_KEY = '-2tCjwFJUnT97N93w';

/** Sends the same order-notification template used for pay-on-pickup orders, server-side. */
export async function sendOrderNotificationEmail(templateParams: Record<string, string>): Promise<void> {
  const res = await fetch(EMAILJS_REST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: templateParams,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`EmailJS REST send failed (${res.status}): ${text}`);
  }
}
