import { useEffect, useRef, useState } from 'react';

/**
 * Drives the custom draggable scrollbar shown under the bracelet strip.
 *
 * Mobile browsers ignore native scrollbar styling, and native touch-scroll
 * is disabled on the strip itself (that gesture drags charms instead), so
 * touch devices need an explicit, always-visible scrollbar to move through
 * the strip. Desktop keeps its native scrollbar (see the .no-scrollbar
 * CSS class) and this bar is hidden there.
 */
export function useBraceletScrollbar(maxSlots: number, size: string) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number; maxScrollLeft: number; trackWidth: number; thumbWidthPx: number } | null>(null);
  const [metrics, setMetrics] = useState({ thumbPct: 100, leftPct: 0 });

  const updateMetrics = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    if (scrollWidth <= clientWidth) {
      setMetrics({ thumbPct: 100, leftPct: 0 });
      return;
    }
    const thumbPct = Math.max((clientWidth / scrollWidth) * 100, 8);
    const maxScrollLeft = scrollWidth - clientWidth;
    const leftPct = (scrollLeft / maxScrollLeft) * (100 - thumbPct);
    setMetrics({ thumbPct, leftPct });
  };

  useEffect(() => {
    updateMetrics();
    window.addEventListener('resize', updateMetrics);
    return () => window.removeEventListener('resize', updateMetrics);
  }, [maxSlots, size]);

  const onThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const trackRect = track.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      maxScrollLeft: el.scrollWidth - el.clientWidth,
      trackWidth: trackRect.width,
      thumbWidthPx: trackRect.width * (metrics.thumbPct / 100),
    };
  };

  const onThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = scrollRef.current;
    if (!drag || !el) return;
    e.preventDefault();
    const trackRange = drag.trackWidth - drag.thumbWidthPx;
    const scrollDelta = trackRange > 0 ? ((e.clientX - drag.startX) / trackRange) * drag.maxScrollLeft : 0;
    el.scrollLeft = Math.min(Math.max(drag.startScrollLeft + scrollDelta, 0), drag.maxScrollLeft);
    updateMetrics();
  };

  const onThumbPointerUp = () => {
    dragRef.current = null;
  };

  return { scrollRef, trackRef, metrics, updateMetrics, onThumbPointerDown, onThumbPointerMove, onThumbPointerUp };
}
