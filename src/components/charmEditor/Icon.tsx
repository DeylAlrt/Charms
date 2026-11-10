/**
 * Line icons for the builder and cart, drawn to match the watch icon in the picker:
 * a 24px grid, rounded strokes, in the text colour (`currentColor`).
 */

const PATHS = {
  sparkles: (
    <>
      <path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7L11 3.5z" />
      <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </>
  ),
  message: <path d="M12 4a8 8 0 1 1-4 14.9L4 20l1.1-3.9A8 8 0 0 1 12 4z" />,
  plane: <path d="M12 2.5c.9 0 1.5.8 1.5 1.8v5.2l7.5 4.5v2l-7.5-2.3V18l2 1.5V21L12 20l-3.5 1v-1.5l2-1.5v-4.3L3 16v-2l7.5-4.5V4.3c0-1 .6-1.8 1.5-1.8z" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8h13l-1 12.5h-11z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  metro: (
    <>
      <rect x="6" y="3" width="12" height="14" rx="3" />
      <path d="M6 10h12M8.5 17l-2 4M15.5 17l2 4" />
      <circle cx="9" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 11L12 3.8l8.5 7.2" />
      <path d="M6 9.5V20h12V9.5M10 20v-5h4v5" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  bank: (
    <>
      <path d="M3.5 9.5L12 4.5l8.5 5H3.5z" />
      <path d="M6 12v5M10 12v5M14 12v5M18 12v5M4 20h16" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13M12 16.5h.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`flex-shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
