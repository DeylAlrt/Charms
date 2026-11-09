/**
 * Sends the shop's emails (orders and contact messages) from the server,
 * through EmailJS's REST API. Browsers never send these directly, so the
 * contents always come from the server's own checks and catalogue.
 *
 * EmailJS dashboard setup, in EACH of the two EmailJS accounts:
 *   - Account → Security: "Allow EmailJS API for non-browser applications" ON
 *   - Account → API keys: copy the Private Key into Vercel's environment variables
 *     (EMAILJS_PRIVATE_KEY for the builder account, EMAILJS_SITE_PRIVATE_KEY for
 *     the main site's order account), then turn on "Use Private Key" under
 *     Security so nobody else can send with the public key.
 */

const EMAILJS_REST_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

// builder — the charm builder's bracelet order (per-slot charm pictures)
// site    — the main site's cart order (items_html)
// contact — the main site's contact form (same EmailJS account as the builder)
const EMAILJS_TEMPLATES = {
  builder: { serviceId: 'service_335t5bn', templateId: 'template_dpoi8cn', publicKey: '-2tCjwFJUnT97N93w', privateKeyEnv: 'EMAILJS_PRIVATE_KEY' },
  site: { serviceId: 'service_ff6chqi', templateId: 'template_k1boxcg', publicKey: 'vvg-sBt7pyZ2SOfHk', privateKeyEnv: 'EMAILJS_SITE_PRIVATE_KEY' },
  contact: { serviceId: 'service_vc0fhb9', templateId: 'template_ljnicp3', publicKey: '-2tCjwFJUnT97N93w', privateKeyEnv: 'EMAILJS_PRIVATE_KEY' },
} as const;

export type OrderEmailTemplate = keyof typeof EMAILJS_TEMPLATES;

/** Sends one email with the given EmailJS template. Throws if EmailJS refuses it. */
export async function sendOrderNotificationEmail(
  templateParams: Record<string, string>,
  template: OrderEmailTemplate = 'builder'
): Promise<void> {
  const { serviceId, templateId, publicKey, privateKeyEnv } = EMAILJS_TEMPLATES[template];
  const accessToken = process.env[privateKeyEnv];
  const res = await fetch(EMAILJS_REST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      ...(accessToken ? { accessToken } : {}),
      template_params: templateParams,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`EmailJS REST send failed (${res.status}): ${text}`);
  }
}
