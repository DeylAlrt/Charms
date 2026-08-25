"use client";

type UploadState = {
  open: boolean;
  file: File | null;
  filename: string;
  overwrite: boolean;
  loading: boolean;
  error: string | null;
  setFile: (f: File | null) => void;
  setFilename: (v: string) => void;
  setOverwrite: (v: boolean) => void;
  close: () => void;
  submit: () => void;
};

/** Owner-only modal for uploading a new charm image into the catalog. */
export default function UploadModal({ upload }: { upload: UploadState }) {
  if (!upload.open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-60">
      <div className="absolute inset-0 bg-navy/40" onClick={upload.close} />
      <div className="relative bg-white rounded-lg p-4 w-96 shadow-lg z-70 border border-sky-tint text-navy">
        <h3 className="font-bold mb-4 text-navy">Upload Charm</h3>
        <label className="block text-xs mb-1 text-muted">Choose image file</label>
        <input type="file" accept="image/*" onChange={(e) => {
          const f = e.target.files?.[0] || null;
          upload.setFile(f);
          if (f) upload.setFilename(f.name);
        }} />
        <label className="block text-xs mt-2 mb-1 text-muted">Filename</label>
        <input className="w-full mb-2 p-1 border border-sky-tint rounded text-sm text-navy focus:outline-none focus:border-accent-blue" value={upload.filename} onChange={(e) => upload.setFilename(e.target.value)} />
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={upload.overwrite} onChange={(e) => upload.setOverwrite(e.target.checked)} />
          <span className="text-xs text-muted">Overwrite if exists</span>
        </label>
        {upload.error && <div className="text-danger text-sm mb-2">{upload.error}</div>}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 text-sm text-muted" onClick={upload.close} disabled={upload.loading}>Cancel</button>
          <button className="px-3 py-1 bg-navy text-white rounded text-sm hover:bg-pastel-blue hover:text-navy transition-colors" onClick={upload.submit} disabled={upload.loading}>{upload.loading ? 'Uploading...' : 'Upload'}</button>
        </div>
      </div>
    </div>
  );
}
