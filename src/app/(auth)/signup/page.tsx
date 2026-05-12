"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/utils/format";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!data.user) {
        setError("Failed to create account. Please try again.");
        return;
      }

      // Create workspace for new user
      const slug = slugify(agencyName) || `workspace-${Date.now()}`;
      const { error: wsError } = await supabase.from("workspaces").insert({
        name: agencyName || "My Agency",
        slug,
        owner_id: data.user.id,
        agency_name: agencyName || null,
      });

      if (wsError) {
        // Workspace creation may fail without Supabase configured yet
        console.error("Workspace creation failed:", wsError.message);
      }

      router.push("/prospect");
      router.refresh();
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
