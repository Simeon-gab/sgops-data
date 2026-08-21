"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Search,
  Users,
  Kanban,
  ShieldCheck,
  Mail,
  Megaphone,
  Settings,
  Zap,
  LogOut,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SidebarProps {
  onClose?: () => void;
}

const NAV_ITEMS = [
  { href: "/dashboard",    icon: LayoutDashboard, label: "Dashboard" },
  { href: "/prospect",     icon: Search,          label: "Prospect" },
  { href: "/leads",        icon: Users,           label: "Leads" },
  { href: "/pipeline",     icon: Kanban,          label: "Pipeline" },
  { href: "/data-quality", icon: ShieldCheck,     label: "Data Quality" },
  { href: "/outreach",     icon: Mail,            label: "Outreach" },
  { href: "/campaigns",    icon: Megaphone,       label: "Campaigns" },
];

const BOTTOM_ITEMS = [
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [signingOut, setSigningOut] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? null);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      onClose?.();
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <aside className="w-60 h-full flex flex-col bg-bg-1 border-r border-border">
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
              onClick={onClose}
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
              onClick={onClose}
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
        {email && (
          <div className="flex items-center gap-2.5 px-3 py-2 min-w-0" title={email}>
            <div className="w-7 h-7 rounded-full bg-bg-3 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-text-3" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-text-3 leading-none">Signed in as</p>
              <p className="text-xs text-text-1 leading-tight mt-1 truncate">{email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          className="mt-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/50 active:bg-red-500/20 transition-colors w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LogOut className={clsx("h-4 w-4 shrink-0", signingOut && "animate-pulse")} />
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
