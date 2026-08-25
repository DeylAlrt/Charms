"use client";

import { baseColorOptions } from '../charmEditorUtils';

type AdminColorManagerProps = {
  colorStatuses: Record<string, boolean>;
  onToggle: (color: string) => void;
};

/** Owner-only panel to mark base bracelet colors as sold out / available. */
export default function AdminColorManager({ colorStatuses, onToggle }: AdminColorManagerProps) {
  return (
    <div className="bg-white rounded-lg shadow-md m-3 mb-0 p-2 flex-shrink-0">
      <h3 className="text-sm text-navy font-bold mb-2">Manage Base Colors</h3>
      <div className="flex flex-wrap gap-4">
        {baseColorOptions.map(c => (
          <label key={c} className="flex items-center gap-1 text-sm text-navy">
            <input
              type="checkbox"
              checked={colorStatuses[c] ?? true}
              onChange={() => onToggle(c)}
            />
            {c}
          </label>
        ))}
      </div>
    </div>
  );
}
