import { useEffect, useRef, useState } from 'react';
import { baseColorOptions, getPlaceholderCharm, getPrice, type BaseColor, type Charm } from '../charmEditorUtils';
import { getCatalogueEntry } from '../charmCatalogue';
import {
  MAX_LINKS_BETWEEN, dropBrokenPairs, emptyPairAt, findPairSpots, isTwinChain, makeHalves, pairsAreValid, partnerOf, spotNear,
} from './twinChains';

const SAVED_DESIGN_KEY = 'navillera-bracelet-design';

export const BRACELET_SIZES: Record<'small' | 'medium' | 'large' | 'xl', number> = {
  small: 16,
  medium: 18,
  large: 20,
  xl: 22,
};

/** Total price of every real (non-placeholder) charm; a twin chain is priced once, on its first half. */
const calculateSubtotal = (bracelet: (Charm | undefined)[]) =>
  bracelet.reduce((sum, item) => sum + (item && item.half !== 1 ? getPrice(item.filename) : 0), 0);

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
        const items = saved.bracelet.map((item: Charm | null) =>
          item && !item.isPlaceholder && getCatalogueEntry(item.filename) ? item : getPlaceholderCharm(color)
        );
        setBracelet(dropBrokenPairs(items, () => getPlaceholderCharm(color)));
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
  // touch at the clasp, so pairs that no longer fit are taken off.
  useEffect(() => {
    const placeholder = getPlaceholderCharm(selectedBaseColor);
    setBracelet(prev => {
      const needed = maxSlots - prev.length;
      if (needed > 0) return [...prev, ...Array(needed).fill(placeholder)];
      if (needed < 0) return dropBrokenPairs(prev.slice(0, maxSlots), () => placeholder);
      return prev;
    });
  }, [maxSlots, selectedBaseColor]);

  const clear = () => setBracelet(Array(maxSlots).fill(getPlaceholderCharm(selectedBaseColor)));

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

  /** Takes the charm in this spot off — both halves if it's a twin chain. */
  const removeCharmAt = (index: number) => {
    setBracelet(prev => emptyPairAt(prev, index, empty));
  };

  /** Drag and drop: takes the charm out of `fromIndex` and slots it in at
   *  `toIndex`; the charms in between shift one place to close the gap.
   *  Refused if it would pull a twin chain's halves too far apart. */
  const moveCharm = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...bracelet];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    if (!pairsAreValid(next)) { showNotice(CHAIN_TOO_FAR); return; }
    setBracelet(next);
  };

  /** Would this move keep every twin chain within reach? (For live feedback while dragging.) */
  const canMove = (fromIndex: number, toIndex: number) => {
    const next = [...bracelet];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return pairsAreValid(next);
  };

  /** Puts `charm` in this exact spot, replacing whatever is there (a whole
   *  twin chain if the spot holds one of its halves). A new twin chain's
   *  second half goes in the nearest empty spot within reach. */
  const replaceCharmAt = (index: number, charm: Charm) => {
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

  /** Cart "-" button: takes off one of this charm (one whole pair for a twin chain). */
  const decrementCharm = (filename: string) => {
    setBracelet(prev => {
      const index = prev.findIndex(b => b?.filename === filename);
      if (index === -1) return prev;
      return emptyPairAt(prev, index, empty);
    });
  };

  /** Cart "+" button: adds another of this exact charm. */
  const incrementCharm = (charm: Charm) => addCharm(charm);

  /** Cart trash button: clears every slot holding this filename. */
  const removeAllOfFilename = (filename: string) => {
    setBracelet(prev => prev.map(b => b?.filename === filename ? empty() : b));
  };

  const filled = bracelet.filter(b => !b?.isPlaceholder).length;
  const subtotal = calculateSubtotal(bracelet);

  return {
    size,
    setSize,
    maxSlots,
    selectedBaseColor,
    setSelectedBaseColor,
    bracelet,
    filled,
    subtotal,
    notice,
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
