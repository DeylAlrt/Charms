// Saves a copy of the products from Supabase into src/data/products-backup.json.
// The builder uses that copy if Supabase can't be reached, so both sites keep
// working (with prices and sold out at most a day old).
//
// Runs every day on GitHub (.github/workflows/backup-products.yml), and any
// time with:  npm run backup-products
// Only rewrites the file when something changed.

import fs from 'fs';

const SUPABASE_URL = 'https://bdmblwuvbcfosadnmskv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pJ9zqlsj92-PfgkMmntg3w_6Zz3h588';
const COLUMNS = 'id,name,category,section,builder_category,kind,metal,price_aed,image_path,image_url,sold_out,stock,sort_order';
const FILE = new URL('../src/data/products-backup.json', import.meta.url);

const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=${COLUMNS}&order=category,section,sort_order,image_path`, {
  headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
});
if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);
const products = (await res.json()).map(p => ({ ...p, price_aed: Number(p.price_aed) }));
if (!Array.isArray(products) || products.length === 0) throw new Error('No products came back — keeping the old copy.');

let old = null;
try { old = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}

if (old && JSON.stringify(old.products) === JSON.stringify(products)) {
  console.log(`No changes (${products.length} products).`);
} else {
  fs.mkdirSync(new URL('.', FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ savedAt: new Date().toISOString(), products }, null, 1) + '\n');
  console.log(`Saved ${products.length} products.`);
}
