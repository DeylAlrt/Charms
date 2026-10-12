"use client";

type RenameState = {
  open: boolean;
  oldName: string | null;
  newName: string;
  overwrite: boolean;
  loading: boolean;
  error: string | null;
  setNewName: (v: string) => void;
  setOverwrite: (v: boolean) => void;
  close: () => void;
  submit: () => void;
};

/** Owner-only modal for renaming (or moving between folders) a catalog charm's image file. Prices and categories come from charmCatalogue.ts, keyed by this path. */
export default function RenameModal({ rename }: { rename: RenameState }) {
  if (!rename.open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-60">
      <div className="absolute inset-0 bg-navy/40" onClick={rename.close} />
      <div className="relative bg-white rounded-lg p-4 w-80 shadow-lg z-70 border border-sky-tint">
        <h3 className="font-bold mb-2 text-navy">Rename Charm</h3>
        <div className="mb-2 text-sm text-muted">Old: <span className="font-mono text-navy">{rename.oldName}</span></div>
        <label className="block text-xs text-muted mb-1">New path (e.g. Flag Links/Flags (12).png)</label>
        <input className="w-full mb-2 p-1 border border-sky-tint rounded text-navy focus:outline-none focus:border-accent-blue" value={rename.newName} onChange={(e) => rename.setNewName(e.target.value)} />
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={rename.overwrite} onChange={(e) => rename.setOverwrite(e.target.checked)} />
          <span className="text-muted text-xs">Overwrite if exists</span>
        </label>
        {rename.error && <div className="text-danger text-sm mb-2">{rename.error}</div>}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 text-muted text-sm" onClick={rename.close} disabled={rename.loading}>Cancel</button>
          <button className="px-3 py-1 bg-navy text-white rounded text-sm hover:bg-pastel-blue hover:text-navy transition-colors" onClick={rename.submit} disabled={rename.loading}>{rename.loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

type LastRename = { oldName: string; newName: string };

/** Snackbar offering to undo the most recent rename. */
export function RenameUndoSnackbar({ lastRename, onUndo }: { lastRename: LastRename | null; onUndo: () => void }) {
  if (!lastRename) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-sky-tint shadow-md p-3 rounded-lg flex items-center gap-3">
      <div className="text-sm text-navy">Renamed <span className="font-mono">{lastRename.oldName}</span> → <span className="font-mono">{lastRename.newName}</span></div>
      <button className="px-2 py-1 bg-sky-tint-light text-navy rounded text-sm hover:bg-sky-tint" onClick={onUndo}>Undo</button>
    </div>
  );
}
