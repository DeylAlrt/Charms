import { useEffect, useState } from 'react';

/** Owner-only "Out of stock" flag per charm filename. See /api/charm-status. */
export function useOutOfStock() {
  const [outOfStockMap, setOutOfStockMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/charm-status')
      .then(r => r.json())
      .then(setOutOfStockMap)
      .catch(err => console.error('Error loading out-of-stock status:', err));
  }, []);

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

  return { outOfStockMap, toggleOutOfStock };
}
