"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { COUNTRIES } from "@/lib/utils/locations";
import { getStatesForCountry, getCitiesForState } from "@/lib/utils/locations/index";
import { Select } from "@/components/ui/select";

interface LocationSelectorProps {
  country: string;
  state: string;
  city: string;
  onChange: (field: "country" | "state" | "city", value: string) => void;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  disabledPlaceholder: string;
  disabled?: boolean;
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabledPlaceholder,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [close]);

  const filtered = inputValue.trim()
    ? options.filter((o) => o.toLowerCase().includes(inputValue.toLowerCase()))
    : options;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    setOpen(true);
  };

  const handleSelect = (opt: string) => {
    setInputValue(opt);
    onChange(opt);
    setOpen(false);
  };

  const handleChevronClick = () => {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (next) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-sm font-medium text-text-2">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          value={disabled ? "" : inputValue}
          onChange={handleInputChange}
          onFocus={() => { if (!disabled) setOpen(true); }}
          placeholder={disabled ? disabledPlaceholder : placeholder}
          disabled={disabled}
          autoComplete="off"
          className={clsx(
            "w-full bg-bg-2 border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-1 placeholder:text-text-3",
            "focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent",
            "transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={handleChevronClick}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 focus:outline-none"
        >
          <ChevronDown
            className={clsx("h-4 w-4 transition-transform duration-150", open && "rotate-180")}
          />
        </button>

        {open && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-bg-2 border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-text-3">
                  {inputValue ? `Press Enter to use "${inputValue}"` : "No options available"}
                </div>
              ) : (
                filtered.slice(0, 100).map((opt) => (
                  <div
                    key={opt}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                    className={clsx(
                      "px-3 py-2 text-sm cursor-pointer transition-colors",
                      opt === inputValue
                        ? "bg-gold-dim text-gold"
                        : "text-text-1 hover:bg-bg-3"
                    )}
                  >
                    {opt}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LocationSelector({ country, state, city, onChange }: LocationSelectorProps) {
  const stateOptions = country ? getStatesForCountry(country) : [];
  const cityOptions = country && state ? getCitiesForState(country, state) : [];

  const handleCountryChange = (value: string) => {
    onChange("country", value);
    onChange("state", "");
    onChange("city", "");
  };

  const handleStateChange = (value: string) => {
    onChange("state", value);
    onChange("city", "");
  };

  const handleCityChange = (value: string) => {
    onChange("city", value);
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

      <SearchableSelect
        label="State / Region"
        value={state}
        onChange={handleStateChange}
        options={stateOptions}
        placeholder={stateOptions.length ? "Search or type state..." : "Type state or region"}
        disabledPlaceholder="Select country first"
        disabled={!country}
      />

      <SearchableSelect
        label="City / Area"
        value={city}
        onChange={handleCityChange}
        options={cityOptions}
        placeholder={cityOptions.length ? "Search or type city..." : "Type city or area"}
        disabledPlaceholder="Select state first"
        disabled={!country || !state}
      />
    </div>
  );
}
