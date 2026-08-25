"use client";

import { useEffect, useRef, useState } from 'react';
import DraggableCharm from '../DraggableCharm';
import { LETTER_ORDER, getCategory, isCharmSoldOut, type Charm } from '../charmEditorUtils';
import { getStockColor } from './useCharmStock';

const CATEGORIES = ["All", "Classic Charms", "Premium Charms", "Deluxe Charms", "Flags", "A-Z", "0-9"];

const stripExtension = (filename: string) => filename.replace(/\.(png|jpg|jpeg)$/i, '');

/** Builds catalog entries from the raw filenames and sorts A-Z views gold-first-then-alphabetical. */
function buildCatalog(charmFiles: string[]): Charm[] {
  return charmFiles.map((file, i) => ({
    id: `catalog-${i}`,
    img: `/charms/${file}`,
    filename: file,
    category: getCategory(file),
    displayName: file.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').replace(/\s*\(\d+\)\s*$/, '').trim(),
    catalogItem: true,
  }));
}

function sortAlphabetically(charms: Charm[]): Charm[] {
  return [...charms].sort((a, b) => {
    const A = a.filename.toLowerCase();
    const B = b.filename.toLowerCase();
    const isGoldA = A.includes("gold");
    const isGoldB = B.includes("gold");
    if (isGoldA && !isGoldB) return -1;
    if (!isGoldA && isGoldB) return 1;
    const getLetter = (name: string) => {
      const num = name.match(/\((\d+)\)/)?.[1];
      if (num) return LETTER_ORDER[parseInt(num) - 1] || "Z";
      const letter = name.match(/[a-z]/i)?.[0];
      return letter ? letter.toUpperCase() : "Z";
    };
    return getLetter(A).localeCompare(getLetter(B));
  });
}

type CharmCatalogProps = {
  charmFiles: string[];
  ownerMode: boolean;
  outOfStockMap: Record<string, boolean>;
  onToggleOutOfStock: (filename: string) => void;
  charmStock: Record<string, number>;
  stockLoading: Record<string, boolean>;
  onUpdateStock: (charmName: string, quantity: number) => void;
  onAddCharm: (charm: Charm) => void;
  onDeleteCharm: (filename: string) => void;
  onOpenRenameModal: (filename: string) => void;
  /** Rendered between the category filter and the charm grid (e.g. the owner-only color manager). */
  panelBetween?: React.ReactNode;
};

/** Category filter bar plus the scrollable charm grid, with owner-only inventory controls per charm. */
export default function CharmCatalog({
  charmFiles, ownerMode, outOfStockMap, onToggleOutOfStock,
  charmStock, stockLoading, onUpdateStock, onAddCharm, onDeleteCharm, onOpenRenameModal, panelBetween,
}: CharmCatalogProps) {
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
  const categoryCounts: Record<string, number> = { All: charmData.length };
  for (const charm of charmData) {
    categoryCounts[charm.category!] = (categoryCounts[charm.category!] || 0) + 1;
  }

  const rawFiltered = activeCategory === 'All' ? charmData : charmData.filter(c => c.category === activeCategory);
  const filteredCharms = activeCategory === 'A-Z' || activeCategory === 'All' ? sortAlphabetically(rawFiltered) : rawFiltered;

  const handleTap = (charm: Charm) => {
    if (!isCharmSoldOut(charm.filename, outOfStockMap)) onAddCharm(charm);
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
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 min-h-[38px] sm:min-h-11 px-4 py-1.5 rounded-full font-semibold text-xs sm:text-sm transition flex items-center gap-1.5 ${
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

      {panelBetween}

      {/* CHARM GRID */}
      <div
        ref={containerRef}
        className="flex-1 bg-white overflow-y-auto rounded-lg shadow-md m-3 mt-2 p-6 flex flex-col touch-pan-y"
        style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      >
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 justify-items-center">
          {filteredCharms.map((charm) => {
            const stockKey = stripExtension(charm.filename);
            const soldOut = isCharmSoldOut(charm.filename, outOfStockMap);
            return (
              <div key={charm.id} className="relative group pointer-events-auto">
                <DraggableCharm charm={charm} onTap={handleTap} soldOut={soldOut} />
                <div className="absolute right-1 bottom-1 flex flex-col gap-1 items-end invisible group-hover:visible">
                  <div className="flex gap-1">
                    {ownerMode && <button onClick={() => onDeleteCharm(charm.filename)} className="text-[10px] bg-white/90 px-1 rounded" title="Delete file">Delete</button>}
                    {ownerMode && <button onClick={() => onOpenRenameModal(charm.filename)} className="text-[10px] bg-white/90 px-1 rounded" title="Rename file">Rename</button>}
                  </div>
                  {ownerMode && (
                    <label className="flex items-center gap-1 bg-white/90 px-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!outOfStockMap[charm.filename]}
                        onChange={() => onToggleOutOfStock(charm.filename)}
                      />
                      <span className="text-[9px] text-muted">Out of stock</span>
                    </label>
                  )}
                  {ownerMode && (
                    <div className="flex items-center gap-1 bg-white/90 px-1 rounded">
                      <span className="text-[9px] text-muted">Stock:</span>
                      <input
                        type="number"
                        min="0"
                        value={charmStock[stockKey] || 0}
                        onChange={(e) => onUpdateStock(stockKey, parseInt(e.target.value) || 0)}
                        disabled={stockLoading[stockKey]}
                        className={`
                          w-14 px-1 py-0.5 text-[11px] text-center border rounded
                          focus:outline-none focus:ring-1 focus:ring-accent-blue
                          ${getStockColor(charmStock[stockKey] || 0)}
                          ${stockLoading[stockKey] ? 'opacity-50' : ''}
                        `}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-8" />
      </div>
    </>
  );
}
