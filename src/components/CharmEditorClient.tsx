"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import emailjs from '@emailjs/browser';
import DraggableCharm from './DraggableCharm';
import { LETTER_ORDER, baseColorOptions, getCategory, getPlaceholderCharm, getPrice, isCharmSoldOut, type BaseColor, type Charm } from './charmEditorUtils';

type Props = {
  charmFiles: string[];
};

const CATEGORIES = ["All", "Classic Charms", "Premium Charms", "Deluxe Charms", "Flags", "A-Z", "0-9"];
const BRACELET_SIZES: Record<"small" | "medium" | "large" | "xl", number> = {
  small: 16,
  medium: 18,
  large: 20,
  xl: 22,
};

/** Strips the file extension so a charm's image variants share one stock key. */
const stripExtension = (filename: string) => filename.replace(/\.(png|jpg|jpeg)$/i, '');

/** Extracts a human-readable message from a caught value of unknown shape. */
const getErrorMessage = (err: unknown, fallback = 'Unknown error'): string => {
  if (err && typeof err === 'object') {
    const { text, message } = err as { text?: unknown; message?: unknown };
    if (typeof text === 'string') return text;
    if (typeof message === 'string') return message;
  }
  return typeof err === 'string' ? err : fallback;
};

/** Total price of every real (non-placeholder) charm currently on the bracelet. */
const calculateSubtotal = (bracelet: (Charm | undefined)[]) =>
  bracelet.reduce((sum, item) => sum + (item ? getPrice(item.filename) : 0), 0);

export default function CharmEditorClient({ charmFiles }: Props) {
  // ---------------------------------------------------------------------
  // Catalog: the fixed list of charms available to add to the bracelet.
  // ---------------------------------------------------------------------
  const charmData: Charm[] = charmFiles.map((file, i) => ({
    id: `catalog-${i}`,
    img: `/charms/${file}`,
    filename: file,
    category: getCategory(file),
    displayName: file.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').replace(/\s*\(\d+\)\s*$/, '').trim(),
    catalogItem: true,
  }));

  const categoryCounts: Record<string, number> = { All: charmData.length };
  for (const charm of charmData) {
    categoryCounts[charm.category!] = (categoryCounts[charm.category!] || 0) + 1;
  }

  // ---------------------------------------------------------------------
  // Bracelet: size, base color, and the charms placed in each slot.
  // ---------------------------------------------------------------------
  const [size, setSize] = useState<keyof typeof BRACELET_SIZES>("large");
  const maxSlots = BRACELET_SIZES[size];

  const [selectedBaseColor, setSelectedBaseColor] = useState<BaseColor>("Silver");
  const [bracelet, setBracelet] = useState<Charm[]>(() =>
    Array(maxSlots).fill(getPlaceholderCharm(selectedBaseColor))
  );
  const [selectedBraceletIndex, setSelectedBraceletIndex] = useState<number | null>(null);
  const [draggingBraceletIndex, setDraggingBraceletIndex] = useState<number | null>(null);
  const [touchDraggingIndex, setTouchDraggingIndex] = useState<number | null>(null);
  const [isDraggingCharm, setIsDraggingCharm] = useState(false);

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

  // ---------------------------------------------------------------------
  // Catalog browsing: category filter and owner-only inventory management.
  // ---------------------------------------------------------------------
  const [activeCategory, setActiveCategory] = useState("All");
  const [showCategories, setShowCategories] = useState(true);
  const [ownerMode, setOwnerMode] = useState(false);
  const [colorStatuses, setColorStatuses] = useState<Record<string, boolean>>({});
  const availableBaseColors = Object.keys(colorStatuses).filter(c => colorStatuses[c]);
  const [charmStock, setCharmStock] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState<Record<string, boolean>>({});
  const [outOfStockMap, setOutOfStockMap] = useState<Record<string, boolean>>({});
  const charmsContainerRef = useRef<HTMLDivElement | null>(null);

  // ---------------------------------------------------------------------
  // Bracelet strip scrolling: touch devices get a custom draggable bar
  // (see the scrollbar section below) since native scrolling is disabled
  // on the strip to leave room for touch drag-to-reorder.
  // ---------------------------------------------------------------------
  const braceletScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTrackRef = useRef<HTMLDivElement | null>(null);
  const scrollbarDragRef = useRef<{ startX: number; startScrollLeft: number; maxScrollLeft: number; trackWidth: number; thumbWidthPx: number } | null>(null);
  const [scrollMetrics, setScrollMetrics] = useState({ thumbPct: 100, leftPct: 0 });

  // ---------------------------------------------------------------------
  // Cart and checkout.
  // ---------------------------------------------------------------------
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutFormOpen, setCheckoutFormOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [meetupPlace, setMeetupPlace] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Pay on pickup/delivery (existing flow, unchanged) vs. pay online now via
  // Ziina, embedded in an iframe right on this page.
  const [paymentMethod, setPaymentMethod] = useState<'pickup' | 'online'>('pickup');
  const [ziinaSubmitting, setZiinaSubmitting] = useState(false);
  const [ziinaEmbedUrl, setZiinaEmbedUrl] = useState<string | null>(null);
  const [ziinaResult, setZiinaResult] = useState<'success' | 'failed' | 'canceled' | null>(null);
  const ziinaIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Listens for Ziina's embedded-checkout postMessage events. The order
  // itself isn't confirmed here — that only happens once the Ziina webhook
  // re-verifies payment status server-side — this just drives the UI.
  useEffect(() => {
    function handleZiinaMessage(event: MessageEvent) {
      const iframe = ziinaIframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;
      if (event.origin !== 'https://pay.ziina.com') return;

      const { type, data } = (event.data || {}) as { type?: string; data?: { status?: string } };
      if (type !== 'ZIINA_PAYMENT_STATUS_CHANGE') return;

      if (data?.status === 'COMPLETED') {
        setZiinaResult('success');
        setZiinaEmbedUrl(null);
      } else if (data?.status === 'FAILED') {
        setZiinaResult('failed');
        setZiinaEmbedUrl(null);
      } else if (data?.status === 'CANCELED') {
        setZiinaResult('canceled');
        setZiinaEmbedUrl(null);
      }
    }

    window.addEventListener('message', handleZiinaMessage);
    return () => window.removeEventListener('message', handleZiinaMessage);
  }, []);

  useEffect(() => {
    fetch('/api/base-colors')
      .then(r => r.json())
      .then(setColorStatuses)
      .catch(() => {
        const defaultStatuses: Record<string, boolean> = {};
        baseColorOptions.forEach(c => defaultStatuses[c] = true);
        setColorStatuses(defaultStatuses);
      });
  }, []);

  useEffect(() => {
    emailjs.init('-2tCjwFJUnT97N93w'); // EmailJS Public Key
  }, []);

  useEffect(() => {
    fetch('/api/stock')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setCharmStock(data.stock);
        }
      })
      .catch(err => console.error('Error loading stock:', err));
  }, []);

  useEffect(() => {
    fetch('/api/charm-status')
      .then(r => r.json())
      .then(setOutOfStockMap)
      .catch(err => console.error('Error loading out-of-stock status:', err));
  }, []);

  // Re-enter owner mode automatically if this browser already has a valid
  // admin session (e.g. after a page refresh), without re-prompting.
  useEffect(() => {
    fetch('/api/admin/session')
      .then(r => r.json())
      .then(data => setOwnerMode(!!data.authenticated))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!availableBaseColors.includes(selectedBaseColor)) {
      setSelectedBaseColor((availableBaseColors[0] || "Silver") as BaseColor);
    }
  }, [availableBaseColors, selectedBaseColor]);

  useEffect(() => {
    if (charmsContainerRef.current) {
      charmsContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeCategory]);

  // Custom scrollbar for the bracelet strip: mobile browsers hide/ignore
  // native scrollbar styling, and native touch-scrolling is disabled there
  // so charm drag-to-reorder works, so mobile needs its own draggable bar.
  const updateScrollMetrics = () => {
    const el = braceletScrollRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    if (scrollWidth <= clientWidth) {
      setScrollMetrics({ thumbPct: 100, leftPct: 0 });
      return;
    }
    const thumbPct = Math.max((clientWidth / scrollWidth) * 100, 8);
    const maxScrollLeft = scrollWidth - clientWidth;
    const leftPct = (scrollLeft / maxScrollLeft) * (100 - thumbPct);
    setScrollMetrics({ thumbPct, leftPct });
  };

  useEffect(() => {
    updateScrollMetrics();
    window.addEventListener('resize', updateScrollMetrics);
    return () => window.removeEventListener('resize', updateScrollMetrics);
  }, [maxSlots, size]);

  const handleScrollbarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = braceletScrollRef.current;
    const track = scrollTrackRef.current;
    if (!el || !track) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const trackRect = track.getBoundingClientRect();
    scrollbarDragRef.current = {
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      maxScrollLeft: el.scrollWidth - el.clientWidth,
      trackWidth: trackRect.width,
      thumbWidthPx: trackRect.width * (scrollMetrics.thumbPct / 100),
    };
  };

  const handleScrollbarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = scrollbarDragRef.current;
    const el = braceletScrollRef.current;
    if (!drag || !el) return;
    e.preventDefault();
    const trackRange = drag.trackWidth - drag.thumbWidthPx;
    const scrollDelta = trackRange > 0 ? ((e.clientX - drag.startX) / trackRange) * drag.maxScrollLeft : 0;
    el.scrollLeft = Math.min(Math.max(drag.startScrollLeft + scrollDelta, 0), drag.maxScrollLeft);
    updateScrollMetrics();
  };

  const handleScrollbarPointerUp = () => {
    scrollbarDragRef.current = null;
  };

  const getDeliveryFee = (place: string): number => {
    if (place.includes('Mall of the Emirates Metro') || place.includes('DMCC Metro')) return 5;
    if (place.includes('Union Metro') || place.includes('Burjuman Metro')) return 10;
    if (place.includes('Dubai: 20 AED')) return 20;
    if (place.includes('Other Emirates: 25 AED')) return 25;
    return 0; // Free delivery
  };

  const handleCheckout = () => {
    setCartOpen(false);
    setCheckoutFormOpen(true);
  };

  /** Builds the per-slot image/name fields EmailJS' order template expects. */
  const buildCharmEmailFields = (baseUrl: string) => {
    const fields: Record<string, string> = {};
    const textLayoutLines: string[] = [];
    const plainCharmUrl = `${baseUrl}/charms/${selectedBaseColor}_Plain_Charm.png`;

    for (let i = 0; i < 22; i++) {
      const item = i < maxSlots ? bracelet[i] : undefined;
      const isEmpty = !item || item.isPlaceholder;
      const imageUrl = isEmpty ? plainCharmUrl : baseUrl + item.img;
      const charmName = isEmpty
        ? (i < maxSlots ? `${selectedBaseColor} Plain` : 'Empty')
        : stripExtension(item.filename);

      fields[`charm_${i + 1}_url`] = imageUrl;
      fields[`charm_${i + 1}_name`] = charmName;
      if (i < maxSlots) {
        textLayoutLines.push(isEmpty ? `[${i + 1}] ${selectedBaseColor} Plain Charm` : `[${i + 1}] ${charmName}`);
      }
    }

    fields.text_layout = textLayoutLines.join('\n');
    return fields;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName || !phoneNumber || !pickupTime || !meetupPlace || !deliveryDate) {
      alert('Please fill in all fields.');
      return;
    }

    const subtotal = calculateSubtotal(bracelet);
    const deliveryFee = getDeliveryFee(meetupPlace);
    const total = subtotal + deliveryFee;
    const charmsList = bracelet
      .filter(item => item && !item.isPlaceholder)
      .map(item => item.displayName)
      .join(', ');
    const baseUrl = window.location.origin;

    if (paymentMethod === 'online') {
      setZiinaSubmitting(true);
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName,
            phone: phoneNumber,
            pickupTime,
            meetupPlace,
            deliveryDate,
            braceletSize: `${maxSlots} charms`,
            baseColor: selectedBaseColor,
            subtotal,
            deliveryFee,
            total,
            charmsList,
            emailFields: buildCharmEmailFields(baseUrl),
          }),
        });
        const data = await response.json();
        if (!data.success) {
          alert('❌ Could not start online payment: ' + data.error);
          return;
        }
        setZiinaEmbedUrl(data.embedded_url);
      } catch (error) {
        alert('❌ Could not start online payment: ' + getErrorMessage(error));
      } finally {
        setZiinaSubmitting(false);
      }
      return;
    }

    // --- Pay on pickup/delivery: existing flow, unchanged below ---
    const emailParams = {
      to_email: 'Navilleracharmstudio@gmail.com',
      customer_name: customerName,
      phone: phoneNumber,
      pickup_time: pickupTime,
      meetup_place: meetupPlace,
      delivery_date: deliveryDate,
      bracelet_size: `${maxSlots} charms`,
      base_color: selectedBaseColor,
      subtotal: subtotal.toFixed(2),
      delivery_fee: deliveryFee.toFixed(2),
      total: total.toFixed(2),
      ...buildCharmEmailFields(baseUrl),
    };

    // Log the order to Google Sheets. Non-fatal: the email is what actually
    // notifies the shop, so an order should still go through if this fails.
    try {
      const sheetResponse = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderData: {
            customerName,
            phone: phoneNumber,
            pickupTime,
            meetupPlace,
            deliveryDate,
            size: `${maxSlots} charms`,
            charms: charmsList,
            subtotal: subtotal.toFixed(2),
            deliveryFee: deliveryFee.toFixed(2),
            total: total.toFixed(2),
          },
        }),
      });
      const sheetData = await sheetResponse.json();
      if (!sheetData.success) {
        console.error('Failed to save order to Google Sheets:', sheetData.error);
      }
    } catch (sheetError) {
      console.error('Google Sheets request failed:', sheetError);
    }

    try {
      await emailjs.send('service_335t5bn', 'template_dpoi8cn', emailParams);
      alert('✅ Order submitted successfully!\n\nIf you have any concern please DM us on Instagram: @navilleracharms.ae');
      setCheckoutFormOpen(false);
      setCustomerName('');
      setPhoneNumber('');
      setPickupTime('');
      setMeetupPlace('');
      setDeliveryDate('');
    } catch (error) {
      console.error('Email sending failed:', error);
      alert('❌ Failed to send order: ' + getErrorMessage(error));
    }
  };

  const updateCharmStock = async (charmName: string, quantity: number) => {
    setStockLoading(prev => ({ ...prev, [charmName]: true }));
    
    try {
      const response = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ charmName, quantity }),
      });

      const data = await response.json();
      
      if (data.success) {
        setCharmStock(prev => ({ ...prev, [charmName]: data.quantity }));
      } else {
        alert('Failed to update stock: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock');
    }
    
    setStockLoading(prev => ({ ...prev, [charmName]: false }));
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return 'text-red-600 font-bold';
    if (stock < 5) return 'text-yellow-600 font-semibold';
    return 'text-green-600';
  };
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

  const toggleColorStatus = async (color: string) => {
    const currentStatus = colorStatuses[color] ?? true;
    const newStatus = !currentStatus;
    setColorStatuses(prev => ({ ...prev, [color]: newStatus }));
    try {
      await fetch('/api/base-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color, soldOut: !newStatus }),
      });
    } catch {
      // Revert on error
      setColorStatuses(prev => ({ ...prev, [color]: currentStatus }));
      alert('Failed to update color status');
    }
  };

  const toggleOutOfStock = async (filename: string) => {
    const wasOutOfStock = !!outOfStockMap[filename];
    const nextOutOfStock = !wasOutOfStock;
    setOutOfStockMap(prev => ({ ...prev, [filename]: nextOutOfStock }));
    try {
      const res = await fetch('/api/charm-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, outOfStock: nextOutOfStock }),
      });
      if (!res.ok) throw new Error('Request failed');
    } catch {
      setOutOfStockMap(prev => ({ ...prev, [filename]: wasOutOfStock }));
      alert('Failed to update out-of-stock status');
    }
  };

  /**
   * Prompts for the admin password and verifies it against the server —
   * the password itself never appears in the client bundle, only the
   * pass/fail result. On success the server sets an HttpOnly session
   * cookie, so client-side code (or the console) never sees the token either.
   */
  const handleOwnerLogin = async () => {
    const password = window.prompt('Enter password:');
    if (!password) return;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setOwnerMode(true);
      } else {
        alert('Wrong password');
      }
    } catch {
      alert('Login failed. Please try again.');
    }
  };

  const handleRemoveCharmFromBracelet = (index: number) => {
    setBracelet(prev => {
      const copy = [...prev];
      copy[index] = getPlaceholderCharm(selectedBaseColor);
      return copy;
    });
    setSelectedBraceletIndex(null);
  };

  const handleSwapBraceletCharms = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      setSelectedBraceletIndex(null);
      setDraggingBraceletIndex(null);
      return;
    }

    setBracelet(prev => {
      const copy = [...prev];
      const temp = copy[fromIndex];
      copy[fromIndex] = copy[toIndex];
      copy[toIndex] = temp;
      return copy;
    });
    setSelectedBraceletIndex(null);
    setDraggingBraceletIndex(null);
  };

  const handleAddCharmToBracelet = (charm: Charm) => {
    if (!charm || isCharmSoldOut(charm.filename, outOfStockMap)) return;

    setBracelet(prev => {
      const copy = [...prev];
      const emptyIndex = copy.findIndex(item => !item || item.isPlaceholder);
      if (emptyIndex === -1) return prev;

      copy[emptyIndex] = {
        ...charm,
        id: `bracelet-${Date.now()}-${Math.random()}`,
      };
      return copy;
    });
  };

  const filled = bracelet.filter(b => !b?.isPlaceholder).length;
  const subtotal = calculateSubtotal(bracelet);

  return (
    <div
      className="h-screen bg-gradient-to-br from-sky-50 via-sky-100 to-white flex flex-col overflow-hidden select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="bg-white/90 backdrop-blur sticky top-0 z-50 p-3 flex justify-between items-center flex-shrink-0">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
          Navillera
        </h1>
      </header>

      <div className="w-full flex flex-col flex-1 overflow-hidden px-4 sm:px-6 md:px-40 lg:px-30 xl:px-24 pb-4">
        <div className="bg-white rounded-lg shadow-md m-1 mb-0 p-2 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-2 gap-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-black">Charms: {filled}/{maxSlots}</p>
              <select value={size} onChange={(e) => setSize(e.target.value as keyof typeof BRACELET_SIZES)} className="text-xs px-2 py-1 border rounded-md bg-white text-black">
                <option value="small">Small (16)</option>
                <option value="medium">Medium (18)</option>
                <option value="large">Large (20)</option>
                <option value="xl">XL (22)</option>
              </select>
              <select value={selectedBaseColor} onChange={(e) => setSelectedBaseColor(e.target.value as BaseColor)} className="text-xs px-2 py-1 border rounded-md bg-white text-black capitalize">
                {availableBaseColors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={handleOwnerLogin} style={{opacity: 0, width: '24px', height: '24px', border: 'none', background: 'none'}}></button>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm md:text-lg font-bold text-sky-600">
                Total: {subtotal.toFixed(2)} AED
              </div>
              {ownerMode && <button onClick={() => openUploadModal()} className="bg-sky-600 text-white px-3 py-1 rounded-full text-xs">Upload</button>}
              <button onClick={() => setCartOpen(true)} className="bg-green-600 text-white px-3 py-1 rounded-full text-xs">Cart</button>
              <button onClick={() => setBracelet(Array(maxSlots).fill(getPlaceholderCharm(selectedBaseColor)))} className="bg-red-600 text-white px-3 py-1 rounded-full text-xs">Clear</button>
            </div>
          </div>

          <div
            ref={braceletScrollRef}
            className="w-full overflow-x-auto pb-4 bracelet-scrollbar"
            style={{ touchAction: 'none' }}
            onScroll={updateScrollMetrics}
            onTouchMove={(e) => {
              e.preventDefault();
            }}
          >
            <div className="grid gap-1 min-w-max" style={{ gridTemplateColumns: `repeat(${maxSlots}, minmax(60px, 1fr))`, alignItems: 'center' }}>
              {Array.from({ length: maxSlots }, (_, i) => (
                <div key={i} className="p-0 min-w-[60px]">
                  <div
                    className="w-full aspect-square bg-white/90 rounded-sm shadow-sm border-2 border-transparent flex items-center justify-center relative"
                    data-slot-index={i}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggingBraceletIndex !== null && draggingBraceletIndex !== i) {
                        handleSwapBraceletCharms(draggingBraceletIndex, i);
                      }
                    }}
                  >
                    {bracelet[i] && (
                      <>
                        {selectedBraceletIndex === i && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCharmFromBracelet(i);
                            }}
                            className="absolute right-1 top-1 z-10 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shadow"
                            aria-label="Remove charm"
                          >
                            ×
                          </button>
                        )}
                        <div
                          draggable={!!bracelet[i] && !bracelet[i]?.isPlaceholder}
                          onClick={() => setSelectedBraceletIndex(i)}
                          onDragStart={(e) => {
                            if (!bracelet[i]?.isPlaceholder) {
                              setDraggingBraceletIndex(i);
                              setSelectedBraceletIndex(i);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', String(i));
                            }
                          }}
                          onDragEnd={() => {
                            setDraggingBraceletIndex(null);
                          }}
                          onTouchStart={(e) => {
                            if (!bracelet[i]?.isPlaceholder) {
                              e.preventDefault();
                              e.stopPropagation();
                              setTouchDraggingIndex(i);
                              setSelectedBraceletIndex(i);
                              setIsDraggingCharm(true);
                            }
                          }}
                          onTouchMove={(e) => {
                            if (touchDraggingIndex !== null && isDraggingCharm) {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          onTouchEnd={(e) => {
                            if (touchDraggingIndex !== null && isDraggingCharm) {
                              e.preventDefault();
                              e.stopPropagation();
                              const touch = e.changedTouches[0];
                              const element = document.elementFromPoint(touch.clientX, touch.clientY);

                              if (element) {
                                // Find the parent slot element
                                const slotElement = element.closest('[data-slot-index]') as HTMLElement;

                                if (slotElement) {
                                  const targetIndex = parseInt(slotElement.getAttribute('data-slot-index') || '-1', 10);
                                  if (targetIndex !== -1 && targetIndex !== touchDraggingIndex) {
                                    handleSwapBraceletCharms(touchDraggingIndex, targetIndex);
                                  }
                                }
                              }
                            }
                            setTouchDraggingIndex(null);
                            setIsDraggingCharm(false);
                          }}
                          onTouchCancel={() => {
                            setTouchDraggingIndex(null);
                            setIsDraggingCharm(false);
                          }}
                          style={{ touchAction: 'none', userSelect: 'none' }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <DraggableCharm charm={bracelet[i]} compact={true} interactive={false} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Touch devices ignore native scrollbar styling and can't swipe
              the strip (that gesture drags charms instead), so give them
              an explicit draggable scrollbar. Hidden on mouse/desktop. */}
          <div ref={scrollTrackRef} className="bracelet-touch-scrollbar relative w-full h-4 mt-1 rounded-full bg-gray-200">
            <div
              onPointerDown={handleScrollbarPointerDown}
              onPointerMove={handleScrollbarPointerMove}
              onPointerUp={handleScrollbarPointerUp}
              onPointerCancel={handleScrollbarPointerUp}
              className="absolute top-0 h-full rounded-full bg-sky-600"
              style={{ width: `${scrollMetrics.thumbPct}%`, left: `${scrollMetrics.leftPct}%`, touchAction: 'none' }}
            />
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
            <button className="md:hidden px-3 py-2 rounded-md bg-gray-100" onClick={() => setShowCategories(s => !s)}>
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" viewBox="0 0 48 48">
                <linearGradient id="EIPc0qTNCX0EujYwtxKaXa_MmupZtPbnw66_gr1" x1="12.066" x2="34.891" y1=".066" y2="22.891" gradientUnits="userSpaceOnUse"><stop offset=".237" stopColor="#3bc9f3"></stop><stop offset=".85" stopColor="#1591d8"></stop></linearGradient><path fill="url(#EIPc0qTNCX0EujYwtxKaXa_MmupZtPbnw66_gr1)" d="M43,15H5c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h38c1.1,0,2,0.9,2,2v2C45,14.1,44.1,15,43,15z"></path><linearGradient id="EIPc0qTNCX0EujYwtxKaXb_MmupZtPbnw66_gr2" x1="12.066" x2="34.891" y1="12.066" y2="34.891" gradientUnits="userSpaceOnUse"><stop offset=".237" stopColor="#3bc9f3"></stop><stop offset=".85" stopColor="#1591d8"></stop></linearGradient><path fill="url(#EIPc0qTNCX0EujYwtxKaXb_MmupZtPbnw66_gr2)" d="M43,27H5c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h38c1.1,0,2,0.9,2,2v2C45,26.1,44.1,27,43,27z"></path><linearGradient id="EIPc0qTNCX0EujYwtxKaXc_MmupZtPbnw66_gr3" x1="12.066" x2="34.891" y1="24.066" y2="46.891" gradientUnits="userSpaceOnUse"><stop offset=".237" stopColor="#3bc9f3"></stop><stop offset=".85" stopColor="#1591d8"></stop></linearGradient><path fill="url(#EIPc0qTNCX0EujYwtxKaXc_MmupZtPbnw66_gr3)" d="M43,39H5c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h38c1.1,0,2,0.9,2,2v2C45,38.1,44.1,39,43,39z"></path>
              </svg>
            </button>
          </div>
          <div className={`${showCategories ? "block" : "hidden"} md:block`}>
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-2 py-1 rounded-full font-bold text-xs transition flex items-center gap-1 ${activeCategory === cat ? "bg-gradient-to-r from-sky-600 to-sky-400 text-white shadow-lg" : "bg-gray-200 text-gray-700"}`}>
                  <span>{cat}</span>
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs text-black">{categoryCounts[cat] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {ownerMode && (
          <div className="bg-white rounded-lg shadow-md m-3 mb-0 p-2 flex-shrink-0">
            <h3 className="text-sm text-black font-bold mb-2">Manage Base Colors</h3>
            <div className="flex flex-wrap gap-4">
              {baseColorOptions.map(c => (
                <label key={c} className="flex items-center gap-1 text-sm text-black">
                  <input
                    type="checkbox"
                    checked={colorStatuses[c] ?? true}
                    onChange={() => toggleColorStatus(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* CHARM GRID */}
        <div
          ref={charmsContainerRef}
          className="flex-1 bg-white overflow-y-auto rounded-lg shadow-md m-3 mt-2 p-6 flex flex-col touch-pan-y"
          style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
        >
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 justify-items-center">
            {filteredCharms.map((charm) => {
              const stockKey = stripExtension(charm.filename);
              const soldOut = isCharmSoldOut(charm.filename, outOfStockMap);
              return (
                <div key={charm.id} className="relative group pointer-events-auto">
                  <DraggableCharm charm={charm} onTap={handleAddCharmToBracelet} soldOut={soldOut} />
                  <div className="absolute right-1 bottom-1 flex flex-col gap-1 items-end invisible group-hover:visible">
                    <div className="flex gap-1">
                      {ownerMode && <button onClick={() => deleteCharm(charm.filename)} className="text-[10px] bg-white/90 px-1 rounded" title="Delete file">Delete</button>}
                      {ownerMode && <button onClick={() => openRenameModal(charm.filename)} className="text-[10px] bg-white/90 px-1 rounded" title="Rename file">Rename</button>}
                    </div>
                    {ownerMode && (
                      <label className="flex items-center gap-1 bg-white/90 px-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!outOfStockMap[charm.filename]}
                          onChange={() => toggleOutOfStock(charm.filename)}
                        />
                        <span className="text-[9px] text-gray-600">Out of stock</span>
                      </label>
                    )}
                    {ownerMode && (
                      <div className="flex items-center gap-1 bg-white/90 px-1 rounded">
                        <span className="text-[9px] text-gray-600">Stock:</span>
                        <input
                          type="number"
                          min="0"
                          value={charmStock[stockKey] || 0}
                          onChange={(e) => updateCharmStock(stockKey, parseInt(e.target.value) || 0)}
                          disabled={stockLoading[stockKey]}
                          className={`
                            w-14 px-1 py-0.5 text-[11px] text-center border rounded
                            focus:outline-none focus:ring-1 focus:ring-sky-500
                            ${getStockColor(charmStock[stockKey] || 0)}
                            ${stockLoading[stockKey] ? 'opacity-50' : ''}
                          `}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-8" />
        </div>
      </div>

      {/* CART MODAL */}
      {cartOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-sky-50 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto shadow-lg border border-sky-200">
            <h2 className="text-2xl font-bold mb-4 text-black text-center">My Cart</h2>
            <div className="space-y-3 mb-6">
              {(() => {
                const cartItems: Record<string, { item: Charm; count: number }> = {};
                bracelet.forEach(item => {
                  if (item) {
                    const key = item.filename;
                    if (cartItems[key]) {
                      cartItems[key].count++;
                    } else {
                      cartItems[key] = { item, count: 1 };
                    }
                  }
                });
                return Object.values(cartItems).map(({ item, count }) => (
                  <div key={item.filename} className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-sky-100">
                    <Image src={item.img} alt={item.filename} width={60} height={60} className="rounded" unoptimized />
                    <div className="flex-1">
                      <p className="font-semibold text-black text-base break-words">{item.displayName}</p>
                      <p className="text-sm text-black">{(getPrice(item.filename) * count).toFixed(2)} AED</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Decrease quantity
                          const index = bracelet.findIndex(b => b?.filename === item.filename);
                          if (index !== -1) {
                            setBracelet(prev => prev.map((b, i) => i === index ? getPlaceholderCharm(selectedBaseColor) : b));
                          }
                        }}
                        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 text-black rounded-full flex items-center justify-center text-lg"
                      >
                        -
                      </button>
                      <span className="text-black font-semibold">{count}</span>
                      <button
                        onClick={() => {
                          // Increase quantity
                          const emptyIndex = bracelet.findIndex(b => !b || b.isPlaceholder);
                          if (emptyIndex !== -1) {
                            setBracelet(prev => {
                              const copy = [...prev];
                              copy[emptyIndex] = { ...item, id: `added-${Date.now()}-${Math.random()}` };
                              return copy;
                            });
                          }
                        }}
                        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 text-black rounded-full flex items-center justify-center text-lg"
                      >
                        +
                      </button>
                    </div>
                    {!item.isPlaceholder && (
                      <button onClick={() => {
                        // Remove all
                        setBracelet(prev => prev.map(b => b?.filename === item.filename ? getPlaceholderCharm(selectedBaseColor) : b));
                      }} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ));
              })()}
            </div>
            <div className="border-t border-sky-200 pt-4 sticky bg-sky-50 -bottom-[22px]"> 
              <div className="mb-4">
                <label className="block text-sm font-semibold text-black mb-2">Discount Code</label>
                <input
                  type="text"
                  placeholder="Enter discount code"
                  className="w-full p-2 border border-sky-200 rounded-lg bg-white text-black"
                />
              </div>
              <div className="text-xl font-bold mb-4 text-black">
                Total: {subtotal.toFixed(2)} AED
              </div>
              <div className="flex gap-4">
                <button onClick={() => setCartOpen(false)} className="flex-1 bg-gray-400 hover:bg-gray-500 text-black px-4 py-3 rounded-lg transition text-lg">
                  Back
                </button>
                <button onClick={handleCheckout} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 rounded-lg transition text-lg font-semibold">
                  Check Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT FORM MODAL */}
      {checkoutFormOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCheckoutFormOpen(false)} />
          <div className="relative bg-sky-50 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto shadow-lg border border-sky-200">
            <h2 className="text-2xl font-bold mb-4 text-black text-center">Complete Your Order</h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full p-2 border border-sky-200 rounded-lg bg-white text-black"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Phone Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                    if (onlyNums.length <= 15) {
                      setPhoneNumber(onlyNums);
                    }
                  }}
                  placeholder="971XXXXXXXXX"
                  className="w-full p-2 border border-sky-200 rounded-lg bg-white text-black"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Pick Up Time</label>
                <select
                  value={pickupTime}
                  onChange={e => setPickupTime(e.target.value)}
                  className="w-full p-2 border border-sky-200 rounded-lg bg-white text-black"
                  required
                >
                  <option value="">Select time</option>
                  <option value="Weekdays: 6PM - 8PM">Weekdays: 6PM - 8PM</option>
                  <option value="Weekends: 3PM - 8PM">Weekends: 3PM - 8PM</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Place of Meet Up</label>
                <select
                  value={meetupPlace}
                  onChange={e => setMeetupPlace(e.target.value)}
                  className="w-full p-2 border border-sky-200 rounded-lg bg-white text-black"
                  required
                >
                  <option value="">Select location</option>
                  <optgroup label="Free Delivery">
                    <option value="Dubai Internet City Metro">Dubai Internet City Metro</option>
                    <option value="Dubai Knowledge Park (Tuesday at 5:30 PM)">Dubai Knowledge Park (Tuesday at 5:30 PM)</option>
                  </optgroup>
                  <optgroup label="5 AED Delivery fee">
                    <option value="Mall of the Emirates Metro">Mall of the Emirates Metro</option>
                    <option value="DMCC Metro">DMCC Metro</option>
                  </optgroup>
                  <optgroup label="10 AED Delivery fee">
                    <option value="Union Metro">Union Metro</option>
                    <option value="Burjuman Metro">Burjuman Metro</option>
                  </optgroup>
                  <optgroup label="Home Delivery">
                    <option value="Dubai: 20 AED">Dubai: 20 AED</option>
                    <option value="Other Emirates: 25 AED">Other Emirates: 25 AED</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Date of Delivery</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full p-2 border border-sky-200 rounded-lg bg-white text-black"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Payment Method</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pickup')}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                      paymentMethod === 'pickup' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-black border-sky-200'
                    }`}
                  >
                    Pay on Pickup/Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                      paymentMethod === 'online' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-black border-sky-200'
                    }`}
                  >
                    Pay Online Now
                  </button>
                </div>
              </div>
              <div className="border-t border-sky-200 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-black mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-black">
                    <span>Subtotal:</span>
                    <span>{subtotal.toFixed(2)} AED</span>
                  </div>
                  <div className="flex justify-between text-black">
                    <span>Delivery Fee:</span>
                    <span>{getDeliveryFee(meetupPlace).toFixed(2)} AED</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-sky-200 pt-2 text-black">
                    <span>Total:</span>
                    <span>{(subtotal + getDeliveryFee(meetupPlace)).toFixed(2)} AED</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setCheckoutFormOpen(false)} className="flex-1 bg-gray-400 hover:bg-gray-500 text-black px-4 py-3 rounded-lg transition text-lg">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={ziinaSubmitting}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 rounded-lg transition text-lg font-semibold disabled:opacity-60"
                >
                  {ziinaSubmitting ? 'Starting payment…' : paymentMethod === 'online' ? 'Continue to Payment' : 'Submit Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ziinaEmbedUrl && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-lg shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setZiinaEmbedUrl(null)}
              className="absolute top-2 right-2 z-10 bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-black"
              aria-label="Close payment"
            >
              ✕
            </button>
            <iframe
              ref={ziinaIframeRef}
              src={`${ziinaEmbedUrl}?version=latest`}
              width={500}
              height={820}
              style={{ maxWidth: '92vw', maxHeight: '85vh', border: 'none' }}
              allow="payment"
              title="Ziina Payment"
            />
          </div>
        </div>
      )}

      {ziinaResult && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setZiinaResult(null)} />
          <div className="relative bg-white rounded-lg shadow-lg p-6 w-80 text-center">
            {ziinaResult === 'success' ? (
              <>
                <p className="text-lg font-semibold text-green-700 mb-2">✅ Payment successful!</p>
                <p className="text-sm text-black mb-4">Your order has been confirmed. If you have any concerns, DM us on Instagram: @navilleracharms.ae</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-red-700 mb-2">
                  {ziinaResult === 'canceled' ? '⚠️ Payment canceled' : '❌ Payment failed'}
                </p>
                <p className="text-sm text-black mb-4">You can try again, or switch to Pay on Pickup/Delivery instead.</p>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                const wasSuccess = ziinaResult === 'success';
                setZiinaResult(null);
                if (wasSuccess) {
                  setCheckoutFormOpen(false);
                  setCustomerName('');
                  setPhoneNumber('');
                  setPickupTime('');
                  setMeetupPlace('');
                  setDeliveryDate('');
                }
              }}
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}