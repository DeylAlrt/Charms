"use client";

import {
  DndContext,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import { useState, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import Image from "next/image";

type Props = {
  charmFiles: string[];
};

// SMART AUTO-PRICING — NO NEED TO LIST EVERY CHARM
const getPrice = (filename: string): number => {
  const lower = filename.toLowerCase();

  // PLAIN CHARMS — HIGHEST PRIORITY
  if (lower.includes("plain")) {
    if (lower.includes("gold")) return 1.50;
    if (lower.includes("silver")) return 1.00;
    if (lower.includes("red")) return 1.50;
    if (lower.includes("blue")) return 1.50;
    if (lower.includes("black")) return 1.50;
    if (lower.includes("brown")) return 1.50;
    if (lower.includes("purple")) return 1.50;
    if (lower.includes("pink")) return 1.50;
    return 1.00; // default plain
  }

  // Classics — auto price
  if (lower.includes("classic")) {
    if (lower.includes("concave")) return 2.50;
    if (lower.includes("gold")) return 3.00;
    if (lower.includes("outline")) return 3.50;
    if (lower.includes("colored")) return 4.00;
    if (lower.includes("solid")) return 4.50;
    return 0.00;
  }

  // Premiums — auto price
  if (lower.includes("premium")) {
    if (lower.includes("starter")) return 5.00;
    if (lower.includes("charming")) return 7.00;
    if (lower.includes("iconic")) return 8.00;
    return 7.00;
  }

  // Deluxes — auto price
  if (lower.includes("deluxe")) {
    if (lower.includes("baby")) return 10.00;
    if (lower.includes("silver")) return 12.00;
    if (lower.includes("gold")) return 15.00;
    return 0.00;
  }
  
  // Flags — special price
  if (lower.includes("flag")) {
    return 8.00;
  }

  if (lower.includes("letters")) {
    if (lower.includes("gold")) return 3.50;
    if (lower.includes("silver")) return 3.00;
    return 0.00;
  }

  if (lower.includes("number")) {
    return 3.00;
  } 

  // DEFAULT
  return 0.00;
};

const getCategory = (filename: string): string => {
  const s = filename.toLowerCase();

  if (s.includes("classic") || s.includes("plain")) return "Classic Charms";
  if (s.includes("premium")) return "Premium Charms";
  if (s.includes("deluxe")) return "Deluxe Charms";
  if (s.includes("letters")) return "A-Z";
  if (s.includes("number")) return "0-9";
  if (s.includes("flags")) return "Flags";
  return "All";
};

const LETTER_ORDER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const baseColorOptions = ["Silver", "Gold", "Blue", "Black", "Brown", "Red", "Purple", "Pink"] as const;
type BaseColor = typeof baseColorOptions[number];

const getPlaceholderCharm = (color: BaseColor) => ({
  id: `placeholder-${color.toLowerCase()}`,
  img: `/charms/${color}_Plain_Charm.png`,
  filename: `${color}_Plain_Charm.png`,
  isPlaceholder: true,
});

function DraggableCharm({ charm, compact = false }: any) {
  const isSoldOut = charm.filename.toLowerCase().includes("sold");

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: charm.id,
    disabled: isSoldOut,
  });

  return (
    <div
      ref={setNodeRef}
      {...(!isSoldOut && listeners)}
      {...(!isSoldOut && attributes)}
      className={`relative group ${isSoldOut ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div
        className={`
          relative overflow-hidden rounded-lg shadow-md flex flex-col items-center
          ${compact ? 'p-0' : 'p-2'}
          ${isSoldOut ? 'bg-gray-300 border-2 border-gray-400' : 'bg-white hover:shadow-lg'}
          transition-all
        `}
      >
        <Image
          src={charm.img}
          alt={charm.filename}
          width={120}
          height={120}
          className={`
            w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain
            ${isSoldOut ? 'opacity-30' : 'opacity-100'}
            select-none /* ← NEW: Prevents text/image selection */
          `}
          unoptimized
          draggable={false}
          style={{
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',   
            userSelect: 'none',         
          }}
          onContextMenu={(e) => e.preventDefault()} 
        />
        {!isSoldOut && (
          <div 
            className="fixed pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: 'var(--mouse-x)', top: 'var(--mouse-y)' }}
          >
            <div className="relative translate-x-6 -translate-y-14">
              <div className="bg-gray-900 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-2xl whitespace-nowrap">
                {getPrice(charm.filename).toFixed(2)} AED
              </div>
              <div className="absolute top-1/2 -left-3 -translate-y-1/2">
                <div className="w-0 h-0 
                  border-t-10 border-t-transparent
                  border-r-16 border-r-gray-900
                  border-b-10 border-b-transparent
                " />
              </div>
            </div>
          </div>
        )}
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Image
              src="/Sold Out.png"
              alt="Sold Out"
              width={100}
              height={100}
              className="w-full h-full object-contain px-3 drop-shadow-2xl"
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CharmEditorClient({ charmFiles }: Props) {
  const charmData = charmFiles.map((file, i) => {
    const base = {
      id: `catalog-${i}`,
      img: `/charms/${file}`,
      filename: file,
      category: getCategory(file),
      displayName: file.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim(),
      catalogItem: true,
    };
    return base;
  });
  const categories = ["All", "Classic Charms", "Premium Charms", "Deluxe Charms", "Flags", "A-Z", "0-9"];
  const counts: Record<string, number> = { All: charmData.length };
  for (const c of charmData) {
    counts[c.category] = (counts[c.category] || 0) + 1;
  }

  const sizeMap: Record<string, number> = { small: 16, medium: 18, large: 20, xl: 22 };
  const [size, setSize] = useState<"small" | "medium" | "large" | "xl">("large");
  const maxSlots = sizeMap[size];

  const [selectedBaseColor, setSelectedBaseColor] = useState<BaseColor>("Silver");
  const [bracelet, setBracelet] = useState<any[]>(() => 
    Array(maxSlots).fill(getPlaceholderCharm(selectedBaseColor))
  );

  useEffect(() => {
    const newPlaceholder = getPlaceholderCharm(selectedBaseColor);

    setBracelet(prev => prev.map(item =>
      item?.isPlaceholder ? { ...newPlaceholder, id: `placeholder-${Date.now()}-${Math.random()}` } : item
    ));
  }, [selectedBaseColor]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const placeholder = getPlaceholderCharm(selectedBaseColor);
    setBracelet(prev => {
      const needed = maxSlots - prev.length;
      if (needed > 0) {
        return [...prev, ...Array(needed).fill(placeholder)];
      } else if (needed < 0) {
        return prev.slice(0, maxSlots);
      }
      return prev;
    });
  }, [maxSlots, selectedBaseColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--mouse-x', `${mousePos.x}px`);
    document.documentElement.style.setProperty('--mouse-y', `${mousePos.y}px`);
  }, [mousePos]);

  const [activeCategory, setActiveCategory] = useState("All");
  const [activeCharm, setActiveCharm] = useState<any>(null);
  const [showCategories, setShowCategories] = useState(true);
  const charmsContainerRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 50,
        tolerance: 5,  
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    })
  );

  useEffect(() => {
    if (charmsContainerRef.current) {
      charmsContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeCategory]);

  let filteredCharms = activeCategory === "All" ? charmData : charmData.filter((c) => c.category === activeCategory);

  if (activeCategory === "A-Z" || activeCategory === "All") {
    filteredCharms = [...filteredCharms].sort((a, b) => {
      const A = a.filename.toLowerCase();
      const B = b.filename.toLowerCase();
      const isGoldA = A.includes("gold");
      const isGoldB = B.includes("gold");
      if (isGoldA && !isGoldB) return -1;
      if (!isGoldA && isGoldB) return 1;
      const getLetter = (name: string) => {
        const num = name.match(/\((\d+)\)/)?.[1];
        if (num) return LETTER_ORDER[parseInt(num) - 1] || "Z";
        const letter = name.match(/[a-z]/i)?.[0];
        return letter ? letter.toUpperCase() : "Z";
      };
      return getLetter(A).localeCompare(getLetter(B));
    });
  }

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

  const categoryPrefixFor = (cat: string) => {
    switch (cat) {
      case 'Deluxe Charms': return 'deluxe';
      case 'Premium Charms': return 'premium';
      case '0-9': return 'number';
      case 'A-Z': return 'letter';
      default: return 'classic';
    }
  };

  const openRenameModal = (oldFilename: string) => {
    setRenameOld(oldFilename);
    const cat = getCategory(oldFilename);
    const prefix = categoryPrefixFor(cat);
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
    } catch (err: any) {
      setRenameError(err?.message || String(err));
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
    } catch (err: any) {
      alert('Undo failed: ' + (err?.message || err));
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
    if (!uploadFile) { setUploadError('Choose a file'); return; return; }
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
    } catch (err: any) {
      setUploadError(err?.message || String(err));
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
    } catch (err: any) {
      alert('Delete failed: ' + (err?.message || err));
    }
  };

  // ONLY FIXED PART — DRAG & DROP NOW WORKS
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveCharm(null);

    if (!over || !String(over.id).startsWith("slot-")) {
      const fromIndex = bracelet.findIndex(item => item?.id === active.id);
      if (fromIndex !== -1 && !bracelet[fromIndex]?.isPlaceholder) {
        setBracelet(prev => {
          const copy = [...prev];
          copy[fromIndex] = getPlaceholderCharm(selectedBaseColor);
          return copy;
        });
      }
      return;
    }

    const targetIndex = Number(String(over.id).slice(5));
    const fromIndex = bracelet.findIndex(item => item?.id === active.id);

    if (fromIndex === -1) {
      // FROM CATALOG → ADD
      const catalogCharm = charmData.find(c => c.id === active.id);
      if (!catalogCharm || catalogCharm.filename.toLowerCase().includes("sold")) return;

      setBracelet(prev => {
        const copy = [...prev];
        copy[targetIndex] = {
          ...catalogCharm,
          id: `bracelet-${Date.now()}-${Math.random()}`,
        };
        return copy;
      });
      return;
    }

    // FROM BRACELET → SWAP
    if (fromIndex !== -1 && targetIndex !== fromIndex) {
      setBracelet(prev => {
        const copy = [...prev];
        const temp = copy[fromIndex];
        copy[fromIndex] = copy[targetIndex];
        copy[targetIndex] = temp;
        copy[fromIndex] = { ...copy[fromIndex], id: `swapped-${Date.now()}-a` };
        copy[targetIndex] = { ...copy[targetIndex], id: `swapped-${Date.now()}-b` };
        return copy;
      });
    }
  };

  const filled = bracelet.filter(b => !b?.isPlaceholder).length;

  function DroppableSlot({ index, children }: { index: number; children?: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id: `slot-${index}` });
    const currentItem = bracelet[index];

    const { attributes, listeners, setNodeRef: setDraggableRef } = useDraggable({
      id: `bracelet-${index}`,
      disabled: currentItem?.isPlaceholder || false,
    });

    return (
      <div
        ref={setNodeRef}
        id={`slot-${index}`}
        className={`w-full aspect-square bg-white/90 rounded-sm shadow-sm border-2 border-transparent flex items-center justify-center transition ${isOver ? "border-sky-400 scale-105" : ""}`}
      >
        {children && (
          <div
            ref={currentItem?.isPlaceholder ? undefined : setDraggableRef}
            {...(currentItem?.isPlaceholder ? {} : listeners)}
            {...(currentItem?.isPlaceholder ? {} : attributes)}
            className={currentItem?.isPlaceholder ? '' : 'cursor-grab active:cursor-grabbing'}
          >
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => {
        const charmInCatalog = charmData.find((c) => c.id === e.active.id);
        const charmInBracelet = bracelet.find((b) => b && b.id === e.active.id);
        setActiveCharm(charmInCatalog || charmInBracelet || null);
      }}
      onDragEnd={handleDragEnd}
    >

      <div
        className="h-screen bg-gradient-to-br from-sky-50 via-sky-100 to-white flex flex-col overflow-hidden select-none touch-none"
        onContextMenu={(e) => e.preventDefault()}
      >

        <header className="bg-white/90 backdrop-blur sticky top-0 z-50 p-3 flex justify-between items-center flex-shrink-0">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
            Navillera
          </h1>
        </header>

        <div className="w-full flex flex-col flex-1 overflow-hidden px-4 sm:px-6 md:px-40 lg:px-30 xl:px-80 pb-4">
          <div className="bg-white rounded-lg shadow-md m-3 mb-0 p-2 flex-shrink-0">
            <div className="flex justify-between items-center mb-2 gap-2">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-black">Charms: {filled}/{maxSlots}</p>
                <select value={size} onChange={(e) => setSize(e.target.value as any)} className="text-xs px-2 py-1 border rounded-md bg-white text-black">
                  <option value="small">Small (16)</option>
                  <option value="medium">Medium (18)</option>
                  <option value="large">Large (20)</option>
                  <option value="xl">XL (22)</option>
                </select>
                <select value={selectedBaseColor} onChange={(e) => setSelectedBaseColor(e.target.value as BaseColor)} className="text-xs px-2 py-1 border rounded-md bg-white text-black capitalize">
                  {baseColorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-bold text-sky-600">
                  Total: {bracelet.reduce((sum, item) => sum + (item ? getPrice(item.filename) : 0), 0).toFixed(2)} AED
                </div>
                <button onClick={() => openUploadModal()} className="bg-sky-600 text-white px-3 py-1 rounded-full text-xs">Upload</button>
                <button onClick={() => setBracelet(Array(maxSlots).fill(getPlaceholderCharm(selectedBaseColor)))} className="bg-red-600 text-white px-3 py-1 rounded-full text-xs">ERROR</button>
              </div>
            </div>

            <div className="w-full overflow-hidden">
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${maxSlots}, 1fr)`, alignItems: 'center' }}>
                {Array.from({ length: maxSlots }, (_, i) => (
                  <div key={i} className="p-0">
                    <DroppableSlot index={i}>
                      {bracelet[i] && <DraggableCharm charm={bracelet[i]} compact={true} />}
                    </DroppableSlot>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RENAME MODAL */}
          {renameOpen && (
            <div className="fixed inset-0 flex items-center justify-center z-60">
              <div className="absolute inset-0 bg-black/40" onClick={() => setRenameOpen(false)} />
              <div className="relative bg-black rounded-md p-4 w-80 shadow-lg z-70">
                <h3 className="font-bold mb-2 text-green-500">Rename Charm</h3>
                <div className="mb-2 text-sm text-green-500">Old: <span className="font-mono">{renameOld}</span></div>
                <label className="block text-xs mb-1 text-green-500">Category (prefix)</label>
                <select className="w-full text-sm bg-black text-green-500 mb-2 p-1 border rounded" value={getCategory(renameNew)} onChange={(e) => {
                  const chosen = e.target.value;
                  const prefix = categoryPrefixFor(chosen);
                  setRenameNew(`${prefix}_${renameOld || ''}`);
                }}>
                  <option>Classic Charms</option>
                  <option>Premium Charms</option>
                  <option>Deluxe Charms</option>
                  <option>A-Z</option>
                  <option>0-9</option>
                </select>
                <label className="block text-xs text-green-500 mb-1">New filename</label>
                <input className="w-full mb-2 p-1 border rounded text-green-500" value={renameNew} onChange={(e) => setRenameNew(e.target.value)} />
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input type="checkbox" checked={renameOverwrite} onChange={(e) => setRenameOverwrite(e.target.checked)} />
                  <span className="text-green-500 text-xs">Overwrite if exists</span>
                </label>
                {renameError && <div className="text-red-900 text-sm mb-2">{renameError}</div>}
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-1 text-green-500 text-sm" onClick={() => setRenameOpen(false)} disabled={renameLoading}>Cancel</button>
                  <button className="px-3 py-1 bg-red-900 text-green-500 rounded text-sm" onClick={submitRename} disabled={renameLoading}>{renameLoading ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            </div>
          )}

          {/* UNDO SNACKBAR */}
          {lastRename && (
            <div className="fixed bottom-4 right-4 bg-white border shadow-md p-3 rounded flex items-center gap-3">
              <div className="text-sm">Renamed <span className="font-mono">{lastRename.oldName}</span> → <span className="font-mono">{lastRename.newName}</span></div>
              <button className="px-2 py-1 bg-gray-200 rounded text-sm" onClick={undoLastRename}>Undo</button>
            </div>
          )}

          {/* UPLOAD MODAL */}
          {uploadOpen && (
            <div className="fixed inset-0 flex items-center justify-center z-60">
              <div className="absolute inset-0 bg-black/40" onClick={() => setUploadOpen(false)} />
              <div className="relative bg-black rounded-md p-4 w-96 shadow-lg z-70 text-green-500">
                <h3 className="font-bold mb-4 text-green-500">Upload Charm</h3>
                <label className="block text-xs mb-1 text-green-500">Choose image file</label>
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] || null; setUploadFile(f); if (f) setUploadFilename(f.name); }} />
                <label className="block text-xs mt-2 mb-1 text-green-500">Filename</label>
                <input className="w-full mb-2 p-1 border rounded text-sm text-green-500" value={uploadFilename} onChange={(e) => setUploadFilename(e.target.value)} />
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input type="checkbox" checked={uploadOverwrite} onChange={(e) => setUploadOverwrite(e.target.checked)} />
                  <span className="text-xs text-green-500">Overwrite if exists</span>
                </label>
                {uploadError && <div className="text-red-600 text-sm mb-2">{uploadError}</div>}
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-1 text-sm text-green-500" onClick={() => setUploadOpen(false)} disabled={uploadLoading}>Cancel</button>
                  <button className="px-3 py-1 bg-red-700 text-white rounded text-sm" onClick={submitUpload} disabled={uploadLoading}>{uploadLoading ? 'Uploading...' : 'Upload'}</button>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORIES */}
          <div className="bg-white rounded-lg shadow-md m-3 mb-0 p-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="hidden md:block" />
              <button className="md:hidden px-3 py-2 rounded-md bg-gray-100" onClick={() => setShowCategories(s => !s)}>Menu</button>
            </div>
            <div className={`${showCategories ? "block" : "hidden"} md:block`}>
              <div className="flex flex-wrap justify-center gap-2">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-2 py-1 rounded-full font-bold text-xs transition flex items-center gap-1 ${activeCategory === cat ? "bg-gradient-to-r from-sky-600 to-sky-400 text-white shadow-lg" : "bg-gray-200 text-gray-700"}`}>
                    <span>{cat}</span>
                    <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs text-black">{counts[cat] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CHARM GRID */}
          <div
            ref={charmsContainerRef}
            className="flex-1 bg-white overflow-y-auto rounded-lg shadow-md m-3 mt-2 p-3 flex flex-col touch-pan-y"
            style={{ touchAction: activeCharm ? "none" : "pan-y" }}   // ← THIS IS THE KILL SHOT
          >
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 justify-items-center">
              {filteredCharms.map((charm) => (
                <div key={charm.id} className="relative group">
                  <DraggableCharm charm={charm} />
                  <div className="absolute right-1 bottom-1 flex gap-1 items-center invisible group-hover:visible">
                    <button onClick={() => deleteCharm(charm.filename)} className="text-[10px] bg-white/90 px-1 rounded" title="Delete file">Delete</button>
                    <button onClick={() => openRenameModal(charm.filename)} className="text-[10px] bg-white/90 px-1 rounded" title="Rename file">Rename</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeCharm ? <Image src={activeCharm.img} alt={activeCharm.filename} width={70} height={70} unoptimized draggable={false} /> : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}