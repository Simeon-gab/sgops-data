"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex h-screen bg-bg-0 overflow-hidden">
      {/* Desktop sidebar — in-flow, never affects mobile layout */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar — fixed overlay, slides in/out */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={close} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
