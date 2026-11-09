'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile's "I'm human" check. Shows nothing until
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in Vercel. Each pass gives one token,
 * good for one order: change `resetKey` after sending to get a fresh one.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptLoading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')));
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error('Could not load Turnstile'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export default function HumanCheck({ onToken, resetKey }: { onToken: (token: string) => void; resetKey: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !boxRef.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    onTokenRef.current('');
    loadTurnstile()
      .then(turnstile => {
        if (cancelled || !boxRef.current) return;
        widgetId = turnstile.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          size: 'flexible',
          theme: 'light',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
      })
      .catch(err => console.error(err));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={boxRef} className="min-h-[65px]" />;
}

/** A form field people never see, so only bots fill it in. */
export function HoneypotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={e => onChange(e.target.value)} />
      </label>
    </div>
  );
}
