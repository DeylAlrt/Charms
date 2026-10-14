"use client";

import { useEffect, useRef, useState } from 'react';
import DraggableCharm from '../DraggableCharm';
import { charmImageUrl, isCharmSoldOut, type Charm } from '../charmEditorUtils';
import { CATALOGUE_CATEGORIES, CATALOGUE_ENTRIES } from '../charmCatalogue';

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

/** Category filter bar plus the scrollable charm grid. */
export default function CharmCatalog({ charmFiles, onAddCharm }: CharmCatalogProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const categoryRowRef = useRef<HTMLDivElement | null>(null);
  const [categoriesScrollable, setCategoriesScrollable] = useState(false);
  const [categoryScrollMetrics, setCategoryScrollMetrics] = useState({ thumbPct: 100, leftPct: 0 });

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
      {/* CATEGORIES — a single scrollable row of pills, same pattern as the
          .collection-jumpnav quick-links on the collection page: swipe/drag
          through them instead of wrapping to multiple rows. Centered when
          everything fits (typically desktop); once it overflows, a fade on
          the trailing edge plus a thin progress bar below signal there's
          more to scroll to. */}
      <div className="bg-white rounded-lg shadow-md m-3 mb-0 p-3 flex-shrink-0">
        <div
          ref={categoryRowRef}
          className={`flex overflow-x-auto no-scrollbar gap-2 ${categoriesScrollable ? '' : 'justify-center'}`}
          style={{
            touchAction: 'pan-x',
            maskImage: categoriesScrollable ? 'linear-gradient(to right, black calc(100% - 32px), transparent 100%)' : undefined,
            WebkitMaskImage: categoriesScrollable ? 'linear-gradient(to right, black calc(100% - 32px), transparent 100%)' : undefined,
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`lift flex-shrink-0 min-h-[38px] sm:min-h-11 px-4 py-1.5 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-1.5 ${
                activeCategory === cat
                  ? "bg-navy text-white shadow-md"
                  : "bg-sky-tint-light text-navy hover:bg-sky-tint"
              }`}
            >
              <span>{cat}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] ${activeCategory === cat ? "bg-white/20 text-white" : "bg-white text-accent-blue"}`}>
                {categoryCounts[cat] ?? 0}
              </span>
            </button>
          ))}
        </div>
        {categoriesScrollable && (
          <div className="w-full h-1 rounded-full bg-sky-tint-light overflow-hidden mt-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${categoryScrollMetrics.thumbPct}%`,
                marginLeft: `${categoryScrollMetrics.leftPct}%`,
                background: 'linear-gradient(90deg, rgba(167,199,231,0), #a7c7e7 85%)',
              }}
            />
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
              <DraggableCharm charm={charm} onTap={handleTap} soldOut={isCharmSoldOut(charm.filename)} />
            </div>
          ))}
        </div>
        <div className="h-8" />
      </div>
    </>
  );
}
