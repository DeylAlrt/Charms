/**
 * Everything sold on the main site (navilleracharms.com), keyed the same way as
 * its cart: "<section>::<image file>". Used to price main site orders on the
 * server. Comes from the Supabase products (or the backup copy) — see src/lib/products.ts.
 */

export type SiteItem = { label: string; section: string; file: string; price: number; soldOut?: boolean };

let items = new Map<string, SiteItem>();

/** An item by its cart key, "<section>::<image file>". */
export const getSiteItem = (key: string): SiteItem | undefined => items.get(key);

/** Switches to a new list (the products from Supabase). */
export function setSiteItems(list: SiteItem[]) {
  items = new Map(list.map(item => [`${item.section}::${item.file}`, item]));
}
