import { setCatalogueEntries, type CatalogueEntry } from './charmCatalogue';
import { setWatches, type Watch } from './charmEditor/watches';

/**
 * Products from the Supabase `products` table (only the active ones — hidden
 * products never leave Supabase), or the daily backup copy of them
 * (src/data/products-backup.json) if Supabase can't be reached. Prices, sold
 * out and hiding are changed in the Supabase dashboard, not in the code.
 */
export type ProductRow = {
  /** Only on the server (not sent to the browser). */
  id?: string;
  name: string;
  category: string;
  section: string;
  builder_category: string | null;
  kind: string;
  metal: 'silver' | 'gold' | null;
  price_aed: number | string;
  image_path: string | null;
  image_url: string | null;
  sold_out: boolean;
  stock: number | null;
  sort_order: number;
};

/** The photo a product is known by: its file in public/charms, or its full link. */
export const productFile = (row: ProductRow) => (row.image_path ?? row.image_url)!;

export const isRowSoldOut = (row: ProductRow) => row.sold_out || row.stock === 0;

// ---------------------------------------------------------------------------
// How the builder orders its charms. Edit these to change the order.
// ---------------------------------------------------------------------------

/** The builder's categories, left to right. A new category (not listed) goes at the end. */
export const BUILDER_CATEGORY_ORDER = [
  'Plain Charms', 'Concave Links', 'Letter Links', 'Number Links', 'Gold Outline Links', 'Colored Links',
  'Flags', 'Characters', 'Animals', 'Cars', 'Sports', 'Premium Charms', 'Magnet Hearts', 'Dangling Links',
  'Twin Chain Links',
];

/** Categories whose charms are listed A–Z. The others follow each product's sort_order. */
export const ALPHABETICAL_CATEGORIES = new Set([
  'Plain Charms', 'Concave Links', 'Gold Outline Links', 'Colored Links', 'Flags', 'Animals', 'Cars', 'Sports', 'Dangling Links',
]);

/**
 * A section's "gold set": e.g. "Gold Premium Charms" inside the Premium Charms
 * category (listed after the silver ones, named "Gold …"). An all-gold category
 * like Gold Outline Links isn't one.
 */
const isGoldSet = (r: ProductRow) => r.section.startsWith('Gold ') && r.section !== r.builder_category;

const categoryRank = (category: string) => {
  const i = BUILDER_CATEGORY_ORDER.indexOf(category);
  return i < 0 ? BUILDER_CATEGORY_ORDER.length : i;
};

/**
 * Builder display order: by category (above), then silver sections before gold
 * sets, cheaper sections first, then A–Z or sort_order within a section.
 */
function builderOrder(rows: ProductRow[], availableFirst = false): ProductRow[] {
  const sectionPrice = new Map<string, number>();
  for (const r of rows) sectionPrice.set(r.section, Math.min(sectionPrice.get(r.section) ?? Infinity, Number(r.price_aed)));
  const alphabetical = (r: ProductRow) => ALPHABETICAL_CATEGORIES.has(r.builder_category!);
  return [...rows].sort((a, b) =>
    categoryRank(a.builder_category!) - categoryRank(b.builder_category!)
    || a.builder_category!.localeCompare(b.builder_category!)
    || Number(isGoldSet(a)) - Number(isGoldSet(b))
    || sectionPrice.get(a.section)! - sectionPrice.get(b.section)!
    || a.section.localeCompare(b.section)
    || (availableFirst ? Number(isRowSoldOut(a)) - Number(isRowSoldOut(b)) : 0)
    || (alphabetical(a) ? a.name.localeCompare(b.name) : 0)
    || a.sort_order - b.sort_order);
}

let applied: ProductRow[] | null = null;

/** Switches the builder's charm and watch lists to these products (cheap to call again with the same list). */
export function applyBuilderProducts(rows: ProductRow[]) {
  if (rows === applied) return;
  applied = rows;

  const entries: CatalogueEntry[] = builderOrder(rows.filter(r => r.builder_category && r.kind !== 'watch'))
    .map(r => ({
      file: productFile(r),
      displayName: isGoldSet(r) && !/gold/i.test(r.name) ? `Gold ${r.name}` : r.name,
      category: r.builder_category!,
      price: Number(r.price_aed),
      soldOut: isRowSoldOut(r),
    }));
  setCatalogueEntries(entries);

  // Watches: the ones you can buy first
  const watches: Watch[] = builderOrder(rows.filter(r => r.builder_category && r.kind === 'watch'), true)
    .map(r => ({
      name: r.name,
      file: productFile(r),
      price: Number(r.price_aed),
      soldOut: isRowSoldOut(r),
      links: r.metal === 'gold' ? 'Gold' : 'Silver',
    }));
  setWatches(watches);
}
