"use client";

import { useState } from 'react';
import Image from 'next/image';
import DraggableCharm from '../DraggableCharm';
import type { BaseColor, Charm } from '../charmEditorUtils';
import { useBraceletScrollbar } from './useBraceletScrollbar';
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
  availableBaseColors: string[];
  ownerMode: boolean;
  onOwnerLogin: () => void;
  onOpenUpload: () => void;
  onOpenCart: () => void;
  onClear: () => void;
  onSwapCharms: (fromIndex: number, toIndex: number) => void;
  onRemoveCharmAt: (index: number) => void;
};

/** The bracelet card: size/color/total controls, the slot strip (drag to reorder), and its mobile scrollbar. */
export default function BraceletStrip({
  bracelet, maxSlots, filled, subtotal,
  size, onSizeChange, selectedBaseColor, onBaseColorChange, availableBaseColors,
  ownerMode, onOwnerLogin, onOpenUpload, onOpenCart, onClear,
  onSwapCharms, onRemoveCharmAt,
}: BraceletStripProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [touchDraggingIndex, setTouchDraggingIndex] = useState<number | null>(null);
  const [isDraggingCharm, setIsDraggingCharm] = useState(false);

  const scrollbar = useBraceletScrollbar(maxSlots, size);

  const handleSwap = (fromIndex: number, toIndex: number) => {
    onSwapCharms(fromIndex, toIndex);
    setSelectedIndex(null);
    setDraggingIndex(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-md m-1 mb-0 p-2 flex-shrink-0">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-2 gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-navy">Charms: {filled}/{maxSlots}</p>
          <select value={size} onChange={(e) => onSizeChange(e.target.value as BraceletSize)} className="text-xs px-2 py-1 border border-sky-tint rounded-md bg-white text-navy">
            <option value="small">Small (16)</option>
            <option value="medium">Medium (18)</option>
            <option value="large">Large (20)</option>
            <option value="xl">XL (22)</option>
          </select>
          <select value={selectedBaseColor} onChange={(e) => onBaseColorChange(e.target.value as BaseColor)} className="text-xs px-2 py-1 border border-sky-tint rounded-md bg-white text-navy capitalize">
            {availableBaseColors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={onOwnerLogin} style={{ opacity: 0, width: '24px', height: '24px', border: 'none', background: 'none' }}></button>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm md:text-lg font-bold text-accent-blue">
            Total: {subtotal.toFixed(2)} AED
          </div>
          {ownerMode && <button onClick={onOpenUpload} className="bg-accent-blue text-white px-3 py-1 rounded-full text-xs hover:bg-pastel-blue hover:text-navy transition-colors">Upload</button>}
          <button onClick={onOpenCart} className="bg-navy text-white px-3 py-1 rounded-full text-xs hover:bg-pastel-blue hover:text-navy transition-colors">Cart</button>
          <button onClick={onClear} className="bg-danger text-white px-3 py-1 rounded-full text-xs hover:opacity-90 transition-opacity">Clear</button>
        </div>
      </div>

      <div
        ref={scrollbar.scrollRef}
        className="w-full overflow-x-auto pb-4 no-scrollbar"
        style={{ touchAction: 'none' }}
        onScroll={scrollbar.updateMetrics}
        onTouchMove={(e) => e.preventDefault()}
      >
        <div className="grid gap-1 min-w-max" style={{ gridTemplateColumns: `repeat(${maxSlots}, minmax(60px, 1fr))`, alignItems: 'center' }}>
          {Array.from({ length: maxSlots }, (_, i) => (
            <div key={i} className="p-0 min-w-[60px]">
              <div
                className="w-full aspect-square bg-white/90 rounded-sm shadow-sm border-2 border-transparent flex items-center justify-center relative"
                data-slot-index={i}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggingIndex !== null && draggingIndex !== i) handleSwap(draggingIndex, i);
                }}
              >
                {bracelet[i] && (
                  <>
                    {selectedIndex === i && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveCharmAt(i);
                          setSelectedIndex(null);
                        }}
                        className="absolute right-1 top-1 z-10 h-5 w-5 rounded-full bg-danger text-white text-[10px] flex items-center justify-center shadow"
                        aria-label="Remove charm"
                      >
                        ×
                      </button>
                    )}
                    <div
                      draggable={!!bracelet[i] && !bracelet[i]?.isPlaceholder}
                      onClick={() => setSelectedIndex(i)}
                      onDragStart={(e) => {
                        if (!bracelet[i]?.isPlaceholder) {
                          setDraggingIndex(i);
                          setSelectedIndex(i);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(i));
                        }
                      }}
                      onDragEnd={() => setDraggingIndex(null)}
                      onTouchStart={(e) => {
                        if (!bracelet[i]?.isPlaceholder) {
                          e.preventDefault();
                          e.stopPropagation();
                          setTouchDraggingIndex(i);
                          setSelectedIndex(i);
                          setIsDraggingCharm(true);
                        }
                      }}
                      onTouchMove={(e) => {
                        if (touchDraggingIndex !== null && isDraggingCharm) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      onTouchEnd={(e) => {
                        if (touchDraggingIndex !== null && isDraggingCharm) {
                          e.preventDefault();
                          e.stopPropagation();
                          const touch = e.changedTouches[0];
                          const element = document.elementFromPoint(touch.clientX, touch.clientY);
                          if (element) {
                            const slotElement = element.closest('[data-slot-index]') as HTMLElement;
                            if (slotElement) {
                              const targetIndex = parseInt(slotElement.getAttribute('data-slot-index') || '-1', 10);
                              if (targetIndex !== -1 && targetIndex !== touchDraggingIndex) {
                                handleSwap(touchDraggingIndex, targetIndex);
                              }
                            }
                          }
                        }
                        setTouchDraggingIndex(null);
                        setIsDraggingCharm(false);
                      }}
                      onTouchCancel={() => {
                        setTouchDraggingIndex(null);
                        setIsDraggingCharm(false);
                      }}
                      style={{ touchAction: 'none', userSelect: 'none' }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <DraggableCharm charm={bracelet[i]} compact={true} interactive={false} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
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
    </div>
  );
}
