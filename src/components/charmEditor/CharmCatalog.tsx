"use client";

import { useEffect, useRef, useState } from 'react';
import DraggableCharm from '../DraggableCharm';
import { charmImageUrl, isCharmSoldOut, type Charm } from '../charmEditorUtils';
import { CATALOGUE_CATEGORIES, CATALOGUE_ENTRIES } from '../charmCatalogue';
import { preloadStripPicture, thumbUrl } from './stripImages';

/**
 * Builds catalog entries in the main site's order, from its catalogue rather
 * than the filenames. Catalogue links whose image is missing are skipped.
 */
function buildCatalog(charmFiles: string[]): Charm[] {
  const onDisk = new Set(charmFiles);
  return CATALOGUE_ENTRIES
    .filter(entry => onDisk.has(entry.file))
    .map((entry, i) => ({
      id: `catalog-${i}`,
      filename: entry.file,
      category: entry.category,
      displayName: entry.displayName,
      img: charmImageUrl(entry.file),
      catalogItem: true,
    }));
}

type CharmCatalogProps = {
  charmFiles: string[];
  onAddCharm: (charm: Charm) => void;
};

/**
 * ✏️ The little picture on each category button: a charm that says at a
 * glance what's in it. A category not listed here (e.g. a new one) uses its
 * first charm.
 */
const CATEGORY_PICTURES: Record<string, string> = {
  'Plain Charms': 'Plain Links/Pink_Plain_Charm.png',
  'Concave Links': 'Concave Links/Concave_Silver_Links (5).png',
  'Letter Links': 'Letter Links/Letters Silver (2).png',
  'Number Links': 'Number Links/Number (2).png',
  'Gold Outline Links': 'Golden Outline Links/Gold_Outline_Links (1).png',
  'Colored Links': 'Colored Links/Colored_Silver_Links (14).png',
  'Flags': 'Flag Links/Flags (7).png',
  'Characters': 'Character Links/Character_Premium_Charms  (4).png',
  'Animals': 'Animal Links/Animal_Premium_Links (2).png',
  'Cars': 'Car Links/Cars_Premium_Charms (5).png',
  'Sports': 'Sport Links/Sports_Premium_Charms (3).png',
  'Premium Charms': 'Premium Links/Premium_Silver_Links (2).png',
  'Magnet Hearts': 'Magnet Hearts/Gold_Dangling_Deluxe_Charms (1).png',
  'Dangling Links': 'Dangling Links/Dangling_Silver_Links (15).png',
  'Twin Chain Links': 'Chain Links/Chain_Silver_Links (6).png',
};

const categoryPicture = (category: string): string | null => {
  const file = CATEGORY_PICTURES[category] ?? CATALOGUE_ENTRIES.find(e => e.category === category)?.file;
  return file ? thumbUrl(file, charmImageUrl(file)) : null;
};

/** "All": a small grid of four tiles. */
function AllIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

/** Category filter bar plus the scrollable charm grid. */
export default function CharmCatalog({ charmFiles, onAddCharm }: CharmCatalogProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const categoryRowRef = useRef<HTMLDivElement | null>(null);
  const [categoriesScrollable, setCategoriesScrollable] = useState(false);
  const [categoryScrollMetrics, setCategoryScrollMetrics] = useState({ thumbPct: 100, leftPct: 0 });

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    // Slide the tapped category into full view, centred in the bar
    const row = categoryRowRef.current;
    const button = row?.querySelector<HTMLElement>(`[data-category="${CSS.escape(activeCategory)}"]`);
    if (row && button) {
      row.scrollTo({ left: button.offsetLeft - (row.clientWidth - button.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, [activeCategory]);

  // Tracks whether the row overflows (so it can be centered instead of
  // scrollable when everything fits, e.g. on wider screens) and where the
  // scroll position is (to drive the little progress bar below it) — same
  // signal .collection-jumpnav.is-scrollable uses on the reference site.
  useEffect(() => {
    const row = categoryRowRef.current;
    if (!row) return;
    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = row;
      const overflowing = scrollWidth > clientWidth + 1;
      setCategoriesScrollable(overflowing);
      if (!overflowing) {
        setCategoryScrollMetrics({ thumbPct: 100, leftPct: 0 });
        return;
      }
      const thumbPct = Math.max((clientWidth / scrollWidth) * 100, 15);
      const maxScrollLeft = scrollWidth - clientWidth;
      const leftPct = (scrollLeft / maxScrollLeft) * (100 - thumbPct);
      setCategoryScrollMetrics({ thumbPct, leftPct });
    };
    update();
    row.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      row.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Holding the little bar under the categories scrolls them: pressing on the
  // bar jumps there, then sliding moves the row along with the finger/mouse.
  const categoryTrackRef = useRef<HTMLDivElement | null>(null);
  const barDrag = useRef<{ startX: number; startScroll: number; range: number; max: number } | null>(null);

  const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const row = categoryRowRef.current;
    const track = categoryTrackRef.current;
    if (!row || !track) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = track.getBoundingClientRect();
    const thumbW = rect.width * (categoryScrollMetrics.thumbPct / 100);
    const range = rect.width - thumbW;
    const max = row.scrollWidth - row.clientWidth;
    // Pressed beside the thumb: jump so the thumb is centred under the finger
    const thumbLeft = rect.left + rect.width * (categoryScrollMetrics.leftPct / 100);
    if (range > 0 && (e.clientX < thumbLeft || e.clientX > thumbLeft + thumbW)) {
      const fraction = (e.clientX - rect.left - thumbW / 2) / range;
      row.scrollLeft = Math.min(Math.max(fraction, 0), 1) * max;
    }
    barDrag.current = { startX: e.clientX, startScroll: row.scrollLeft, range, max };
  };

  const onBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = barDrag.current;
    const row = categoryRowRef.current;
    if (!drag || !row || drag.range <= 0) return;
    e.preventDefault();
    const scroll = drag.startScroll + ((e.clientX - drag.startX) / drag.range) * drag.max;
    row.scrollLeft = Math.min(Math.max(scroll, 0), drag.max);
  };

  const onBarPointerUp = () => { barDrag.current = null; };

  const charmData = buildCatalog(charmFiles);
  const categories = ["All", ...CATALOGUE_CATEGORIES];
  const categoryCounts: Record<string, number> = { All: charmData.length };
  for (const charm of charmData) {
    categoryCounts[charm.category!] = (categoryCounts[charm.category!] || 0) + 1;
  }

  const filteredCharms = activeCategory === 'All' ? charmData : charmData.filter(c => c.category === activeCategory);

  const handleTap = (charm: Charm) => {
    if (!isCharmSoldOut(charm.filename)) onAddCharm(charm);
  };

  return (
    <>
      {/* CATEGORIES — pills with a little picture each, that swipe/drag
          sideways (same pattern as the .collection-jumpnav quick-links on the
          collection page). On phones they sit in two rows — the first half of
          the categories on top, the rest below — so more show at once; on
          wider screens one row, centered when everything fits. Once it
          overflows, a fade on the trailing edge plus a grabbable bar below
          show there's more. */}
      <div className="bg-white rounded-lg shadow-md m-3 mb-0 p-3 flex-shrink-0">
        <div
          ref={categoryRowRef}
          className="overflow-x-auto no-scrollbar"
          style={{
            touchAction: 'pan-x',
            maskImage: categoriesScrollable ? 'linear-gradient(to right, black calc(100% - 32px), transparent 100%)' : undefined,
            WebkitMaskImage: categoriesScrollable ? 'linear-gradient(to right, black calc(100% - 32px), transparent 100%)' : undefined,
          }}
        >
          {/* Phones: two rows stacked (each its own widths); wider screens: side by side as one row */}
          <div className={`flex flex-col md:flex-row gap-2 w-max ${categoriesScrollable ? '' : 'mx-auto'}`}>
          {[categories.slice(0, Math.ceil(categories.length / 2)), categories.slice(Math.ceil(categories.length / 2))].map((rowCategories, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
          {rowCategories.map((cat) => {
            const picture = cat === 'All' ? null : categoryPicture(cat);
            return (
            <button
              key={cat}
              data-category={cat}
              onClick={() => setActiveCategory(cat)}
              className={`lift min-h-[38px] sm:min-h-11 pl-1.5 pr-3 sm:pr-4 py-1 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-1.5 ${
                activeCategory === cat
                  ? "bg-navy text-white shadow-md"
                  : "bg-sky-tint-light text-navy hover:bg-sky-tint"
              }`}
            >
              <span className={`w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden ${picture ? 'p-0.5' : 'p-1.5'} ${activeCategory === cat ? 'bg-white/15 text-white' : 'bg-white text-accent-blue'}`}>
                {picture
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={picture} alt="" draggable={false} className="w-full h-full object-contain scale-110" />
                  : <AllIcon />}
              </span>
              <span className="whitespace-nowrap">{cat}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] ${activeCategory === cat ? "bg-white/20 text-white" : "bg-white text-accent-blue"}`}>
                {categoryCounts[cat] ?? 0}
              </span>
            </button>
            );
          })}
          </div>
          ))}
          </div>
        </div>
        {categoriesScrollable && (
          // A taller (invisible) row around the thin bar, so it's easy to grab on a phone
          <div
            ref={categoryTrackRef}
            onPointerDown={onBarPointerDown}
            onPointerMove={onBarPointerMove}
            onPointerUp={onBarPointerUp}
            onPointerCancel={onBarPointerUp}
            className="relative w-full h-4 mt-1 flex items-center cursor-pointer"
            style={{ touchAction: 'none' }}
          >
            <div className="w-full h-1 rounded-full bg-sky-tint-light overflow-hidden pointer-events-none">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${categoryScrollMetrics.thumbPct}%`,
                  marginLeft: `${categoryScrollMetrics.leftPct}%`,
                  background: 'linear-gradient(90deg, rgba(167,199,231,0), #a7c7e7 85%)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* CHARM GRID */}
      <div
        ref={containerRef}
        className="flex-1 bg-white overflow-y-auto rounded-lg shadow-md m-3 mt-2 p-6 flex flex-col touch-pan-y"
        style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      >
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 justify-items-center">
          {filteredCharms.map((charm) => (
            <div key={charm.id} className="relative group pointer-events-auto">
              <DraggableCharm charm={charm} onTap={handleTap} onPress={c => preloadStripPicture(c.filename)} soldOut={isCharmSoldOut(charm.filename)} />
            </div>
          ))}
        </div>
        <div className="h-8" />
      </div>
    </>
  );
}
