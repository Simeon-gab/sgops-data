"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import { clsx } from "clsx";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

let addToastFn: ((message: string, type?: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = "info") {
  addToastFn?.(message, type);
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToastFn = (message, type = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => {
      addToastFn = null;
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium max-w-sm",
            {
              "bg-green-500/10 border-green-500/20 text-green-400": t.type === "success",
              "bg-red-500/10 border-red-500/20 text-red-400": t.type === "error",
              "bg-bg-3 border-border text-text-1": t.type === "info",
            }
          )}
        >
          {t.type === "success" && <CheckCircle className="h-4 w-4 shrink-0" />}
          {t.type === "error" && <XCircle className="h-4 w-4 shrink-0" />}
          {t.type === "info" && <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
