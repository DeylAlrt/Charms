"use client";

import { useEffect, useRef, useState } from 'react';

export type PickerOption<T extends string> = {
  value: T;
  title: string;
  /** Smaller line under the title, e.g. "16 links · wrist 14–15 cm". */
  detail?: string;
  /** Little highlight pill, e.g. "Most popular". */
  badge?: string;
  /** Shown greyed out and can't be picked (e.g. sold out). */
  disabled?: boolean;
  /** Picture or icon on the left. */
  icon?: React.ReactNode;
};

type PickerMenuProps<T extends string> = {
  /** What the menu is for, read out by screen readers ("Bracelet size"). */
  label: string;
  value: T;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  /** What the closed button shows. */
  children: React.ReactNode;
  /** Which edge of the button the open menu lines up with (use "right" for a button near the right edge). */
  align?: 'left' | 'right';
  /** Extra line at the bottom of the open menu (e.g. a size guide link). */
  footer?: React.ReactNode;
  /** Optional: open/close the menu from outside (e.g. tapping the watch on the bracelet). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * A rounded pill button that opens a card of choices, in the shop's style —
 * in place of the browser's plain dropdown. Closes on a choice, a tap
 * outside, or Escape.
 */
export default function PickerMenu<T extends string>({ label, value, options, onChange, children, align = 'left', footer, open: openProp, onOpenChange }: PickerMenuProps<T>) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOpenState(next));
  const ref = useRef<HTMLDivElement | null>(null);
  // The latest close function, for the listeners below (set up once per opening)
  const closeRef = useRef(() => {});
  closeRef.current = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) closeRef.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`lift flex items-center gap-1.5 min-h-8 pl-1 pr-2.5 py-0.5 rounded-full border bg-white text-navy text-xs font-semibold shadow-sm transition-colors ${
          open ? 'border-accent-blue ring-2 ring-sky-tint' : 'border-sky-tint hover:border-accent-blue'
        }`}
      >
        {children}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className={`flex-shrink-0 text-accent-blue transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={`picker-pop absolute top-full mt-2 z-[60] w-64 max-w-[85vw] rounded-2xl bg-white border border-sky-tint shadow-xl p-1.5 ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}
        >
          {options.map(option => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled}
                disabled={option.disabled}
                onClick={() => { onChange(option.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${
                  option.disabled ? 'opacity-50 cursor-not-allowed' : selected ? 'bg-sky-tint-light' : 'hover:bg-sky-tint-light/60'
                }`}
              >
                {option.icon && <span className="w-8 h-8 flex-shrink-0 rounded-full bg-white border border-sky-tint flex items-center justify-center overflow-hidden">{option.icon}</span>}
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                    {option.title}
                    {option.badge && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-pink/20 text-[#c2185b] px-1.5 py-0.5 rounded-full">
                        {option.badge}
                      </span>
                    )}
                  </span>
                  {option.detail && <span className="text-xs text-muted">{option.detail}</span>}
                </span>
                <span
                  aria-hidden
                  className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] ${selected ? 'bg-navy border-navy text-white' : 'border-sky-tint'}`}
                >
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
          {footer && <div className="border-t border-sky-tint mt-1.5 pt-1.5 px-2.5 pb-1 text-xs">{footer}</div>}
        </div>
      )}
    </div>
  );
}
