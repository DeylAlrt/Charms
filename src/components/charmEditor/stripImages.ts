import data from './stripImages.json';

/**
 * Bracelet-strip pictures made by `npm run strip-images` (scripts/build-strip-images.mjs):
 * every link is the same width in them, with whatever hangs from it below.
 */

type Point = { x: number; y: number };
type Entry = { w: number; h: number; x: number; y: number; lh: number; hl?: number; hr?: number; full?: boolean };
type TwinEntry = { halves: (Entry & { anchor: Point })[] };

export type StripPicture = {
  src: string;
  /** Picture size, in its own pixels. */
  w: number;
  h: number;
  /** Top-left corner of the link in the picture; the link is LINK_W wide. */
  x: number;
  y: number;
  /** Link height; anything below y + lh hangs from the link. */
  lh: number;
  /** Left/right edges of the hanging part, if any. */
  hl?: number;
  hr?: number;
  /** Draw the hanging part full size (its chain hangs from both ends of the link). */
  full?: boolean;
  /** Twin chain halves: where the chain leaves the picture. */
  anchor?: Point;
};

export const LINK_W: number = data.linkWidth;

const images = data.images as Record<string, Entry | TwinEntry>;

const stripUrl = (filename: string, suffix: string) =>
  `/charms-strip/${filename.replace(/\.png$/i, suffix + '.webp').split('/').map(encodeURIComponent).join('/')}`;

/** The strip picture for a charm (or one half of a twin chain), or null if it has none. */
export function getStripPicture(filename: string, half?: 0 | 1): StripPicture | null {
  const entry = images[filename];
  if (!entry) return null;
  if ('halves' in entry) {
    const h = half ?? 0;
    return { ...entry.halves[h], src: stripUrl(filename, h === 0 ? '__a' : '__b') };
  }
  return { ...entry, src: stripUrl(filename, '') };
}

const thumbs = new Set(data.thumbs);

/**
 * A small copy of a charm's photo for the charm list and cart (the originals
 * are up to 4 MB each). Falls back to the full photo for a charm added since
 * the last `npm run strip-images`.
 */
export function thumbUrl(filename: string, fallback: string): string {
  if (!thumbs.has(filename)) return fallback;
  return `/charms-thumb/${filename.replace(/\.png$/i, '.webp').split('/').map(encodeURIComponent).join('/')}`;
}
