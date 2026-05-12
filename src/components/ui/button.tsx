"use client";

import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-gold text-bg-0 hover:bg-gold-bright": variant === "primary",
            "bg-bg-3 text-text-1 border border-border hover:border-border-hover hover:bg-bg-4":
              variant === "secondary",
            "text-text-2 hover:text-text-1 hover:bg-bg-3": variant === "ghost",
            "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20":
              variant === "danger",
          },
          {
            "text-xs px-3 py-1.5 gap-1.5": size === "sm",
            "text-sm px-4 py-2 gap-2": size === "md",
            "text-base px-5 py-2.5 gap-2": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
