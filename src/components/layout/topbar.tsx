"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/prospect": "Prospect",
  "/leads": "Leads",
  "/pipeline": "Pipeline",
  "/data-quality": "Data Quality",
  "/outreach": "Outreach",
  "/settings": "Settings",
};

export function Topbar() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "SgOps Data";

  return (
    <header className="h-14 flex items-center px-6 border-b border-border bg-bg-1 shrink-0">
      <h1 className="text-base font-semibold text-text-1">{title}</h1>
    </header>
  );
}
