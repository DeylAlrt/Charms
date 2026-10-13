"use client";

import { useEffect } from 'react';
import Image from 'next/image';
import type { Charm } from '../charmEditorUtils';

type FullDesignModalProps = {
  open: boolean;
  onClose: () => void;
  bracelet: Charm[];
  maxSlots: number;
  filled: number;
};

/**
 * Shows the whole bracelet in one row, every link side by side like the real
 * thing, so customers can see (and screenshot) their full design at once.
 */
export default function FullDesignModal({ open, onClose, bracelet, maxSlots, filled }: FullDesignModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const slots = Array.from({ length: maxSlots }, (_, i) => bracelet[i]);

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-design-title"
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-sky-tint">
          <h2 id="full-design-title" className="font-serif italic font-bold text-xl sm:text-2xl text-navy">
            Your Full Design
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pop w-9 h-9 rounded-full hover:bg-sky-tint-light flex items-center justify-center text-navy"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5">
          <p className="text-center text-xs sm:text-sm text-muted mb-3">
            You can take a screenshot for your own reference.
          </p>

          {/* The bracelet: every link the same width, touching, in one row */}
          <div className="bg-sky-tint-light border border-sky-tint rounded-xl px-2 sm:px-4 py-6 sm:py-8">
            <div className="flex justify-center">
              {slots.map((charm, i) => (
                <div
                  key={i}
                  className="relative aspect-square"
                  style={{ width: `calc(100% / ${maxSlots})`, maxWidth: 44 }}
                >
                  {charm && (
                    <Image
                      src={charm.img}
                      alt={charm.isPlaceholder ? 'Plain link' : (charm.displayName || charm.filename)}
                      fill
                      sizes="44px"
                      unoptimized
                      draggable={false}
                      className="object-contain select-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs sm:text-sm font-semibold text-navy mt-3">
            {filled} of {maxSlots} charms added
          </p>

          <div className="mt-4 bg-cream/60 rounded-xl px-4 py-3 text-xs sm:text-sm text-navy leading-relaxed">
            <strong>📸 Reminder:</strong> Any spot you haven&apos;t filled is a plain link in your chosen
            colour. Check your design before ordering — this is how your bracelet will be made.
          </div>
        </div>
      </div>
    </div>
  );
}
