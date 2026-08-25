import { useEffect, useState } from 'react';

/** Owner-only numeric stock counts per charm (keyed by filename without extension), backed by Google Sheets. */
export function useCharmStock() {
  const [charmStock, setCharmStock] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/stock')
      .then(r => r.json())
      .then(data => {
        if (data.success) setCharmStock(data.stock);
      })
      .catch(err => console.error('Error loading stock:', err));
  }, []);

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

  return { charmStock, stockLoading, updateCharmStock };
}

export const getStockColor = (stock: number) => {
  if (stock === 0) return 'text-danger font-bold';
  if (stock < 5) return 'text-amber-600 font-semibold';
  return 'text-success';
};
