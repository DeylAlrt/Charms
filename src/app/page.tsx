import path from "path";
import fs from "fs";
import CharmEditorClient from "../components/CharmEditorClient";
import { fetchProducts } from "../lib/products";

export const revalidate = 0;

const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif)$/i;

/** Image paths relative to public/charms, including those one folder deep (e.g. "Flag Links/Flags (1).png"). */
function listCharmFiles(charmsDir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(charmsDir, { withFileTypes: true })) {
    if (entry.isFile() && IMAGE_EXT.test(entry.name)) {
      files.push(entry.name);
    } else if (entry.isDirectory()) {
      for (const sub of fs.readdirSync(path.join(charmsDir, entry.name), { withFileTypes: true })) {
        if (sub.isFile() && IMAGE_EXT.test(sub.name)) files.push(`${entry.name}/${sub.name}`);
      }
    }
  }
  return files;
}

export default async function Page() {
  const charmsDir = path.join(process.cwd(), "public", "charms");
  let charmFiles: string[] = [];

  try {
    charmFiles = listCharmFiles(charmsDir);
  } catch {
    charmFiles = [];
  }

  // Prices, sold out and hidden charms from Supabase (null = use the built-in lists).
  // Only what the builder sells is sent to the browser.
  const products = (await fetchProducts())?.filter(p => p.builder_category).map(p => ({ ...p, id: undefined })) ?? null;

  return <CharmEditorClient charmFiles={charmFiles} products={products} />;
}
