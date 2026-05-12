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

  const handleCountryChange = (value: string) => {
    onChange("country", value);
    onChange("state", "");
    onChange("city", "");
  };

  const handleStateChange = (value: string) => {
    onChange("state", value);
    const stateData = COUNTRIES
      .find((c) => c.code === country)
      ?.states.find((s) => s.code === value);
    onChange("city", stateData?.cities[0]?.name ?? "");
  };

  const countryOptions = [
    { value: "", label: "Select country..." },
    ...COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` })),
  ];

  const stateOptions = [
    { value: "", label: "Select state..." },
    ...states.map((s) => ({ value: s.code, label: s.name })),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Select
        label="Country"
        value={country}
        onChange={(e) => handleCountryChange(e.target.value)}
        options={countryOptions}
      />
      <Select
        label="State / Region"
        value={state}
        onChange={(e) => handleStateChange(e.target.value)}
        options={stateOptions}
        disabled={!country}
      />
      <Input
        label="City"
        value={city}
        onChange={(e) => onChange("city", e.target.value)}
        placeholder="e.g. Lagos"
        disabled={!state}
      />
    </div>
  );
}
