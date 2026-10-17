"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { StripCharmPicture, TwinChainLayer, hangRoom, meetingSides, mirroredSpots, spotVar, useSpotGeometry } from './StripLinks';
import { partnerOf } from './twinChains';
import { baseColorOptions, type BaseColor, type Charm } from '../charmEditorUtils';
import { useBraceletScrollbar } from './useBraceletScrollbar';
import FullDesignModal from './FullDesignModal';
import type { BRACELET_SIZES } from './useBracelet';

type BraceletSize = keyof typeof BRACELET_SIZES;

type BraceletStripProps = {
  bracelet: Charm[];
  maxSlots: number;
  filled: number;
  subtotal: number;
  size: BraceletSize;
  onSizeChange: (size: BraceletSize) => void;
  selectedBaseColor: BaseColor;
  onBaseColorChange: (color: BaseColor) => void;
  onClear: () => void;
  onMoveCharm: (fromIndex: number, toIndex: number) => void;
  onRemoveCharmAt: (index: number) => void;
  /** A short message to show above the strip (e.g. a twin chain stretched too far). */
  notice: string | null;
  /** The spot the customer tapped; the next catalog charm goes there. */
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
};

/** An invisible picture for the browser to show under the mouse while
 *  dragging, so only the charm sliding in the strip is visible (no ghost). */
let blankDragImage: HTMLImageElement | null = null;
const getBlankDragImage = (): HTMLImageElement => {
  if (!blankDragImage) {
    const img = document.createElement('img'); // ("Image" here is Next's component)
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    blankDragImage = img;
  }
  return blankDragImage;
};

/** Bounces its charm in when it first appears (globals.css .charm-pop-in). */
function PopIn({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [pop] = useState(enabled); // decided once, so existing charms never bounce again
  return <span className={`absolute inset-0 block ${pop ? "charm-pop-in" : ""}`}>{children}</span>;
}

/**
 * The bracelet card: size/color/total controls and the slot strip.
 *  - Tap a spot to pick it; the next charm tapped in the catalog goes there.
 *  - Drag any charm, plain links included (mouse or finger): the others slide left/right to open a
 *    gap where it will land, and it drops into that gap.
 */
export default function BraceletStrip({
  bracelet, maxSlots, filled, subtotal,
  size, onSizeChange, selectedBaseColor, onBaseColorChange,
  onClear,
  onMoveCharm, onRemoveCharmAt, notice,
  selectedIndex, onSelectIndex,
}: BraceletStripProps) {
  const [showFullDesign, setShowFullDesign] = useState(false);
  // No bounce while the page opens (and restores a saved design), only for later changes
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const scrollbar = useBraceletScrollbar(maxSlots, size);

  // Load the invisible drag picture early so it is ready for the first drag
  useEffect(() => { getBlankDragImage(); }, []);

  // --- Dragging: where the charm came from, where it would land now, and
  // the distance between two spots (so the others slide exactly one spot).
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);
  const [slotPitch, setSlotPitch] = useState(0);
  // Just dropped: skip the slide-back and bounce so the new order appears in place
  const [settling, setSettling] = useState(false);

  const startDrag = (index: number) => {
    const cells = gridRef.current?.children;
    if (cells && cells.length > 1) {
      setSlotPitch((cells[1] as HTMLElement).offsetLeft - (cells[0] as HTMLElement).offsetLeft);
    }
    setDragFrom(index);
    setDragTo(index);
  };

  const stopDrag = () => {
    setDragFrom(null);
    setDragTo(null);
  };

  const dropDrag = () => {
    if (dragFrom !== null && dragTo !== null && dragFrom !== dragTo) {
      setSettling(true);
      onMoveCharm(dragFrom, dragTo);
      onSelectIndex(null);
      setTimeout(() => setSettling(false), 60);
    }
    stopDrag();
  };

  /** Which spot is under this x position (works while charms are sliding).
   *  The pointer can be anywhere on the page: only its left/right position
   *  counts, kept within the visible part of the strip. */
  const slotAtX = (clientX: number) => {
    const grid = gridRef.current;
    const strip = scrollbar.scrollRef.current;
    if (!grid || !strip || !slotPitch) return dragTo;
    const visible = strip.getBoundingClientRect();
    const clampedX = Math.max(visible.left, Math.min(visible.right - 1, clientX));
    const x = clampedX - grid.getBoundingClientRect().left;
    return Math.max(0, Math.min(maxSlots - 1, Math.floor(x / slotPitch)));
  };

  /** How many spots the charm in spot `index` slides while dragging. */
  const shiftFor = (index: number) => {
    if (dragFrom === null || dragTo === null || dragFrom === dragTo) return 0;
    if (index === dragFrom) return dragTo - dragFrom;
    if (dragFrom < dragTo && index > dragFrom && index <= dragTo) return -1;
    if (dragTo < dragFrom && index >= dragTo && index < dragFrom) return 1;
    return 0;
  };

  /** Scroll the strip when the pointer nears (or goes past) either edge. */
  const autoScroll = (clientX: number) => {
    const strip = scrollbar.scrollRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    if (clientX < rect.left + 40) strip.scrollLeft -= 12;
    else if (clientX > rect.right - 40) strip.scrollLeft += 12;
  };

  // Mouse drags: follow the pointer over the whole page, not just the strip,
  // and let go anywhere to drop. (Finger drags already track everywhere.)
  useEffect(() => {
    if (dragFrom === null) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault(); // allows dropping here
      autoScroll(e.clientX);
      const target = slotAtX(e.clientX);
      if (target !== dragTo) setDragTo(target);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dropDrag();
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  });

  const selected = selectedIndex !== null ? bracelet[selectedIndex] : null;
  // A twin chain is picked as a pair: its other half is highlighted too
  const selectedPartner = selectedIndex !== null ? partnerOf(bracelet, selectedIndex) : -1;

  // Room under the spots for dangles and twin chains, and where to draw their chains
  const hang = hangRoom(bracelet.slice(0, maxSlots));
  const geometry = useSpotGeometry(gridRef, [maxSlots, hang]);
  const positionOf = (i: number) => i + shiftFor(i);
  const flipped = mirroredSpots(bracelet.slice(0, maxSlots), positionOf);
  const meets = meetingSides(bracelet.slice(0, maxSlots));

  return (
    <div className="bg-white rounded-lg shadow-md m-1 mb-0 p-2 flex-shrink-0">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-2 gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-navy">Charms: {filled}/{maxSlots}</p>
          <select value={size} onChange={(e) => onSizeChange(e.target.value as BraceletSize)} className="text-xs px-2 py-1 border border-sky-tint rounded-md bg-white text-navy cursor-pointer transition-colors hover:border-accent-blue">
            <option value="small">Small (16)</option>
            <option value="medium">Medium (18)</option>
            <option value="large">Large (20)</option>
            <option value="xl">XL (22)</option>
          </select>
          <select value={selectedBaseColor} onChange={(e) => onBaseColorChange(e.target.value as BaseColor)} className="text-xs px-2 py-1 border border-sky-tint rounded-md bg-white text-navy capitalize cursor-pointer transition-colors hover:border-accent-blue">
            {baseColorOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm md:text-lg font-bold text-accent-blue">
            Total: {subtotal.toFixed(2)} AED
          </div>
          <button onClick={() => setShowFullDesign(true)} className="lift border border-navy text-navy px-3 py-1 rounded-full text-xs hover:bg-sky-tint">View Full Design</button>
          <button onClick={onClear} className="lift bg-danger text-white px-3 py-1 rounded-full text-xs hover:opacity-90">Clear</button>
        </div>
      </div>

      {notice && (
        <div role="status" className="mb-2 rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
          {notice}
        </div>
      )}

      {selected && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-full bg-sky-tint-light px-3 py-1 text-xs text-navy">
          <span>
            {selected.isPlaceholder
              ? 'Tap a charm below to put it in this spot'
              : selected.pairId
                ? <>Tap a charm below to replace the <strong>{selected.displayName || 'twin chain'}</strong> twin chain (both halves)</>
                : <>Tap a charm below to replace <strong>{selected.displayName || 'this charm'}</strong></>}
          </span>
          <button type="button" onClick={() => onSelectIndex(null)} className="pop flex-shrink-0 font-semibold text-accent-blue hover:underline">
            Cancel
          </button>
        </div>
      )}

      <div
        ref={scrollbar.scrollRef}
        className="w-full overflow-x-auto pb-4 no-scrollbar"
        style={{ touchAction: 'none' }}
        onScroll={scrollbar.updateMetrics}
        onTouchMove={(e) => e.preventDefault()}
      >
        <div
          ref={gridRef}
          className="relative grid gap-1 min-w-max"
          style={{ gridTemplateColumns: `repeat(${maxSlots}, minmax(60px, 1fr))`, alignItems: 'start', ...spotVar(geometry) }}
        >
          {Array.from({ length: maxSlots }, (_, i) => {
            const charm = bracelet[i];
            const isReal = !!charm && !charm.isPlaceholder;
            const isDragged = dragFrom === i;
            const isPicked = (selectedIndex === i || selectedPartner === i) && dragFrom === null;
            return (
              // Bottom padding (a % of the spot's width) leaves room for anything hanging below
              <div key={i} className="p-0 min-w-[60px]" style={{ paddingBottom: `${hang * 100}%` }}>
                <div
                  className={`w-full aspect-square bg-white/90 rounded-sm shadow-sm border-2 flex items-center justify-center relative transition-colors ${
                    isPicked ? 'border-accent-blue' : 'border-transparent'
                  }`}
                  data-slot-index={i}
                >
                  {charm && (
                    <>
                      {selectedIndex === i && isReal && dragFrom === null && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCharmAt(i);
                            onSelectIndex(null);
                          }}
                          className="absolute right-1 top-1 z-20 h-5 w-5 rounded-full bg-danger text-white text-[10px] flex items-center justify-center shadow"
                          aria-label="Remove charm"
                        >
                          ×
                        </button>
                      )}
                      <div
                        draggable
                        onClick={() => onSelectIndex(selectedIndex === i ? null : i)}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setDragImage(getBlankDragImage(), 0, 0);
                          e.dataTransfer.setData('text/plain', String(i));
                          // Next frame, so changing styles doesn't cancel the browser's drag
                          requestAnimationFrame(() => startDrag(i));
                        }}
                        onDragEnd={stopDrag}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startDrag(i);
                        }}
                        onTouchMove={(e) => {
                          if (dragFrom === null) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const touch = e.touches[0];
                          autoScroll(touch.clientX);
                          const target = slotAtX(touch.clientX);
                          if (target !== dragTo) setDragTo(target);
                        }}
                        onTouchEnd={(e) => {
                          if (dragFrom === null) return;
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragTo === dragFrom) {
                            // A tap, not a drag: pick this spot (or un-pick it if already picked)
                            onSelectIndex(selectedIndex === i ? null : i);
                            stopDrag();
                          } else {
                            dropDrag();
                          }
                        }}
                        onTouchCancel={stopDrag}
                        style={{
                          touchAction: 'none',
                          userSelect: 'none',
                          // Only a sliding/dragged charm gets its own layer; otherwise its hanging part
                          // must be free to go under the neighbouring links (see StripLinks)
                          transform: shiftFor(i) || isDragged
                            ? `translateX(${shiftFor(i) * slotPitch}px)${isDragged && dragTo !== dragFrom ? ' scale(1.08)' : ''}`
                            : undefined,
                          transition: settling ? 'none' : 'transform 0.2s ease',
                          // While moving (dragged, or sliding aside to make room) a charm passes over the
                          // next spot's white square, so it needs a layer above those squares — otherwise
                          // it looks faded. Charms at rest stay layer-free (see the comment above).
                          zIndex: isDragged ? 10 : shiftFor(i) ? 5 : undefined,
                          position: 'relative',
                        }}
                        className={`w-full h-full ${isDragged ? 'drop-shadow-lg' : ''}`}
                      >
                        <PopIn key={charm.id} enabled={ready && !settling}>
                          <StripCharmPicture charm={charm} mirrored={flipped.has(i)} meet={dragFrom === null ? meets.get(i) : undefined} gapPx={2} />
                        </PopIn>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <TwinChainLayer bracelet={bracelet.slice(0, maxSlots)} geometry={geometry} positionOf={positionOf} />
        </div>
      </div>

      {/* Swipe-to-scroll is disabled on the strip above (that gesture drags
          charms instead), so this draggable bar is the strip's only
          scrollbar — styled after the jump-nav scrollbar on
          navilleracharms.vercel.app's collection page. The browser's own
          scrollbar is hidden via the .no-scrollbar class above. */}
      <div
        ref={scrollbar.trackRef}
        onPointerDown={scrollbar.onThumbPointerDown}
        onPointerMove={scrollbar.onThumbPointerMove}
        onPointerUp={scrollbar.onThumbPointerUp}
        onPointerCancel={scrollbar.onThumbPointerUp}
        // The row is taller than the visible bar so there's a real touch
        // target to drag, even though the bar itself is drawn thin.
        className="relative w-full h-3 mt-2 flex items-center cursor-pointer"
        style={{ touchAction: 'none' }}
      >
        <div className="w-full h-1 rounded-full bg-sky-tint-light overflow-hidden pointer-events-none">
          <div
            className="h-full rounded-full"
            style={{
              width: `${scrollbar.metrics.thumbPct}%`,
              marginLeft: `${scrollbar.metrics.leftPct}%`,
              background: 'linear-gradient(90deg, rgba(167,199,231,0), #a7c7e7 85%)',
            }}
          />
        </div>
        {scrollbar.metrics.thumbPct < 100 && (
          <Image
            className="bracelet-scrollbar-butterfly"
            src="https://ik.imagekit.io/mpojoducq/Navillera%20Logo.png?updatedAt=1774342570466&tr=w-64"
            alt=""
            width={28}
            height={28}
            unoptimized
            draggable={false}
            style={{ left: `${scrollbar.metrics.leftPct + scrollbar.metrics.thumbPct}%` }}
          />
        )}
      </div>

      <FullDesignModal
        open={showFullDesign}
        onClose={() => setShowFullDesign(false)}
        bracelet={bracelet}
        maxSlots={maxSlots}
        filled={filled}
      />
    </div>
  );
}
