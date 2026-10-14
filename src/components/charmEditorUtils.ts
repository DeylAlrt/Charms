import { getCatalogueEntry } from "./charmCatalogue";

export const baseColorOptions = ["Silver", "Gold", "Blue", "Black", "Brown", "Red", "Purple", "Pink"] as const;
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
};

/** Category for charm images on disk that aren't in the main site's catalogue (shown to the owner only). */
export const UNCATALOGUED = "Uncatalogued";

/** Price in AED, taken from the main site's catalogue (see charmCatalogue.ts). */
export const getPrice = (filename: string): number => getCatalogueEntry(filename)?.price ?? 0;

/** Public URL for a charm image; paths contain folders and spaces, so each segment is encoded. */
export const charmImageUrl = (filename: string): string =>
  `/charms/${filename.split("/").map(encodeURIComponent).join("/")}`;

export const isCharmSoldOut = (filename: string, outOfStock: Record<string, boolean>): boolean =>
  !!outOfStock[filename] || !!getCatalogueEntry(filename)?.soldOut || filename.toLowerCase().includes("sold");

/** The plain link that fills empty bracelet slots in the given base color. */
export const plainCharmFile = (color: BaseColor) => `Plain Links/${color}_Plain_Charm.png`;

// Empty slots are plain links, so `filename` makes them priced like the plain links on the main site.
export const getPlaceholderCharm = (color: BaseColor) => ({
  id: `placeholder-${color.toLowerCase()}`,
  img: charmImageUrl(plainCharmFile(color)),
  filename: plainCharmFile(color),
  isPlaceholder: true,
});
