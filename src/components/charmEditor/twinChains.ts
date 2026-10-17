import type { Charm } from '../charmEditorUtils';

/**
 * Twin chain charms: two links joined by a short chain, sold as a pair.
 * On the bracelet they're two halves in two spots, with at most
 * MAX_LINKS_BETWEEN other links between them. The bracelet is a loop, so
 * the halves can also sit on either side of the clasp (first and last spots).
 * Either half can be on the left.
 */

export const MAX_LINKS_BETWEEN = 2;
const MAX_DISTANCE = MAX_LINKS_BETWEEN + 1;

export const isTwinChain = (filename: string) => filename.startsWith('Chain Links/');

const newPairId = () => `pair-${Date.now()}-${Math.random()}`;

/** Spots apart going the short way round the loop (1 = right next to each other). */
export const loopDistance = (i: number, j: number, slots: number) => {
  const d = Math.abs(i - j);
  return Math.min(d, slots - d);
};

/** Whether the chain between spots i and j runs straight along the strip (vs. round the clasp): whichever way is shorter. */
export const runsDirectly = (i: number, j: number, slots: number) => Math.abs(i - j) <= slots - Math.abs(i - j);

/** Spot of the other half of the twin chain in spot `index`, or -1. */
export function partnerOf(bracelet: Charm[], index: number): number {
  const item = bracelet[index];
  if (!item?.pairId) return -1;
  return bracelet.findIndex((other, i) => i !== index && other?.pairId === item.pairId);
}

/** Every pair whose halves are both on the bracelet: [half 0 spot, half 1 spot]. */
export function pairsOn(bracelet: Charm[]): { pairId: string; a: number; b: number }[] {
  const spots = new Map<string, number[]>();
  bracelet.forEach((item, i) => {
    if (item?.pairId) spots.set(item.pairId, [...(spots.get(item.pairId) ?? []), i]);
  });
  return [...spots.entries()]
    .filter(([, list]) => list.length === 2)
    .map(([pairId, list]) => {
      const [first, second] = list;
      return bracelet[first].half === 0 ? { pairId, a: first, b: second } : { pairId, a: second, b: first };
    });
}

/** True when every twin chain has both halves within reach of each other. */
export function pairsAreValid(bracelet: Charm[]): boolean {
  const halves = bracelet.filter(item => item?.pairId).length;
  const pairs = pairsOn(bracelet);
  return pairs.length * 2 === halves && pairs.every(({ a, b }) => loopDistance(a, b, bracelet.length) <= MAX_DISTANCE);
}

/** Empties both spots of every twin chain that is missing a half or stretched too far. */
export function dropBrokenPairs(bracelet: Charm[], empty: () => Charm): Charm[] {
  const ok = new Set(
    pairsOn(bracelet)
      .filter(({ a, b }) => loopDistance(a, b, bracelet.length) <= MAX_DISTANCE)
      .map(({ pairId }) => pairId),
  );
  return bracelet.map(item => (item?.pairId && !ok.has(item.pairId) ? empty() : item));
}

/** Empties both halves of the twin chain in spot `index` (just that spot if it isn't one). */
export function emptyPairAt(bracelet: Charm[], index: number, empty: () => Charm): Charm[] {
  const pairId = bracelet[index]?.pairId;
  return bracelet.map((item, i) => (i === index || (pairId && item?.pairId === pairId) ? empty() : item));
}

const isEmptySpot = (item: Charm | undefined) => !item || !!item.isPlaceholder;

/**
 * An empty spot for the second half, as close to `first` as possible
 * (right side first, then left), within reach of the chain. Null if none.
 */
export function spotNear(bracelet: Charm[], first: number): number | null {
  const n = bracelet.length;
  for (let d = 1; d <= MAX_DISTANCE; d++) {
    for (const j of [(first + d) % n, (first - d + n) % n]) {
      if (j !== first && isEmptySpot(bracelet[j])) return j;
    }
  }
  return null;
}

/** Two empty spots within reach of each other, earliest first. Null if there's no room. */
export function findPairSpots(bracelet: Charm[]): [number, number] | null {
  for (let i = 0; i < bracelet.length; i++) {
    if (!isEmptySpot(bracelet[i])) continue;
    const j = spotNear(bracelet, i);
    if (j !== null) return [i, j];
  }
  return null;
}

/** The two halves of a twin chain charm from the catalog, ready to place. */
export function makeHalves(charm: Charm): [Charm, Charm] {
  const pairId = newPairId();
  const half = (h: 0 | 1): Charm => ({ ...charm, id: `${pairId}-${h}`, pairId, half: h });
  return [half(0), half(1)];
}
