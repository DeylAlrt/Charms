"use client";

import { useEffect, useState } from 'react';
import { useBracelet } from './charmEditor/useBracelet';
import { useCheckout } from './charmEditor/useCheckout';
import BraceletStrip from './charmEditor/BraceletStrip';
import CharmCatalog from './charmEditor/CharmCatalog';
import CartDrawer from './charmEditor/CartDrawer';
import SiteHeader from './SiteHeader';
import type { Charm } from './charmEditorUtils';

type Props = {
  charmFiles: string[];
};

export default function CharmEditorClient({ charmFiles }: Props) {
  const bracelet = useBracelet();
  const checkout = useCheckout({
    bracelet: bracelet.bracelet,
    maxSlots: bracelet.maxSlots,
    selectedBaseColor: bracelet.selectedBaseColor,
    subtotal: bracelet.subtotal,
  });

  // The bracelet spot the customer tapped. While one is picked, the next
  // charm tapped in the catalog goes into that exact spot.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Forget the picked spot if it no longer exists (smaller bracelet size)
  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= bracelet.maxSlots) setSelectedIndex(null);
  }, [selectedIndex, bracelet.maxSlots]);

  const handleAddCharm = (charm: Charm) => {
    if (selectedIndex !== null) {
      bracelet.replaceCharmAt(selectedIndex, charm);
      setSelectedIndex(null);
    } else {
      bracelet.addCharm(charm);
    }
  };

  return (
    <div
      className="h-screen bg-gradient-to-br from-sky-tint-light via-white to-white flex flex-col overflow-hidden select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <SiteHeader />

      <div className="w-full flex flex-col flex-1 overflow-hidden px-4 sm:px-6 md:px-40 lg:px-30 xl:px-24 pb-4">
        <BraceletStrip
          bracelet={bracelet.bracelet}
          maxSlots={bracelet.maxSlots}
          filled={bracelet.filled}
          subtotal={bracelet.subtotal}
          size={bracelet.size}
          onSizeChange={bracelet.setSize}
          selectedBaseColor={bracelet.selectedBaseColor}
          onBaseColorChange={bracelet.setSelectedBaseColor}
          onOpenCart={checkout.openCart}
          onClear={() => { bracelet.clear(); setSelectedIndex(null); }}
          onMoveCharm={bracelet.moveCharm}
          onRemoveCharmAt={bracelet.removeCharmAt}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
        />

        <CharmCatalog charmFiles={charmFiles} onAddCharm={handleAddCharm} />
      </div>

      <CartDrawer
        checkout={checkout}
        bracelet={bracelet.bracelet}
        subtotal={bracelet.subtotal}
        onDecrement={bracelet.decrementCharm}
        onIncrement={bracelet.incrementCharm}
        onRemoveAll={bracelet.removeAllOfFilename}
      />
    </div>
  );
}
