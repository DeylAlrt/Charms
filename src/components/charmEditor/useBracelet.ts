import { useEffect, useState } from 'react';
import { getPlaceholderCharm, getPrice, type BaseColor, type Charm } from '../charmEditorUtils';

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
 * mutation the rest of the app needs to perform on it (add/remove/swap/clear
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

  const swapCharms = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setBracelet(prev => {
      const copy = [...prev];
      [copy[fromIndex], copy[toIndex]] = [copy[toIndex], copy[fromIndex]];
      return copy;
    });
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
    swapCharms,
    decrementCharm,
    incrementCharm,
    removeAllOfFilename,
  };
}

export type UseBraceletResult = ReturnType<typeof useBracelet>;
