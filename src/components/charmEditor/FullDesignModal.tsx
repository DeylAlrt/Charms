"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { charmImageUrl, type Charm } from '../charmEditorUtils';
import { attachedLinkFile, isWatchPart } from './watches';
import Bracelet3D from './bracelet3d/Bracelet3D';
import Icon from './Icon';
import { supportsWebGL } from './bracelet3d/renderer';
import { StripCharmPicture, TwinChainLayer, WatchLayer, hangRoom, meetingSides, mirroredSpots, spotVar, useSpotGeometry, watchCoveredSpots, watchOverhang } from './StripLinks';

type FullDesignModalProps = {
  open: boolean;
  onClose: () => void;
  bracelet: Charm[];
  maxSlots: number;
  filled: number;
  /** Spots for charms (the watch's spots don't count). */
  charmSpots: number;
};

function BraceletRow({ slots }: { slots: Charm[] }) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const overhang = watchOverhang(slots);
  const hang = Math.max(hangRoom(slots), overhang.below);
  const geometry = useSpotGeometry(rowRef, [slots.length, hang, overhang.above]);
  const flipped = mirroredSpots(slots);
  const meets = meetingSides(slots);
  const covered = watchCoveredSpots(slots);
  return (
    <div ref={rowRef} className="relative flex justify-center items-start" style={spotVar(geometry)}>
      {slots.map((charm, i) => {
        // The watch's spots: WatchLayer draws the watch; plain links fill any space it doesn't cover
        const attached = isWatchPart(charm) && !covered.has(i) ? attachedLinkFile(charm.filename) : null;
        const shown = attached ? { id: `attached-${i}`, filename: attached, img: charmImageUrl(attached) } : isWatchPart(charm) ? null : charm;
        return (
          <div key={i} style={{ width: `calc(100% / ${slots.length})`, maxWidth: 44 }}>
            {/* Room above for a watch face (a % of this spot's width) */}
            <div style={{ paddingBottom: `${overhang.above * 100}%` }} />
            <div className="relative aspect-square" data-spot="">
              {shown && <StripCharmPicture charm={shown} mirrored={flipped.has(i)} meet={meets.get(i)} />}
            </div>
            {/* Room for anything hanging below */}
            <div style={{ paddingBottom: `${hang * 100}%` }} />
          </div>
        );
      })}
      <TwinChainLayer bracelet={slots} geometry={geometry} />
      <WatchLayer bracelet={slots} geometry={geometry} />
    </div>
  );
}

/**
 * Whether to offer the 3D view: only where the browser can draw 3D (WebGL), and not on
 * low-powered phones (few processor cores or little memory, where it would stutter).
 */
function useCan3d() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 8;
    const memory = nav.deviceMemory ?? 8; // GB; only some browsers report it
    setOk(cores >= 3 && memory >= 3 && supportsWebGL());
  }, []);
  return ok;
}

/**
 * Shows the whole bracelet in one row, every link side by side like the real
 * thing, so customers can see (and screenshot) their full design at once.
 */
export default function FullDesignModal({ open, onClose, bracelet, maxSlots, filled, charmSpots }: FullDesignModalProps) {
  // ✏️ Which view opens first: '2d' (one row, exactly how it's made) or '3d' (beta)
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [failed3d, setFailed3d] = useState(false);
  const can3d = useCan3d() && !failed3d;
  const show3d = view === '3d' && can3d;
  // Same list while the bracelet is unchanged, so the 3D view isn't rebuilt on every render
  const slots = useMemo(() => Array.from({ length: maxSlots }, (_, i) => bracelet[i]), [bracelet, maxSlots]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

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
          {can3d && <div className="ml-auto mr-2 inline-flex p-[3px] rounded-full bg-sky-tint-light border border-sky-tint" role="group" aria-label="View">
            {(['2d', '3d'] as const).map(v => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${view === v ? 'bg-navy text-white' : 'text-navy'}`}
              >
                {v === '3d' ? <>3D <span className="text-[10px] uppercase tracking-wide opacity-70 font-medium">Beta</span></> : '2D'}
              </button>
            ))}
          </div>}
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
            {show3d
              ? '3D preview (beta). Drag to turn, pinch to zoom, tap to pause. Use 2D to check exactly how your bracelet will be made.'
              : 'You can take a screenshot for your own reference.'}
          </p>

          {/* The bracelet: every link the same width, touching, in one row,
              with dangles and twin chains hanging below */}
          {show3d ? (
            <div className="rounded-xl border border-sky-tint overflow-hidden" style={{ background: 'radial-gradient(130% 100% at 50% 0%, #fbfcfe 0%, #dfe7f1 100%)' }}>
              <Bracelet3D slots={slots} onUnavailable={() => { setFailed3d(true); setView('2d'); }} />
            </div>
          ) : (
            <div className="bg-sky-tint-light border border-sky-tint rounded-xl px-2 sm:px-4 py-6 sm:py-8">
              <BraceletRow slots={slots} />
            </div>
          )}

          <p className="text-center text-xs sm:text-sm font-semibold text-navy mt-3">
            {filled} of {charmSpots} charms added
          </p>

          <div className="mt-4 flex items-start gap-2.5 bg-cream/60 rounded-xl px-4 py-3 text-xs sm:text-sm text-navy leading-relaxed">
            <Icon name="camera" className="w-5 h-5" />
            <p>
              <strong>Reminder:</strong> Any spot you haven&apos;t filled is a plain link in your chosen
              colour. Check your design before ordering — this is how your bracelet will be made.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
