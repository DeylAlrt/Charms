import Image from "next/image";

type DraggableCharmProps = {
  charm: any;
  compact?: boolean;
  onTap?: (charm: any) => void;
  interactive?: boolean;
};

export default function DraggableCharm({ charm, compact = false, onTap, interactive = true }: DraggableCharmProps) {
  const isSoldOut = charm.filename.toLowerCase().includes("sold");

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
          ${isSoldOut ? 'bg-gray-300 border-2 border-gray-400' : 'bg-white'}
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
            select-none
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
