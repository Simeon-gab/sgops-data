"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

interface ComboboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  name?: string;
}

export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  autoComplete = "off",
  name,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [close]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  }

  function handleSelect(option: string) {
    setQuery(option);
    onChange(option);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && open && filtered.length > 0) {
      handleSelect(filtered[0]);
      e.preventDefault();
    }
  }

  const showDropdown = open && filtered.length > 0;

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-2">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          name={name}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={clsx(
            "w-full bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-3 pr-8",
            "focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent",
            "transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3 pointer-events-none transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />

        {showDropdown && (
          <div className="absolute z-50 mt-1 w-full bg-bg-2 border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm transition-colors",
                  option === value
                    ? "bg-gold/10 text-gold"
                    : "text-text-2 hover:bg-bg-3 hover:text-text-1"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
