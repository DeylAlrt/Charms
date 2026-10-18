import type { Charm } from '../charmEditorUtils';
import data from './stripImages.json';

export const WATCHES: { name: string; file: string; price: number; soldOut?: boolean; links: 'Silver' | 'Gold' }[] = [
  { name: 'Heart Watch', file: 'Watches/Heart Watch.png', price: 55.50, links: 'Silver' },
  { name: 'Rose Gold Digital Watch', file: 'Watches/Rose Gold Digital Watch.png', price: 55.50, links: 'Silver' },
  { name: 'White Square Watch', file: 'Watches/White Square Watch.png', price: 55.50, soldOut: true, links: 'Silver' },
  { name: 'Oval Gold Watch', file: 'Watches/Oval Gold Watch.png', price: 65.50, links: 'Gold' },
];

export const WATCH_LINKS = 6;

export const WATCH_FACE_LINKS = 2.9;

export const getWatch = (file: string) => WATCHES.find(w => w.file === file);

type WatchPicture = { w: number; h: number; linkHeight: number; linkMiddle: number; faceLeft: number; faceRight: number };
const pictures = data.watches as Record<string, WatchPicture>;

/** The sideways watch picture made by `npm run strip-images`, or null. */
export function watchPicture(file: string): (WatchPicture & { src: string }) | null {
  const pic = pictures[file];
  if (!pic) return null;
  return { ...pic, src: `/charms-strip/${file.replace(/\.png$/i, '.webp').split('/').map(encodeURIComponent).join('/')}` };
}

/** The spots the watch takes: always the middle WATCH_LINKS of the bracelet. */
export function watchSpots(slots: number): { start: number; end: number } {
  const start = Math.floor((slots - WATCH_LINKS) / 2);
  return { start, end: start + WATCH_LINKS - 1 };
}

export const isWatchPart = (item: Charm | undefined) => item?.watchPart !== undefined;

/** The watch on the bracelet (its first part), if any. */
export const watchOn = (bracelet: Charm[]) => bracelet.find(item => item?.watchPart === 0);

/** The WATCH_LINKS pieces a watch is stored as on the bracelet (one per spot it covers). */
export function watchParts(file: string, img: string): Charm[] {
  const watch = getWatch(file);
  return Array.from({ length: WATCH_LINKS }, (_, part) => ({
    id: `watch-${part}`,
    img,
    filename: file,
    displayName: watch?.name ?? 'Watch',
    category: 'Watch',
    watchPart: part,
  }));
}

/** Spots charms can go in (everything except the watch). */
export const freeSpots = (bracelet: Charm[]) =>
  bracelet.map((item, i) => (isWatchPart(item) ? -1 : i)).filter(i => i >= 0);

/**
 * Lays out a bracelet of `slots` spots with the watch in the middle and the
 * given charms on each side. Each side grows or shrinks at its OUTER end (the
 * clasp), so the charms next to the watch stay next to it.
 */
export function layOutAroundWatch(left: Charm[], right: Charm[], slots: number, parts: Charm[], empty: () => Charm): Charm[] {
  const { start, end } = watchSpots(slots);
  const leftLen = start;
  const rightLen = slots - end - 1;
  const fit = (side: Charm[], len: number, outerIsStart: boolean) => {
    if (side.length >= len) return outerIsStart ? side.slice(side.length - len) : side.slice(0, len);
    const pad = Array.from({ length: len - side.length }, empty);
    return outerIsStart ? [...pad, ...side] : [...side, ...pad];
  };
  return [...fit(left, leftLen, true), ...parts, ...fit(right, rightLen, false)];
}

/** The charms on each side of the watch on a bracelet that has one. */
export function sidesOfWatch(bracelet: Charm[]): { left: Charm[]; right: Charm[] } {
  const first = bracelet.findIndex(isWatchPart);
  let last = first;
  while (last + 1 < bracelet.length && isWatchPart(bracelet[last + 1])) last++;
  return { left: bracelet.slice(0, first), right: bracelet.slice(last + 1) };
}

/** The plain link drawn in each of a watch's spaces, under its face (the watch's own links). */
export const attachedLinkFile = (watchFile: string) => `Plain Links/${getWatch(watchFile)?.links ?? 'Silver'}_Plain_Charm.png`;

