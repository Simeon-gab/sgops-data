"use client";

import { COUNTRIES } from "@/lib/utils/locations";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface LocationSelectorProps {
  country: string;
  state: string;
  city: string;
  onChange: (field: "country" | "state" | "city", value: string) => void;
}

export function LocationSelector({ country, state, city, onChange }: LocationSelectorProps) {
  const countryData = COUNTRIES.find((c) => c.code === country);
  const states = countryData?.states ?? [];
  const stateListId = country ? `state-suggestions-${country}` : undefined;

  const handleCountryChange = (value: string) => {
    onChange("country", value);
    onChange("state", "");
    onChange("city", "");
  };

  const countryOptions = [
    { value: "", label: "Select country..." },
    ...COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` })),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Select
        label="Country"
        value={country}
        onChange={(e) => handleCountryChange(e.target.value)}
        options={countryOptions}
      />

      {/* Free-text state with datalist suggestions where available */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-2">State / Region</label>
        <input
          type="text"
          list={stateListId}
          value={state}
          onChange={(e) => onChange("state", e.target.value)}
          placeholder={states.length > 0 ? "Type or pick..." : "e.g. Lagos"}
          disabled={!country}
          className="w-full bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {stateListId && states.length > 0 && (
          <datalist id={stateListId}>
            {states.map((s) => (
              <option key={s.code} value={s.name} />
            ))}
          </datalist>
        )}
      </div>

      {/* Always free-text city / area */}
      <Input
        label="City / Area"
        value={city}
        onChange={(e) => onChange("city", e.target.value)}
        placeholder="e.g. Victoria Island, Lagos"
        disabled={!country}
      />
    </div>
  );
}
