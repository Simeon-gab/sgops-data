"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Until this existed there was no way back into an account whose password had
// been forgotten. Sign-in was the only door and it had no key.

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // The recovery link carries a one-time code, so it has to land on the
      // callback route that exchanges it. Sent straight to /reset-password it
      // would arrive with no session and nothing to authorise the change.
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      // Shown regardless of whether the address is registered. Distinguishing
      // the two here would turn this form into a way to test whether any given
      // email has an account.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-gold flex items-center justify-center">
            <Zap className="h-5 w-5 text-bg-0" fill="currentColor" />
          </div>
          <div>
            <p className="text-base font-bold text-text-1 leading-none">SgOps Data</p>
            <p className="text-xs text-text-3 leading-none mt-0.5">Client Acquisition OS</p>
          </div>
        </div>

        <div className="bg-bg-2 border border-border rounded-2xl p-6">
          {sent ? (
            <div className="text-center">
              <div className="w-11 h-11 rounded-full bg-gold-dim flex items-center justify-center mx-auto mb-4">
                <MailCheck className="h-5 w-5 text-gold" />
              </div>
              <h2 className="text-xl font-semibold text-text-1 mb-1">Check your email</h2>
              <p className="text-sm text-text-3">
                If an account exists for{" "}
                <span className="text-text-1 font-medium break-all">{email}</span>, a reset link
                is on its way. It expires after an hour.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-text-1 mb-1">Reset your password</h2>
              <p className="text-sm text-text-3 mb-6">
                We will email you a link to set a new one.
              </p>

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
                <Button type="submit" loading={loading} className="w-full mt-1">
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-sm text-text-3 text-center mt-4">
          Remembered it?{" "}
          <Link href="/login" className="text-gold hover:text-gold-bright transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
