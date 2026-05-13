"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

interface TopbarProps {
  onMenuClick?: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/prospect":     "Prospect",
  "/leads":        "Leads",
  "/pipeline":     "Pipeline",
  "/data-quality": "Data Quality",
  "/outreach":     "Outreach",
  "/settings":     "Settings",
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "SgOps Data";

  return (
    <header className="h-14 flex items-center gap-3 px-4 md:px-6 border-b border-border bg-bg-1 shrink-0">
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 -ml-1 rounded-lg text-text-3 hover:text-text-1 hover:bg-bg-3 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-base font-semibold text-text-1">{title}</h1>
    </header>
  );
}
