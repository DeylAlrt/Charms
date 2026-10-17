import { getCatalogueEntry } from "./charmCatalogue";

/**
 * Base bracelet colours customers can choose (empty spots are plain links in
 * this colour). To offer or stop offering a colour, edit this list — each one
 * needs a "Plain Links/<Colour>_Plain_Charm.png" in the catalogue.
 */
export const baseColorOptions = ["Silver", "Gold", "Blue", "Black", "Red", "Purple", "Pink"] as const;
export type BaseColor = typeof baseColorOptions[number];

export type Charm = {
  id: string;
  img: string;
  /** Image path relative to public/charms, e.g. "Concave Links/Concave_Gold_Links (1).png". */
  filename: string;
  category?: string;
  displayName?: string;
  catalogItem?: boolean;
  isPlaceholder?: boolean;
  /** Twin chain halves: both halves share a pairId; half 0 is the photo's left link, half 1 its right. */
  pairId?: string;
  half?: 0 | 1;
};

/** Price in AED, taken from the main site's catalogue (see charmCatalogue.ts). */
export const getPrice = (filename: string): number => getCatalogueEntry(filename)?.price ?? 0;

/** Public URL for a charm image; paths contain folders and spaces, so each segment is encoded. */
export const charmImageUrl = (filename: string): string =>
  `/charms/${filename.split("/").map(encodeURIComponent).join("/")}`;

/** Sold out = marked in the main site's catalogue (soldOut: [...] in catalogue-data.js). */
export const isCharmSoldOut = (filename: string): boolean =>
  !!getCatalogueEntry(filename)?.soldOut || filename.toLowerCase().includes("sold");

/** The plain link that fills empty bracelet slots in the given base color. */
export const plainCharmFile = (color: BaseColor) => `Plain Links/${color}_Plain_Charm.png`;

// Empty slots are plain links, so `filename` makes them priced like the plain links on the main site.
export const getPlaceholderCharm = (color: BaseColor) => ({
  id: `placeholder-${color.toLowerCase()}`,
  img: charmImageUrl(plainCharmFile(color)),
  filename: plainCharmFile(color),
  isPlaceholder: true,
});
