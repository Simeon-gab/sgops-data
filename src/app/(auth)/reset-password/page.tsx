"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Reached only by following a recovery link, which passes through
// /auth/callback first. By the time anyone is here they are signed in on a
// recovery session, and that session is the authorisation for the change.
// The middleware deliberately does not bounce signed-in users away from this
// page, or the last step of the reset would be unreachable.

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);

  // A recovery link that has expired or been used already leaves no session
  // behind. Checking up front means saying so, rather than letting someone
  // type a new password and only then discovering nothing can be saved.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setReady(Boolean(data.user));
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
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
          {ready === false ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-text-1 mb-1">This link has expired</h2>
              <p className="text-sm text-text-3 mb-5">
                Reset links can only be used once, and they expire after an hour.
              </p>
              <Link href="/forgot-password">
                <Button className="w-full">Request a new link</Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-text-1 mb-1">Set a new password</h2>
              <p className="text-sm text-text-3 mb-6">
                You will be signed in once it is saved.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="New password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  hint={`At least ${MIN_LENGTH} characters`}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  loading={loading}
                  disabled={ready === null}
                  className="w-full mt-1"
                >
                  Save password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
