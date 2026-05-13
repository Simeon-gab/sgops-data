"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { NICHES } from "@/lib/utils/constants";

interface NicheGridProps {
  selected: string;
  onSelect: (nicheId: string) => void;
}

export function NicheGrid({ selected, onSelect }: NicheGridProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? NICHES.filter((n) =>
        n.label.toLowerCase().includes(query.toLowerCase())
      )
    : NICHES;

  return (
    <div>
      <p className="text-xs font-medium text-text-3 uppercase tracking-wider mb-3">
        Select a niche
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search niches..."
          className="w-full bg-bg-2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-colors"
        />
      </div>

      <div className="max-h-72 overflow-y-auto pr-1 -mr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-text-3 text-center py-6">No niches found</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {filtered.map((niche) => {
              const isSelected = selected === niche.id;
              return (
                <button
                  key={niche.id}
                  type="button"
                  onClick={() => onSelect(niche.id)}
                  className={`flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-3 rounded-xl border text-center transition-all ${
                    isSelected
                      ? "border-gold bg-gold-dim text-gold"
                      : "border-border bg-bg-2 text-text-2 hover:border-border-hover hover:bg-bg-3"
                  }`}
                >
                  <span className="text-xl sm:text-2xl leading-none">{niche.icon}</span>
                  <span className="text-[11px] sm:text-xs font-medium leading-tight line-clamp-2">
                    {niche.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
