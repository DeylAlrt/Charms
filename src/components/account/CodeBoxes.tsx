"use client";

import { useRef, useState } from 'react';

/**
 * The sign-in code as six boxes. Underneath is one real (invisible) input, so
 * pasting the whole code, the phone's "From Mail" suggestion and backspace all
 * just work; the boxes only show the digits.
 */
export default function CodeBoxes({ value, onChange, onComplete, length = 6, disabled }: {
  value: string;
  onChange: (code: string) => void;
  /** Called once every box is filled. */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const update = (raw: string) => {
    const code = raw.replace(/\D/g, '').slice(0, length);
    onChange(code);
    if (code.length === length) onComplete?.(code);
  };

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden="true">
        {Array.from({ length }, (_, i) => {
          const active = focused && (i === value.length || (i === length - 1 && value.length === length));
          return (
            <div
              key={i}
              className={`aspect-[4/5] max-h-16 rounded-xl border-2 flex items-center justify-center text-2xl sm:text-3xl font-bold text-navy bg-white transition-colors ${
                active ? 'border-accent-blue shadow-[0_0_0_3px_rgba(45,121,186,0.18)]' : value[i] ? 'border-navy' : 'border-navy/25'
              }`}
            >
              {value[i] ?? (active ? <span className="w-[2px] h-7 bg-accent-blue animate-pulse" /> : '')}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        aria-label="Code from the email"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        disabled={disabled}
        autoFocus
        onChange={e => update(e.target.value)}
        onPaste={e => { e.preventDefault(); update(e.clipboardData.getData('text')); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Invisible but still the thing you type into (covers the boxes, so tapping any box focuses it)
        className="absolute inset-0 w-full h-full opacity-0 cursor-text text-base"
      />
    </div>
  );
}
