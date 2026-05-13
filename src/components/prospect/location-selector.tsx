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

const PLACEHOLDERS: Record<string, { state: string; city: string }> = {
  NG: { state: "e.g. Lagos, Oyo, Rivers",          city: "e.g. Victoria Island, Ikeja, Ibadan" },
  GH: { state: "e.g. Greater Accra, Ashanti",      city: "e.g. Accra, Kumasi, Tema" },
  ZA: { state: "e.g. Gauteng, Western Cape",        city: "e.g. Johannesburg, Cape Town, Durban" },
  KE: { state: "e.g. Nairobi, Mombasa",             city: "e.g. Westlands, Karen, Nyali" },
  IN: { state: "e.g. Maharashtra, Karnataka",       city: "e.g. Mumbai, Bangalore, Pune" },
  AE: { state: "e.g. Dubai, Abu Dhabi",             city: "e.g. Jumeirah, Deira, Al Ain" },
  SG: { state: "e.g. Central Region, East Region", city: "e.g. Orchard, Tampines, Clarke Quay" },
  GB: { state: "e.g. England, Scotland",            city: "e.g. London, Manchester, Edinburgh" },
  US: { state: "e.g. Texas, California",            city: "e.g. Dallas, Houston, Los Angeles" },
  CA: { state: "e.g. Ontario, British Columbia",    city: "e.g. Toronto, Vancouver, Calgary" },
  AU: { state: "e.g. New South Wales, Victoria",   city: "e.g. Sydney, Melbourne, Brisbane" },
  DE: { state: "e.g. Bavaria, Berlin",              city: "e.g. Munich, Hamburg, Cologne" },
  FR: { state: "e.g. Île-de-France, Normandy",     city: "e.g. Paris, Lyon, Marseille" },
  BR: { state: "e.g. São Paulo, Rio de Janeiro",   city: "e.g. São Paulo, Rio, Campinas" },
  MX: { state: "e.g. Jalisco, Mexico City",         city: "e.g. Guadalajara, Monterrey" },
  JM: { state: "e.g. Kingston, St. James",          city: "e.g. Kingston, Montego Bay" },
  TT: { state: "e.g. Port of Spain, San Fernando", city: "e.g. Port of Spain, Chaguanas" },
  NL: { state: "e.g. North Holland, Utrecht",      city: "e.g. Amsterdam, Rotterdam" },
};

const DEFAULT_PLACEHOLDERS = {
  state: "e.g. State or region",
  city:  "e.g. City or area",
};

export function LocationSelector({ country, state, city, onChange }: LocationSelectorProps) {
  const ph = (country && PLACEHOLDERS[country]) || DEFAULT_PLACEHOLDERS;

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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Select
        label="Country"
        value={country}
        onChange={(e) => handleCountryChange(e.target.value)}
        options={countryOptions}
      />

      <Input
        label="State / Region"
        name="sg-state-field"
        autoComplete="one-time-code"
        value={state}
        onChange={(e) => onChange("state", e.target.value)}
        placeholder={ph.state}
        disabled={!country}
      />

      <Input
        label="City / Area"
        name="sg-city-field"
        autoComplete="one-time-code"
        value={city}
        onChange={(e) => onChange("city", e.target.value)}
        placeholder={ph.city}
        disabled={!country}
      />
    </div>
  );
}
