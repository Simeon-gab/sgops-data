"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeRedirect } from "@/lib/utils/safe-redirect";

// The callback route reports a bad link as a code, and only these are shown.
// Anything else in the query string is ignored rather than printed, so the URL
// cannot be used to put a chosen sentence above the password field.
const LINK_ERRORS: Record<string, string> = {
  link_invalid: "That sign-in link is not valid. Please request a new one.",
  link_expired: "That link has expired or was already used. Please request a new one.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // An expired confirmation or recovery link redirects here saying why. Without
  // this the visitor just lands on a blank login form with no idea the link
  // was the problem.
  const [error, setError] = useState(LINK_ERRORS[params.get("error") ?? ""] ?? "");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUnconfirmed(false);
    setResent(false);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        // Supabase refuses an unconfirmed account with a message that reads as
        // a wrong password to most people. Offering the resend here is what
        // makes the account recoverable without support.
        if (/not confirmed|confirm your email/i.test(error.message)) setUnconfirmed(true);
        return;
      }
      router.push(safeRedirect(params.get("next")));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      // Reported as sent either way. Whether an address has an unconfirmed
      // account on this system is not something an unauthenticated form should
      // confirm to whoever is typing into it.
      setResent(true);
      setError("");
      setUnconfirmed(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-gold flex items-center justify-center">
            <Zap className="h-5 w-5 text-bg-0" fill="currentColor" />
          </div>
          <div>
            <p className="text-base font-bold text-text-1 leading-none">SgOps Data</p>
            <p className="text-xs text-text-3 leading-none mt-0.5">Client Acquisition OS</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-bg-2 border border-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-text-1 mb-1">Welcome back</h2>
          <p className="text-sm text-text-3 mb-6">Sign in to your workspace</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                <p>{error}</p>
                {unconfirmed && (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-gold hover:text-gold-bright transition-colors mt-1.5 underline underline-offset-2"
                  >
                    Resend the confirmation email
                  </button>
                )}
              </div>
            )}

            {resent && (
              <p className="text-xs text-gold bg-gold-dim border border-gold/20 rounded-lg px-3 py-2">
                If that address has an account awaiting confirmation, a new link is on its way.
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full mt-1">
              Sign in
            </Button>
          </form>

          <p className="text-sm text-text-3 text-center mt-3">
            <Link
              href="/forgot-password"
              className="text-text-3 hover:text-gold transition-colors"
            >
              Forgot your password?
            </Link>
          </p>

          <p className="text-sm text-text-3 text-center mt-3">
            No account?{" "}
            <Link href="/signup" className="text-gold hover:text-gold-bright transition-colors">
              Create workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// useSearchParams opts the tree into client rendering, and Next requires the
// boundary to be explicit or the build fails on this page.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-0" />}>
      <LoginForm />
    </Suspense>
  );
}
