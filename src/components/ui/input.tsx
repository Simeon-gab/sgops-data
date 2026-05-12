"use client";

import { clsx } from "clsx";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={clsx(
            "w-full bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-3",
            "focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent",
            "transition-colors",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-text-3">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
