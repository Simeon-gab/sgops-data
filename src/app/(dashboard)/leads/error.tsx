"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import Link from "next/link";

export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[LeadsPage]", error);
  }, [error]);

  return (
    <div className="max-w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-1">Leads</h2>
      </div>
      <div className="bg-bg-2 border border-red-500/20 rounded-2xl p-10 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-1">Leads failed to load</h3>
          <p className="text-sm text-text-3 mt-1 max-w-sm">
            {error.message || "An unexpected error occurred while loading the leads page."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-3 border border-border text-sm text-text-2 hover:border-border-hover transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/prospect"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-bg-0 text-sm font-medium hover:bg-gold-bright transition-colors"
          >
            <Search className="h-4 w-4" />
            New search
          </Link>
        </div>
      </div>
    </div>
  );
}
