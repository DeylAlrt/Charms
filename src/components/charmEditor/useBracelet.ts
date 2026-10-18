import { useEffect, useRef, useState } from 'react';
import { baseColorOptions, charmImageUrl, getPlaceholderCharm, getPrice, type BaseColor, type Charm } from '../charmEditorUtils';
import { getCatalogueEntry } from '../charmCatalogue';
import {
  MAX_LINKS_BETWEEN, dropBrokenPairs, emptyPairAt, findPairSpots, isTwinChain, makeHalves, pairsAreValid, partnerOf, spotNear,
} from './twinChains';
import { WATCH_LINKS, freeSpots, getWatch, isWatchPart, layOutAroundWatch, sidesOfWatch, watchOn, watchParts, watchSpots } from './watches';

const SAVED_DESIGN_KEY = 'navillera-bracelet-design';

export const BRACELET_SIZES: Record<'small' | 'medium' | 'large' | 'xl', number> = {
  small: 16,
  medium: 18,
  large: 20,
  xl: 22,
};

/** ✏️ What the size menu shows — same as the main site's size guide (size-guide.html). */
export const BRACELET_SIZE_INFO: Record<keyof typeof BRACELET_SIZES, { label: string; wrist: string; note?: string }> = {
  small: { label: 'Small', wrist: '14–15 cm' },
  medium: { label: 'Medium', wrist: '16–17 cm', note: 'Most popular' },
  large: { label: 'Large', wrist: '18–19 cm' },
  xl: { label: 'XL', wrist: '20–21 cm' },
};

/** Total price of every real (non-placeholder) charm; a twin chain is priced once (first half), a watch once (first part). */
const calculateSubtotal = (bracelet: (Charm | undefined)[]) =>
  bracelet.reduce((sum, item) => sum + (item && item.half !== 1 && !(item.watchPart ?? 0) ? getPrice(item.filename) : 0), 0);

const CHAIN_TOO_FAR = `The chain only reaches ${MAX_LINKS_BETWEEN} links — keep both halves of a twin chain close together.`;
const NO_ROOM_FOR_PAIR = `A twin chain needs 2 empty spots with at most ${MAX_LINKS_BETWEEN} links between them. Remove a charm to make room.`;

const withNewId = (charm: Charm): Charm => ({ ...charm, id: `bracelet-${Date.now()}-${Math.random()}` });

/**
 * Owns the bracelet's size, base color, and per-slot contents, plus every
 * mutation the rest of the app needs to perform on it (add/remove/move/replace/clear
 * and the cart's quantity +/- buttons). Presentation-only interaction state
 * (which slot is selected, which is mid-drag) belongs to the components that
 * render the strip, not here.
 *
 * Twin chains take two spots (two halves sharing a pairId) and always come
 * and go together; see twinChains.ts for the rules.
 */
export function useBracelet() {
  const [size, setSize] = useState<keyof typeof BRACELET_SIZES>('large');
  const maxSlots = BRACELET_SIZES[size];

  const [selectedBaseColor, setSelectedBaseColor] = useState<BaseColor>('Silver');
  const [bracelet, setBracelet] = useState<Charm[]>(() =>
    Array(maxSlots).fill(getPlaceholderCharm(selectedBaseColor))
  );
  const empty = () => getPlaceholderCharm(selectedBaseColor);

  // A short message when something can't be done (e.g. a twin chain stretched too far)
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  };
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // Keep the design for this browser tab (sessionStorage), so it survives a
  // refresh and the trip to Ziina's payment page and back. Restored once on
  // load; charms no longer in the catalogue come back as empty spots.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SAVED_DESIGN_KEY) || 'null');
      if (saved && saved.size in BRACELET_SIZES && Array.isArray(saved.bracelet)) {
        // A colour that's no longer offered falls back to Silver
        const color: BaseColor = (baseColorOptions as readonly string[]).includes(saved.color) ? saved.color : 'Silver';
        setSize(saved.size);
        setSelectedBaseColor(color);
        const emptyOf = () => getPlaceholderCharm(color);
        let items: Charm[] = saved.bracelet.map((item: Charm | null) =>
          item && !item.isPlaceholder && (getCatalogueEntry(item.filename) || (isWatchPart(item) && getWatch(item.filename)))
            ? item : emptyOf()
        );
        // A saved watch goes back in the middle, with its full set of parts
        const watch = watchOn(items);
        if (watch) {
          const { left, right } = sidesOfWatch(items);
          items = layOutAroundWatch(left, right, BRACELET_SIZES[saved.size as keyof typeof BRACELET_SIZES], watchParts(watch.filename, watch.img), emptyOf);
        } else {
          items = items.map(item => (isWatchPart(item) ? emptyOf() : item));
        }
        setBracelet(dropBrokenPairs(items, emptyOf));
      }
    } catch {
      // Nothing saved, or storage unavailable — start with an empty bracelet.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(SAVED_DESIGN_KEY, JSON.stringify({ size, color: selectedBaseColor, bracelet }));
    } catch {
      // Storage unavailable (private browsing, etc.) — saving is best-effort.
    }
  }, [restored, size, selectedBaseColor, bracelet]);

  // Re-skin empty slots whenever the base color changes.
  useEffect(() => {
    const newPlaceholder = getPlaceholderCharm(selectedBaseColor);
    setBracelet(prev => prev.map(item =>
      item?.isPlaceholder ? { ...newPlaceholder, id: `placeholder-${Date.now()}-${Math.random()}` } : item
    ));
  }, [selectedBaseColor]);

  // Grow or shrink the slot count to match the selected bracelet size. A
  // smaller size can cut off one half of a twin chain, or change which spots
  // touch at the clasp, so pairs that no longer fit are taken off. With a
  // watch, spots are added/removed at both outer ends so it stays in the middle.
  useEffect(() => {
    const placeholder = getPlaceholderCharm(selectedBaseColor);
    setBracelet(prev => {
      const watch = watchOn(prev);
      if (watch && prev.length !== maxSlots) {
        const { left, right } = sidesOfWatch(prev);
        const parts = prev.filter(isWatchPart);
        return dropBrokenPairs(layOutAroundWatch(left, right, maxSlots, parts, () => placeholder), () => placeholder);
      }
      const needed = maxSlots - prev.length;
      if (needed > 0) return [...prev, ...Array(needed).fill(placeholder)];
      if (needed < 0) return dropBrokenPairs(prev.slice(0, maxSlots), () => placeholder);
      return prev;
    });
  }, [maxSlots, selectedBaseColor]);

  /** Empties every spot — except the watch, which stays until it's switched off. */
  const clear = () => setBracelet(prev => prev.map(item => (isWatchPart(item) ? item : empty())));

  /**
   * Puts a watch in the middle of the bracelet (or swaps it for another), or
   * takes it off with `null`. Charms in the middle spots move to the nearest
   * empty spots; any that don't fit are taken off.
   */
  const setWatch = (file: string | null) => {
    if (file === null) {
      setBracelet(prev => prev.map(item => (isWatchPart(item) ? empty() : item)));
      return;
    }
    const parts = watchParts(file, charmImageUrl(file));
    if (watchOn(bracelet)) {
      setBracelet(prev => prev.map(item => (isWatchPart(item) ? parts[item.watchPart!] : item)));
      return;
    }
    const { start, end } = watchSpots(bracelet.length);
    const next = bracelet.map((item, i) => (i >= start && i <= end ? parts[i - start] : item));
    // Move the charms that were in the middle to the nearest empty spots
    let dropped = 0;
    for (let i = start; i <= end; i++) {
      const charm = bracelet[i];
      if (!charm || charm.isPlaceholder) continue;
      const spots = freeSpots(next).filter(j => next[j]?.isPlaceholder);
      if (spots.length === 0) { dropped++; continue; }
      const nearest = spots.reduce((a, b) => (Math.abs(b - i) < Math.abs(a - i) ? b : a));
      next[nearest] = charm;
    }
    setBracelet(dropBrokenPairs(next, empty));
    if (dropped > 0) showNotice(`The watch takes ${WATCH_LINKS} spots, so ${dropped} charm${dropped === 1 ? '' : 's'} didn't fit and ${dropped === 1 ? 'was' : 'were'} taken off.`);
  };

  /** Puts a charm in the first empty spot — a twin chain's halves in the first two that are close enough. */
  const addCharm = (charm: Charm) => {
    if (isTwinChain(charm.filename)) {
      const spots = findPairSpots(bracelet);
      if (!spots) { showNotice(NO_ROOM_FOR_PAIR); return; }
      const [a, b] = makeHalves(charm);
      setBracelet(prev => prev.map((item, i) => (i === spots[0] ? a : i === spots[1] ? b : item)));
      return;
    }
    setBracelet(prev => {
      const emptyIndex = prev.findIndex(item => !item || item.isPlaceholder);
      if (emptyIndex === -1) return prev;
      return prev.map((item, i) => (i === emptyIndex ? withNewId(charm) : item));
    });
  };

  /** Takes the charm in this spot off — both halves if it's a twin chain. (Not the watch.) */
  const removeCharmAt = (index: number) => {
    if (isWatchPart(bracelet[index])) return;
    setBracelet(prev => emptyPairAt(prev, index, empty));
  };

  /** The bracelet after dragging the charm in `fromIndex` to `toIndex`: the
   *  charms in between shift one place, skipping over the watch, which never moves. */
  const afterMove = (fromIndex: number, toIndex: number): Charm[] | null => {
    if (isWatchPart(bracelet[fromIndex]) || isWatchPart(bracelet[toIndex])) return null;
    const spots = freeSpots(bracelet);
    const charms = spots.map(i => bracelet[i]);
    const [moved] = charms.splice(spots.indexOf(fromIndex), 1);
    charms.splice(spots.indexOf(toIndex), 0, moved);
    const next = [...bracelet];
    spots.forEach((spot, k) => { next[spot] = charms[k]; });
    return next;
  };

  /** Drag and drop. Refused if it would pull a twin chain's halves too far apart. */
  const moveCharm = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = afterMove(fromIndex, toIndex);
    if (!next) return;
    if (!pairsAreValid(next)) { showNotice(CHAIN_TOO_FAR); return; }
    setBracelet(next);
  };

  /** Would this move keep every twin chain within reach? (For live feedback while dragging.) */
  const canMove = (fromIndex: number, toIndex: number) => {
    const next = afterMove(fromIndex, toIndex);
    return !!next && pairsAreValid(next);
  };

  /** Puts `charm` in this exact spot, replacing whatever is there (a whole
   *  twin chain if the spot holds one of its halves). A new twin chain's
   *  second half goes in the nearest empty spot within reach. Not on the watch. */
  const replaceCharmAt = (index: number, charm: Charm) => {
    if (isWatchPart(bracelet[index])) return;
    const cleared = emptyPairAt(bracelet, index, empty);
    if (isTwinChain(charm.filename)) {
      const second = spotNear(cleared, index);
      if (second === null) { showNotice(NO_ROOM_FOR_PAIR); return; }
      const [a, b] = makeHalves(charm);
      setBracelet(cleared.map((item, i) => (i === index ? a : i === second ? b : item)));
      return;
    }
    setBracelet(cleared.map((item, i) => (i === index ? withNewId(charm) : item)));
  };

  /** Cart "-" button: takes off one of this charm (one whole pair for a twin chain; the watch). */
  const decrementCharm = (filename: string) => {
    if (getWatch(filename)) { setWatch(null); return; }
    setBracelet(prev => {
      const index = prev.findIndex(b => b?.filename === filename);
      if (index === -1) return prev;
      return emptyPairAt(prev, index, empty);
    });
  };

  /** Cart "+" button: adds another of this exact charm (there's only ever one watch). */
  const incrementCharm = (charm: Charm) => { if (!getWatch(charm.filename)) addCharm(charm); };

  /** Cart trash button: clears every slot holding this filename. */
  const removeAllOfFilename = (filename: string) => {
    if (getWatch(filename)) { setWatch(null); return; }
    setBracelet(prev => prev.map(b => b?.filename === filename ? empty() : b));
  };

  const watch = watchOn(bracelet);
  // Spots for charms (the watch's spots don't count) and how many are filled
  const charmSpots = maxSlots - (watch ? WATCH_LINKS : 0);
  const filled = bracelet.filter(b => !b?.isPlaceholder && !isWatchPart(b)).length;
  const subtotal = calculateSubtotal(bracelet);

  return {
    size,
    setSize,
    maxSlots,
    charmSpots,
    selectedBaseColor,
    setSelectedBaseColor,
    bracelet,
    filled,
    subtotal,
    notice,
    watch: watch?.filename ?? null,
    setWatch,
    clear,
    addCharm,
    removeCharmAt,
    moveCharm,
    canMove,
    replaceCharmAt,
    decrementCharm,
    incrementCharm,
    removeAllOfFilename,
    partnerOf: (index: number) => partnerOf(bracelet, index),
  };
}

export type UseBraceletResult = ReturnType<typeof useBracelet>;
