"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Carried on the user rather than written to a table here. This runs
          // before the account is confirmed, so there is no session yet and an
          // insert would be refused by row-level security. The workspace is
          // created on first authenticated request and reads the name back off
          // the user, which is why what gets typed here still ends up as the
          // sender name on outreach instead of being quietly dropped.
          data: { agency_name: agencyName.trim() || null },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!data.user) {
        setError("Failed to create account. Please try again.");
        return;
      }

      // No session means the project requires email confirmation, which it
      // does by default. Redirecting into the app here is what the old flow
      // did, and the middleware sent them straight back to /login with nothing
      // said: signing up looked like it had failed.
      if (!data.session) {
        setAwaitingConfirmation(true);
        return;
      }

      router.push("/prospect");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (awaitingConfirmation) {
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

          <div className="bg-bg-2 border border-border rounded-2xl p-6 text-center">
            <div className="w-11 h-11 rounded-full bg-gold-dim flex items-center justify-center mx-auto mb-4">
              <MailCheck className="h-5 w-5 text-gold" />
            </div>
            <h2 className="text-xl font-semibold text-text-1 mb-1">Confirm your email</h2>
            <p className="text-sm text-text-3">
              We sent a confirmation link to{" "}
              <span className="text-text-1 font-medium break-all">{email}</span>. Open it to
              activate your workspace, then sign in.
            </p>
            <p className="text-xs text-text-3 mt-4">
              Nothing in your inbox? Check spam, or{" "}
              <Link href="/signup" className="text-gold hover:text-gold-bright transition-colors">
                try a different address
              </Link>
              .
            </p>
          </div>

          <p className="text-sm text-text-3 text-center mt-4">
            Already confirmed?{" "}
            <Link href="/login" className="text-gold hover:text-gold-bright transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
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
          <h2 className="text-xl font-semibold text-text-1 mb-1">Create workspace</h2>
          <p className="text-sm text-text-3 mb-6">Set up your agency in under a minute</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Agency name"
              type="text"
              placeholder="Creative Co."
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              required
            />
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
              autoComplete="new-password"
              hint="At least 8 characters"
            />

            {error && (
              <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full mt-1">
              Create workspace
            </Button>
          </form>

          <p className="text-sm text-text-3 text-center mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-gold hover:text-gold-bright transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
