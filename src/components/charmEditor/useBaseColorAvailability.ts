import { useEffect, useState } from 'react';
import { baseColorOptions, type BaseColor } from '../charmEditorUtils';

/** Which base bracelet colors are currently orderable, and the owner-only toggle for it. */
export function useBaseColorAvailability(selectedBaseColor: BaseColor, setSelectedBaseColor: (c: BaseColor) => void) {
  const [colorStatuses, setColorStatuses] = useState<Record<string, boolean>>({});
  const availableBaseColors = Object.keys(colorStatuses).filter(c => colorStatuses[c]);

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

  // If the currently selected color becomes unavailable, fall back to the first available one.
  useEffect(() => {
    if (!availableBaseColors.includes(selectedBaseColor)) {
      setSelectedBaseColor((availableBaseColors[0] || 'Silver') as BaseColor);
    }
  }, [availableBaseColors, selectedBaseColor, setSelectedBaseColor]);

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
      setColorStatuses(prev => ({ ...prev, [color]: currentStatus }));
      alert('Failed to update color status');
    }
  };

  return { colorStatuses, availableBaseColors, toggleColorStatus };
}
