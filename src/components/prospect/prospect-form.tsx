"use client";

import { useState } from "react";
import type { ProspectRequest } from "@/lib/utils/types";
import { RESULT_COUNT_OPTIONS } from "@/lib/utils/constants";
import { NicheGrid } from "./niche-grid";
import { LocationSelector } from "./location-selector";
import { Button } from "@/components/ui/button";

interface ProspectFormProps {
  onSubmit: (req: ProspectRequest) => void;
  loading?: boolean;
}

export function ProspectForm({ onSubmit, loading }: ProspectFormProps) {
  const [nicheId, setNicheId] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [resultCount, setResultCount] = useState<number>(50);

  const handleLocationChange = (field: "country" | "state" | "city", value: string) => {
    if (field === "country") {
      setCountry(value);
      setState("");
      setCity("");
    } else if (field === "state") {
      setState(value);
    } else {
      setCity(value);
    }
  };

  const canSubmit = !loading && !!nicheId && !!country && !!state && !!city.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      niche_id: nicheId,
      country,
      state,
      city: city.trim(),
      result_count: resultCount,
    });
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-8">
      <NicheGrid selected={nicheId} onSelect={setNicheId} />

      <div>
        <p className="text-xs font-medium text-text-3 uppercase tracking-wider mb-3">
          Location
        </p>
        <LocationSelector
          country={country}
          state={state}
          city={city}
          onChange={handleLocationChange}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-text-3 uppercase tracking-wider mb-3">
          Results per search
        </p>
        <div className="flex gap-2 flex-wrap">
          {RESULT_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setResultCount(count)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all ${
                resultCount === count
                  ? "border-gold bg-gold-dim text-gold"
                  : "border-border bg-bg-2 text-text-2 hover:border-border-hover hover:bg-bg-3"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-3 mt-2">
          More results take longer to extract.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!canSubmit} loading={loading} size="lg">
          {loading ? "Searching..." : "Find leads"}
        </Button>
        {!nicheId && (
          <p className="text-xs text-text-3">Select a niche to continue</p>
        )}
        {nicheId && (!country || !state || !city.trim()) && (
          <p className="text-xs text-text-3">Complete the location fields</p>
        )}
      </div>
    </form>
  );
}
