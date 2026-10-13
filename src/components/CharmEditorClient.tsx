"use client";

import { useBracelet } from './charmEditor/useBracelet';
import { useAdminSession } from './charmEditor/useAdminSession';
import { useCharmStock } from './charmEditor/useCharmStock';
import { useOutOfStock } from './charmEditor/useOutOfStock';
import { useBaseColorAvailability } from './charmEditor/useBaseColorAvailability';
import { useCharmFileManager } from './charmEditor/useCharmFileManager';
import { useCheckout } from './charmEditor/useCheckout';
import BraceletStrip from './charmEditor/BraceletStrip';
import CharmCatalog from './charmEditor/CharmCatalog';
import AdminColorManager from './charmEditor/AdminColorManager';
import RenameModal, { RenameUndoSnackbar } from './charmEditor/RenameModal';
import UploadModal from './charmEditor/UploadModal';
import CartDrawer from './charmEditor/CartDrawer';
import SiteHeader from './SiteHeader';

type Props = {
  charmFiles: string[];
};

export default function CharmEditorClient({ charmFiles }: Props) {
  const bracelet = useBracelet();
  const admin = useAdminSession();
  const stock = useCharmStock();
  const outOfStock = useOutOfStock();
  const baseColors = useBaseColorAvailability(bracelet.selectedBaseColor, bracelet.setSelectedBaseColor);
  const files = useCharmFileManager();
  const checkout = useCheckout({
    bracelet: bracelet.bracelet,
    maxSlots: bracelet.maxSlots,
    selectedBaseColor: bracelet.selectedBaseColor,
    subtotal: bracelet.subtotal,
  });

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
          availableBaseColors={baseColors.availableBaseColors}
          ownerMode={admin.ownerMode}
          onOwnerLogin={admin.login}
          onOpenUpload={files.upload.openModal}
          onOpenCart={checkout.openCart}
          onClear={bracelet.clear}
          onSwapCharms={bracelet.swapCharms}
          onRemoveCharmAt={bracelet.removeCharmAt}
        />

        <RenameModal rename={files.rename} />
        <RenameUndoSnackbar lastRename={files.lastRename} onUndo={files.undoLastRename} />
        <UploadModal upload={files.upload} />

        <CharmCatalog
          charmFiles={charmFiles}
          ownerMode={admin.ownerMode}
          outOfStockMap={outOfStock.outOfStockMap}
          onToggleOutOfStock={outOfStock.toggleOutOfStock}
          charmStock={stock.charmStock}
          stockLoading={stock.stockLoading}
          onUpdateStock={stock.updateCharmStock}
          onAddCharm={bracelet.addCharm}
          onDeleteCharm={files.deleteCharm}
          onOpenRenameModal={files.rename.openFor}
          panelBetween={admin.ownerMode && (
            <AdminColorManager colorStatuses={baseColors.colorStatuses} onToggle={baseColors.toggleColorStatus} />
          )}
        />
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
