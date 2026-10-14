import { useState } from "react";
import Image from "next/image";
import { isCharmSoldOut, type Charm } from './charmEditorUtils';

type DraggableCharmProps = {
  charm: Charm;
  compact?: boolean;
  onTap?: (charm: Charm) => void;
  interactive?: boolean;
  /** Pass explicitly once the caller knows the admin-flagged status; falls back to the filename convention if omitted. */
  soldOut?: boolean;
};

export default function DraggableCharm({ charm, compact = false, onTap, interactive = true, soldOut }: DraggableCharmProps) {
  const isSoldOut = soldOut ?? isCharmSoldOut(charm.filename);
  // Which picture has finished loading, so a swapped-in charm shimmers again until it arrives
  const [loadedImg, setLoadedImg] = useState<string | null>(null);

  return (
    <button
      type="button"
      onClick={() => interactive && !isSoldOut && onTap?.(charm)}
      className={`relative group ${isSoldOut ? 'cursor-not-allowed' : 'cursor-pointer'} border-0 bg-transparent p-0`}
      style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      <div
        className={`
          relative overflow-hidden rounded-lg shadow-md flex flex-col items-center
          ${compact ? 'p-0' : 'p-2'}
          bg-white
          transition-[translate,scale,box-shadow] duration-200
          ${isSoldOut ? 'grayscale opacity-60' : ''}
          ${interactive && !isSoldOut ? 'group-hover:-translate-y-1 group-hover:shadow-lg group-active:scale-90' : ''}
        `}
      >
        <Image
          src={charm.img}
          alt={charm.filename}
          width={120}
          height={120}
          className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain select-none ${loadedImg === charm.img ? '' : 'sk'}`}
          unoptimized
          draggable={false}
          onLoad={() => setLoadedImg(charm.img)}
          onError={() => setLoadedImg(charm.img)}
          style={{
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          onContextMenu={(e) => e.preventDefault()}
        />

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
    </button>
  );
}
