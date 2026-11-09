import { applyBuilderProducts, isRowSoldOut, productFile, type ProductRow } from '@/components/liveProducts';
import { setSiteItems } from './siteCatalogue';
import backup from '@/data/products-backup.json';

/**
 * Reads the products from Supabase (server only).
 *
 * Kept for up to a minute, so a change saved in the Supabase dashboard shows
 * on the sites within about a minute without slowing every page down. If
 * Supabase can't be reached, the daily backup copy (src/data/products-backup.json,
 * made by scripts/backup-products.mjs) is used instead, so the sites never break.
 */

// Public on purpose: the publishable key only allows reading active products.
export const SUPABASE_URL = 'https://bdmblwuvbcfosadnmskv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pJ9zqlsj92-PfgkMmntg3w_6Zz3h588';

const REFRESH_SECONDS = 60;

const COLUMNS = 'id,name,category,section,builder_category,kind,metal,price_aed,image_path,image_url,sold_out,stock,sort_order';

/** The active products, or null if Supabase couldn't be reached. */
export async function fetchProducts(): Promise<ProductRow[] | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${COLUMNS}&order=sort_order`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: REFRESH_SECONDS, tags: ['products'] },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('No products came back');
    return rows as ProductRow[];
  } catch (err) {
    console.error('Could not load products from Supabase — using the backup copy:', err);
    return null;
  }
}

// Product ids, for taking stock: by builder photo, and by main site cart key ("<section>::<file>")
let idByBuilderFile = new Map<string, string>();
let idBySiteKey = new Map<string, string>();

export const productIdForBuilderFile = (file: string) => idByBuilderFile.get(file);
export const productIdForSiteKey = (key: string) => idBySiteKey.get(key);

/** The products: from Supabase, or the backup copy if Supabase can't be reached. */
export async function getProducts(): Promise<ProductRow[]> {
  return (await fetchProducts()) ?? (backup.products as ProductRow[]);
}

/** Loads the products and switches the order checks (builder and main site) to them. Call before pricing an order. */
export async function loadLiveProducts(): Promise<void> {
  const rows = await getProducts();
  applyBuilderProducts(rows);
  idByBuilderFile = new Map(rows.filter(r => r.id && r.builder_category).map(r => [productFile(r), r.id!]));
  idBySiteKey = new Map(rows.filter(r => r.id).map(r => [`${r.section}::${productFile(r)}`, r.id!]));
  setSiteItems(rows.map(r => ({
    label: r.name,
    section: r.section,
    file: productFile(r),
    price: Number(r.price_aed),
    soldOut: isRowSoldOut(r),
  })));
}
