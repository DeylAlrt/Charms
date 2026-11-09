import { BUILT_IN_ENTRIES, setCatalogueEntries, type CatalogueEntry } from './charmCatalogue';
import { BUILT_IN_WATCHES, setWatches, type Watch } from './charmEditor/watches';

/**
 * Products from the Supabase `products` table (only the active ones — hidden
 * products never leave Supabase). The builder uses these instead of its
 * built-in lists, so prices, sold out and hiding are changed in the Supabase
 * dashboard without touching the code.
 */
export type ProductRow = {
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

/**
 * Display order: everything the builder already had stays where it was (so the
 * builder looks the same), and a product added in Supabase goes after the
 * others in its category.
 */
function orderLike<T>(items: T[], builtInOrder: Map<string, number>, key: (t: T) => string, group: (t: T) => string, sortOrder: (t: T) => number): T[] {
  const lastInGroup = new Map<string, number>();
  for (const item of items) {
    const at = builtInOrder.get(key(item));
    if (at !== undefined) lastInGroup.set(group(item), Math.max(lastInGroup.get(group(item)) ?? -1, at));
  }
  const position = (item: T) =>
    builtInOrder.get(key(item)) ?? (lastInGroup.get(group(item)) ?? builtInOrder.size) + 0.5 + sortOrder(item) / 1e6;
  return [...items].sort((a, b) => position(a) - position(b));
}

const builtInEntryOrder = new Map(BUILT_IN_ENTRIES.map((entry, i) => [entry.file, i]));
const builtInWatchOrder = new Map(BUILT_IN_WATCHES.map((watch, i) => [watch.file, i]));

let applied: ProductRow[] | null = null;

/** Switches the builder's charm and watch lists to these products (cheap to call again with the same list). */
export function applyBuilderProducts(rows: ProductRow[]) {
  if (rows === applied) return;
  applied = rows;

  const charms = rows.filter(r => r.builder_category && r.kind !== 'watch');
  const entries: CatalogueEntry[] = orderLike(charms, builtInEntryOrder, productFile, r => r.builder_category!, r => r.sort_order)
    .map(r => {
      // "Gold Star" in a section's gold set (e.g. "Gold Premium Charms" under Premium Charms),
      // but not in an all-gold category like Gold Outline Links
      const goldSet = r.section.startsWith('Gold ') && r.section !== r.builder_category;
      return {
        file: productFile(r),
        displayName: goldSet && !/gold/i.test(r.name) ? `Gold ${r.name}` : r.name,
        category: r.builder_category!,
        price: Number(r.price_aed),
        soldOut: isRowSoldOut(r),
      };
    });
  setCatalogueEntries(entries);

  const watches: Watch[] = orderLike(rows.filter(r => r.builder_category && r.kind === 'watch'), builtInWatchOrder, productFile, () => '', r => r.sort_order)
    .map(r => ({
      name: r.name,
      file: productFile(r),
      price: Number(r.price_aed),
      soldOut: isRowSoldOut(r),
      links: r.metal === 'gold' ? 'Gold' : 'Silver',
    }));
  setWatches(watches);
}
