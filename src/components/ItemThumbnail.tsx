import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ItemThumbnailProps {
  src?: string;
  alt: string;
  category: string;
  className?: string;
}

export const ItemThumbnail: React.FC<ItemThumbnailProps> = ({
  src,
  alt,
  category,
  className = 'aspect-[4/3] w-full',
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} flex flex-col items-center justify-center rounded-lg border border-blue-100 bg-gradient-to-br from-[#EEF2FF] via-[#F8FAFC] to-[#FFF1EE] px-4 text-center text-slate-600`}
      >
        <Package className="h-7 w-7 text-[#1A4BFF]/70 transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
        <span className="mt-2 text-xs font-semibold text-[#0B1437]">{category}</span>
        <span className="mt-0.5 text-[11px] text-slate-500">Text-matched report (no photo)</span>
      </div>
    );
  }

  return (
    <div className={`${className} overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
      />
    </div>
  );
};
