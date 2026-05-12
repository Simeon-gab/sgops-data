"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Search,
  Users,
  Kanban,
  ShieldCheck,
  Mail,
  Settings,
  Zap,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/prospect", icon: Search, label: "Prospect" },
  { href: "/leads", icon: Users, label: "Leads" },
  { href: "/pipeline", icon: Kanban, label: "Pipeline" },
  { href: "/data-quality", icon: ShieldCheck, label: "Data Quality" },
  { href: "/outreach", icon: Mail, label: "Outreach" },
];

const BOTTOM_ITEMS = [
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-bg-1 border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
            <Zap className="h-4 w-4 text-bg-0" fill="currentColor" />
          </div>
          <div>
            <p className="text-sm font-bold text-text-1 leading-none">SgOps</p>
            <p className="text-xs text-text-3 leading-none mt-0.5">Data</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-gold-dim text-gold font-medium"
                  : "text-text-3 hover:text-text-1 hover:bg-bg-3"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 py-4 border-t border-border flex flex-col gap-1">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-gold-dim text-gold font-medium"
                  : "text-text-3 hover:text-text-1 hover:bg-bg-3"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-3 hover:text-red-400 hover:bg-red-500/5 transition-colors w-full text-left"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
