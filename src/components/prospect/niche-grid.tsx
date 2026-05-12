"use client";

import { NICHES } from "@/lib/utils/constants";

interface NicheGridProps {
  selected: string;
  onSelect: (nicheId: string) => void;
}

export function NicheGrid({ selected, onSelect }: NicheGridProps) {
  return (
    <div>
      <p className="text-xs font-medium text-text-3 uppercase tracking-wider mb-3">
        Select a niche
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {NICHES.map((niche) => {
          const isSelected = selected === niche.id;
          return (
            <button
              key={niche.id}
              type="button"
              onClick={() => onSelect(niche.id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                isSelected
                  ? "border-gold bg-gold-dim text-gold"
                  : "border-border bg-bg-2 text-text-2 hover:border-border-hover hover:bg-bg-3"
              }`}
            >
              <span className="text-2xl leading-none">{niche.icon}</span>
              <span className="text-xs font-medium leading-tight line-clamp-2">
                {niche.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
