import { useEffect, useState } from 'react';
import { baseColorOptions, getPlaceholderCharm, getPrice, type BaseColor, type Charm } from '../charmEditorUtils';
import { getCatalogueEntry } from '../charmCatalogue';

const SAVED_DESIGN_KEY = 'navillera-bracelet-design';

export const BRACELET_SIZES: Record<'small' | 'medium' | 'large' | 'xl', number> = {
  small: 16,
  medium: 18,
  large: 20,
  xl: 22,
};

/** Total price of every real (non-placeholder) charm currently on the bracelet. */
const calculateSubtotal = (bracelet: (Charm | undefined)[]) =>
  bracelet.reduce((sum, item) => sum + (item ? getPrice(item.filename) : 0), 0);

/**
 * Owns the bracelet's size, base color, and per-slot contents, plus every
 * mutation the rest of the app needs to perform on it (add/remove/move/replace/clear
 * and the cart's quantity +/- buttons). Presentation-only interaction state
 * (which slot is selected, which is mid-drag) belongs to the components that
 * render the strip, not here.
 */
export function useBracelet() {
  const [size, setSize] = useState<keyof typeof BRACELET_SIZES>('large');
  const maxSlots = BRACELET_SIZES[size];

  const [selectedBaseColor, setSelectedBaseColor] = useState<BaseColor>('Silver');
  const [bracelet, setBracelet] = useState<Charm[]>(() =>
    Array(maxSlots).fill(getPlaceholderCharm(selectedBaseColor))
  );

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
        setBracelet(saved.bracelet.map((item: Charm | null) =>
          item && !item.isPlaceholder && getCatalogueEntry(item.filename) ? item : getPlaceholderCharm(color)
        ));
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

  // Grow or shrink the slot count to match the selected bracelet size.
  useEffect(() => {
    const placeholder = getPlaceholderCharm(selectedBaseColor);
    setBracelet(prev => {
      const needed = maxSlots - prev.length;
      if (needed > 0) return [...prev, ...Array(needed).fill(placeholder)];
      if (needed < 0) return prev.slice(0, maxSlots);
      return prev;
    });
  }, [maxSlots, selectedBaseColor]);

  const clear = () => setBracelet(Array(maxSlots).fill(getPlaceholderCharm(selectedBaseColor)));

  const addCharm = (charm: Charm) => {
    setBracelet(prev => {
      const copy = [...prev];
      const emptyIndex = copy.findIndex(item => !item || item.isPlaceholder);
      if (emptyIndex === -1) return prev;
      copy[emptyIndex] = { ...charm, id: `bracelet-${Date.now()}-${Math.random()}` };
      return copy;
    });
  };

  const removeCharmAt = (index: number) => {
    setBracelet(prev => {
      const copy = [...prev];
      copy[index] = getPlaceholderCharm(selectedBaseColor);
      return copy;
    });
  };

  /** Drag and drop: takes the charm out of `fromIndex` and slots it in at
   *  `toIndex`; the charms in between shift one place to close the gap. */
  const moveCharm = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setBracelet(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  /** Puts `charm` in this exact spot, replacing whatever is there. */
  const replaceCharmAt = (index: number, charm: Charm) => {
    setBracelet(prev => prev.map((item, i) =>
      i === index ? { ...charm, id: `bracelet-${Date.now()}-${Math.random()}` } : item
    ));
  };

  /** Cart "-" button: clears one instance of this filename. */
  const decrementCharm = (filename: string) => {
    setBracelet(prev => {
      const index = prev.findIndex(b => b?.filename === filename);
      if (index === -1) return prev;
      return prev.map((b, i) => i === index ? getPlaceholderCharm(selectedBaseColor) : b);
    });
  };

  /** Cart "+" button: adds another instance of this exact charm into the first empty slot. */
  const incrementCharm = (charm: Charm) => addCharm(charm);

  /** Cart trash button: clears every slot holding this filename. */
  const removeAllOfFilename = (filename: string) => {
    setBracelet(prev => prev.map(b => b?.filename === filename ? getPlaceholderCharm(selectedBaseColor) : b));
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
    clear,
    addCharm,
    removeCharmAt,
    moveCharm,
    replaceCharmAt,
    decrementCharm,
    incrementCharm,
    removeAllOfFilename,
  };
}

export type UseBraceletResult = ReturnType<typeof useBracelet>;
