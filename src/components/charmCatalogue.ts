/**
 * The builder's charm list. It comes from the Supabase `products` table (or
 * the daily backup copy, src/data/products-backup.json) — see liveProducts.ts.
 * Prices, sold out and hiding are changed in the Supabase dashboard.
 */

export type CatalogueEntry = {
  /** Photo path inside public/charms (e.g. "Concave Links/Concave_Silver_Links (1).png"), or a full link. */
  file: string;
  /** Name shown on the tile, in the cart, and on orders (e.g. "Gold Star"). */
  displayName: string;
  category: string;
  price: number;
  soldOut: boolean;
};

let entries: CatalogueEntry[] = [];
let entryByFile = new Map<string, CatalogueEntry>();
let categories: string[] = [];

/** Every charm, in display order. */
export const getCatalogueEntries = (): CatalogueEntry[] => entries;

export const getCatalogueEntry = (file: string): CatalogueEntry | undefined => entryByFile.get(file);

/** Category pills, in display order. */
export const getCatalogueCategories = (): string[] => categories;

/** Switches to a new list (the products from Supabase or the backup copy). */
export function setCatalogueEntries(list: CatalogueEntry[]) {
  entries = list;
  entryByFile = new Map(list.map(entry => [entry.file, entry]));
  categories = [...new Set(list.map(entry => entry.category))];
}
