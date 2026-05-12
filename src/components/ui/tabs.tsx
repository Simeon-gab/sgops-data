"use client";

import { clsx } from "clsx";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={clsx("flex gap-1 bg-bg-1 p-1 rounded-lg border border-border", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            "flex-1 text-sm font-medium px-3 py-1.5 rounded-md transition-colors",
            active === tab.id
              ? "bg-bg-3 text-text-1"
              : "text-text-3 hover:text-text-2"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
