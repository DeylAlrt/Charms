import { useState } from 'react';
import { getCategory } from '../charmEditorUtils';

/** Extracts a human-readable message from a caught value of unknown shape. */
const getErrorMessage = (err: unknown, fallback = 'Unknown error'): string => {
  if (err && typeof err === 'object') {
    const { text, message } = err as { text?: unknown; message?: unknown };
    if (typeof text === 'string') return text;
    if (typeof message === 'string') return message;
  }
  return typeof err === 'string' ? err : fallback;
};

export const categoryPrefixFor = (cat: string) => {
  switch (cat) {
    case 'Deluxe Charms': return 'deluxe';
    case 'Premium Charms': return 'premium';
    case '0-9': return 'number';
    case 'A-Z': return 'letter';
    default: return 'classic';
  }
};

/**
 * Owner-only file management for catalog charm images: rename (with an undo
 * snackbar), upload, and delete. All three reload the page on success since
 * the catalog is derived server-side from the files on disk.
 */
export function useCharmFileManager() {
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameOld, setRenameOld] = useState<string | null>(null);
  const [renameNew, setRenameNew] = useState('');
  const [renameOverwrite, setRenameOverwrite] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [lastRename, setLastRename] = useState<{ oldName: string; newName: string } | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadOverwrite, setUploadOverwrite] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const openRenameModal = (oldFilename: string) => {
    setRenameOld(oldFilename);
    const prefix = categoryPrefixFor(getCategory(oldFilename));
    setRenameNew(`${prefix}_${oldFilename}`);
    setRenameOverwrite(false);
    setRenameError(null);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    if (!renameOld) return;
    const newNameTrim = renameNew.trim();
    if (!newNameTrim) { setRenameError('Filename cannot be empty'); return; }
    setRenameLoading(true);
    setRenameError(null);
    try {
      const res = await fetch('/api/charm/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: renameOld, newName: newNameTrim, overwrite: renameOverwrite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Rename failed');
      setLastRename({ oldName: renameOld, newName: newNameTrim });
      setRenameOpen(false);
      window.location.reload();
    } catch (err) {
      setRenameError(getErrorMessage(err));
    } finally {
      setRenameLoading(false);
    }
  };

  const undoLastRename = async () => {
    if (!lastRename) return;
    try {
      const res = await fetch('/api/charm/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: lastRename.newName, newName: lastRename.oldName, overwrite: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Undo failed');
      window.location.reload();
    } catch (err) {
      alert('Undo failed: ' + getErrorMessage(err));
    }
  };

  const openUploadModal = () => {
    setUploadFile(null);
    setUploadFilename('');
    setUploadOverwrite(false);
    setUploadError(null);
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!uploadFile) { setUploadError('Choose a file'); return; }
    if (!uploadFilename || uploadFilename.trim() === '') { setUploadError('Enter filename'); return; }
    setUploadLoading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('filename', uploadFilename.trim());
      fd.append('overwrite', uploadOverwrite ? 'true' : 'false');
      const res = await fetch('/api/charm/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setUploadOpen(false);
      window.location.reload();
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploadLoading(false);
    }
  };

  const deleteCharm = async (filename: string) => {
    if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/charm/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      window.location.reload();
    } catch (err) {
      alert('Delete failed: ' + getErrorMessage(err));
    }
  };

  return {
    rename: {
      open: renameOpen, oldName: renameOld, newName: renameNew, overwrite: renameOverwrite,
      loading: renameLoading, error: renameError,
      setNewName: setRenameNew, setOverwrite: setRenameOverwrite, close: () => setRenameOpen(false),
      openFor: openRenameModal, submit: submitRename,
    },
    lastRename,
    undoLastRename,
    upload: {
      open: uploadOpen, file: uploadFile, filename: uploadFilename, overwrite: uploadOverwrite,
      loading: uploadLoading, error: uploadError,
      setFile: setUploadFile, setFilename: setUploadFilename, setOverwrite: setUploadOverwrite,
      close: () => setUploadOpen(false), openModal: openUploadModal, submit: submitUpload,
    },
    deleteCharm,
  };
}
